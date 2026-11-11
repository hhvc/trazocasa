"""Independent IFC4 schema, relationship and solid audit; see docs/ifc.md."""
import json
import math
import sys
from pathlib import Path

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.guid
import ifcopenshell.util.element
import ifcopenshell.util.placement
import ifcopenshell.util.shape
import ifcopenshell.util.unit
import ifcopenshell.validate
import numpy as np


def close(actual, expected):
    assert math.isclose(actual, expected, abs_tol=2e-6, rel_tol=1e-6), (actual, expected)


def area(points):
    return abs(sum(p['x'] * points[(i + 1) % len(points)]['y'] - points[(i + 1) % len(points)]['x'] * p['y'] for i, p in enumerate(points))) / 2


def source(element):
    return ifcopenshell.util.element.get_psets(element).get('TrazoCasa_Source', {})


def vertical_hits(vertices, faces, x, y):
    """Count triangles hit by a vertical ray; no solid should remain inside a hole."""
    count = 0
    for face in faces:
        a, b, c = vertices[face]
        det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(det) < 1e-10:
            continue
        u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det
        v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det
        if u >= -1e-8 and v >= -1e-8 and u + v <= 1 + 1e-8:
            count += 1
    return count


def check(path):
    doc = ifcopenshell.open(path)
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(doc, logger, express_rules=True)
    assert not logger.statements, '\n'.join(str(item) for item in logger.statements)
    assert doc.schema == 'IFC4'
    close(ifcopenshell.util.unit.calculate_unit_scale(doc), 1)
    roots = doc.by_type('IfcRoot')
    assert len({item.GlobalId for item in roots}) == len(roots)
    for item in roots:
        assert len(ifcopenshell.guid.expand(item.GlobalId)) == 32
    assert len(doc.by_type('IfcProject')) == len(doc.by_type('IfcSite')) == len(doc.by_type('IfcBuilding')) == 1
    assert not doc.by_type('IfcSpace') and not doc.by_type('IfcBuildingElementProxy')
    project = json.loads(path.with_suffix('.trazocasa').read_text(encoding='utf-8'))
    floors = {f['id']: f for f in project['floors']}
    storeys = {source(s)['FloorId']: s for s in doc.by_type('IfcBuildingStorey')}
    assert storeys.keys() == floors.keys()
    for fid, storey in storeys.items():
        position = ifcopenshell.util.placement.get_local_placement(storey.ObjectPlacement)
        close(position[2, 3], storey.Elevation)
        if 'elevation' in floors[fid]:
            close(storey.Elevation, floors[fid]['elevation'])
        assert storey.Decomposes[0].RelatingObject.is_a('IfcBuilding')

    settings = ifcopenshell.geom.settings()
    settings.set('use-world-coords', True)
    solids = 0
    for element in doc.by_type('IfcElement'):
        meta = source(element)
        assert meta.get('SourceId') and meta.get('FloorId') in floors
        plan = floors[meta['FloorId']]['plan']
        storey = storeys[meta['FloorId']]
        if element.is_a('IfcOpeningElement'):
            assert len(element.VoidsElements) == 1 and not element.ContainedInStructure
            assert source(element.VoidsElements[0].RelatingBuildingElement)['FloorId'] == meta['FloorId']
            continue
        assert len(element.ContainedInStructure) == 1
        assert element.ContainedInStructure[0].RelatingStructure == storey
        shape = ifcopenshell.geom.create_shape(settings, element)
        geometry = shape.geometry
        vertices = np.array(geometry.verts).reshape((-1, 3))
        faces = np.array(geometry.faces).reshape((-1, 3))
        volume = ifcopenshell.util.shape.get_volume(geometry)
        assert len(faces) and np.isfinite(vertices).all() and volume > 1e-9
        solids += 1
        if element.is_a('IfcWall'):
            wall = next(w for w in plan['walls'] if w['id'] == meta['SourceId'])
            length = math.hypot(wall['b']['x'] - wall['a']['x'], wall['b']['y'] - wall['a']['y'])
            thickness = wall.get('thickness', .105)
            if not any(s.get('roof', {}).get('fitWalls') for s in plan['surfaces']):
                gross = length * thickness * wall.get('height', plan.get('wallHeight', 2.8))
                removed = sum(o['width'] * o.get('height', 2.1 if o['kind'] == 'door' else 1.2) * thickness for o in plan['openings'] if o['wallId'] == wall['id'])
                close(volume, gross - removed)
            if path.stem == 'roof-shed':
                close(volume, 4.1)
            if path.stem in ('roof-gable', 'concave-gable'):
                close(volume, 3.65)
            position = ifcopenshell.util.placement.get_local_placement(element.ObjectPlacement)
            assert np.allclose(position[:3, 3], [wall['a']['x'], -wall['a']['y'], storey.Elevation])
            assert np.allclose(position[:2, 0], [(wall['b']['x'] - wall['a']['x']) / length, -(wall['b']['y'] - wall['a']['y']) / length])
        if element.is_a('IfcDoor') or element.is_a('IfcWindow'):
            opening = next(o for o in plan['openings'] if o['id'] == meta['SourceId'])
            close(element.OverallWidth, opening['width'])
            close(element.OverallHeight, opening.get('height', 2.1 if opening['kind'] == 'door' else 1.2))
            assert len(element.FillsVoids) == 1
            host = element.FillsVoids[0].RelatingOpeningElement.VoidsElements[0].RelatingBuildingElement
            assert host.is_a('IfcWall') and source(host)['SourceId'] == opening['wallId']
        if element.is_a('IfcSlab') or element.is_a('IfcRoof'):
            kind = 'slab' if element.is_a('IfcSlab') else 'roof'
            surface = next(s for s in plan['surfaces'] if s['id'] == meta['SourceId'])
            assert element.Name == surface['name']  # Unicode, apostrophes and backslashes
            holes = [h for h in surface.get('holes', []) if h['target'] in (kind, 'both')]
            net_area = area(surface['points']) - sum(area(h['points']) for h in holes)
            close(volume, net_area * surface[kind]['thickness'])
            assert len(element.HasOpenings) == len(holes)
            if kind == 'slab':
                close(vertices[:, 2].max(), storey.Elevation)
                close(vertices[:, 2].min(), storey.Elevation - surface[kind]['thickness'])
            for h in holes:
                # Validation fixtures use rectangular holes; their centroid is strictly inside.
                x = sum(p['x'] for p in h['points']) / len(h['points'])
                y = -sum(p['y'] for p in h['points']) / len(h['points'])
                assert vertical_hits(vertices, faces, x, y) == 0
    print(f'{path.name}: IFC4 + EXPRESS OK, {solids} solids, relationships/units/volumes OK', flush=True)
    return solids


if __name__ == '__main__':
    files = sorted(Path(sys.argv[1]).glob('*.ifc'))
    assert files, 'No IFC fixtures found'
    total = sum(check(path) for path in files)
    print(f'Validated {len(files)} files / {total} solids with IfcOpenShell {ifcopenshell.version}')
