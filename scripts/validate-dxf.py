"""Independent reader audit. Install ezdxf in a temporary venv; see docs/dxf.md."""
import json
import math
import sys
from pathlib import Path

import ezdxf


def identity(entity):
    if not entity.has_xdata("TRAZOCASA"):
        return None
    return json.loads("".join(tag.value for tag in entity.get_xdata("TRAZOCASA") if tag.code == 1000))


def check(path):
    # Deliberately do not use recover.readfile(): a broken export must fail.
    doc = ezdxf.readfile(path)
    audit = doc.audit()
    assert not audit.errors and not audit.fixes, (path, audit.errors, audit.fixes)
    assert doc.dxfversion == "AC1021" and doc.units == 6
    entities = list(doc.modelspace())
    for entity in entities:
        meta = identity(entity)
        assert meta and meta["schema"] == 1 and meta["id"]
        assert entity.dxf.layer in doc.layers
        if entity.dxftype() == "DIMENSION":
            assert entity.dimtype == 1
            assert list(entity.virtual_entities())
        if entity.dxftype() == "INSERT":
            assert list(entity.virtual_entities())
        if entity.dxftype() == "ARC":
            assert math.isclose((entity.dxf.end_angle - entity.dxf.start_angle) % 360, 90)

    source_path = path.with_suffix(".trazocasa")
    if source_path.exists() and entities:
        source = json.loads(source_path.read_text(encoding="utf-8"))
        floor_id = identity(entities[0])["floorId"]
        floor = next(f for f in source["floors"] if f["id"] == floor_id)
        plan = floor["plan"]
        assert all(identity(e)["floorId"] == floor_id for e in entities)
        for label in plan["labels"]:
            entity = next(e for e in entities if identity(e)["id"] == label["id"])
            assert entity.plain_text(fast=False) == label["text"]
            assert entity.dxf.insert.isclose((label["x"], -label["y"], 0))
        for dim in plan["dimensions"]:
            entity = next(e for e in entities if identity(e)["id"] == dim["id"])
            expected = math.hypot(dim["b"]["x"] - dim["a"]["x"], dim["b"]["y"] - dim["a"]["y"])
            assert math.isclose(entity.get_measurement(), expected, abs_tol=1e-9)
        for item in plan["furniture"]:
            entity = next(e for e in entities if identity(e)["id"] == item["id"])
            assert entity.dxftype() == "INSERT"
            assert entity.dxf.insert.isclose((item["x"], -item["y"], 0))
            assert math.isclose(entity.dxf.rotation, (360 - item["rotation"]) % 360)
        if "elevation" in floor:
            assert all(identity(e)["elevation"] == floor["elevation"] for e in entities)
    print(f"{path.name}: {len(entities)} entities; 0 errors, 0 fixes")


if __name__ == "__main__":
    paths = sorted(Path(sys.argv[1]).glob("*.dxf"))
    assert paths, "No DXF fixtures found"
    for path in paths:
        check(path)
    print(f"Validated {len(paths)} files with ezdxf {ezdxf.__version__}")
