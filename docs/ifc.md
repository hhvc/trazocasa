# Exportación BIM: edificio IFC4

En **Menú → Exportar edificio BIM (IFC)…**, revisar el recuento y los avisos, y descargar el edificio completo. La exportación se genera en el navegador a partir de `Building` / `Plan`; no depende del SVG, de Three.js ni del estado temporal del recorrido. No requiere un servicio ni nuevas dependencias de ejecución.

## Elementos y relaciones

| Datos de TrazoCasa | IFC |
| --- | --- |
| Proyecto local | `IfcProject` → `IfcSite` → `IfcBuilding` |
| Plantas | `IfcBuildingStorey`, relacionadas por `IfcRelAggregates` |
| Muros | `IfcWall` con espesor, orientación y perfil superior |
| Superficies con losa | `IfcSlab` de tipo `FLOOR` |
| Superficies con cubierta | `IfcRoof`, con geometría plana o inclinada |
| Puertas / ventanas | `IfcDoor` / `IfcWindow`, con ancho y alto explícitos |
| Hueco de abertura | `IfcOpeningElement` + `IfcRelVoidsElement` hacia el muro + `IfcRelFillsElement` hacia la puerta/ventana |
| Hueco de losa / cubierta | `IfcOpeningElement` + `IfcRelVoidsElement` hacia la placa correspondiente |
| Pertenencia a planta | `IfcRelContainedInSpatialStructure` para los elementos constructivos; los huecos se vinculan a sus anfitriones |

Una superficie que tiene losa y cubierta produce dos elementos con identidades distintas. Un hueco destinado a ambas produce dos aberturas relacionadas con sus respectivas placas. Las superficies sin losa ni cubierta no se convierten en `IfcSpace` ni en elementos constructivos.

## Unidades, ejes y sólidos

- Archivo STEP ISO 10303-21, esquema **IFC4**. No declara certificación ni conformidad con una MVD específica.
- Unidades SI: metros, metros cuadrados, metros cúbicos y radianes. Geometría a escala 1:1.
- Transformación: **`(editor x, editor y, altura) → (x, -y, altura)`**. Eje Z vertical, origen conservado, sin recentrar ni georreferenciar.
- La posición de cada planta usa el nivel absoluto de `floorLevels`. Los muros empiezan en el piso; las losas se extienden hacia abajo desde ese nivel. Las cubiertas respetan su altura inferior y espesor vertical.
- Las posiciones de productos son relativas a su planta o anfitrión. El nivel se aplica una sola vez, tanto en `IfcBuildingStorey.Elevation` como en su posición espacial coherente.
- Muros y placas se construyen con perfiles cerrados y `IfcExtrudedAreaSolid`. Los ajustes de muros a cubiertas usan `IfcBooleanClippingResult` y planos de corte. Las cubiertas inclinadas usan sólidos booleanos entre sus envolventes inferior y superior; admiten los cinco perfiles de cubierta existentes y contornos cóncavos permitidos por el modelo.
- Los huecos se representan como relaciones de vaciado reales, no como una textura ni una malla previamente recortada. No se exporta una única malla visual genérica.

## Identidad y propiedades

Los `GlobalId` son deterministas: hash SHA-256 truncado a 128 bits, con namespace de exportación `TrazoCasa-IFC-v1`, y codificación IFC de 22 caracteres. Las claves se codifican como arrays JSON para evitar ambigüedad entre IDs que contengan separadores.

- Plantas: ID persistente de planta.
- Elementos: ID de planta + clase de origen + ID del elemento. Nombre, posición, medidas, orden de listas y fecha de exportación no participan.
- Un muro con perfil dividido sigue siendo un único `IfcWall` con varios sólidos de representación.
- Abrir el mismo proyecto v7 en otra biblioteca local conserva los GUID de plantas y elementos. El proyecto, sitio y edificio usan el ID de la biblioteca local; estas tres raíces pueden cambiar al importar el archivo como un nuevo proyecto local. El formato `Building` v7 no tiene un ID de edificio transportable independiente.
- Los archivos antiguos que todavía no tienen plantas reciben IDs al migrar. Guardar primero como `.trazocasa` v7 conserva esa identidad para intercambios posteriores.
- Los números `#123` del STEP identifican referencias internas del archivo; no son identidades estables.

`TrazoCasa_Source` conserva IDs originales, planta, tipo de origen y anfitrión cuando corresponde. `TrazoCasa_Geometry` conserva dimensiones, espesor, altura nominal/máxima, antepecho, forma de cubierta, pendiente, dirección y los datos disponibles de acabado. Bisagra y sentido de apertura se conservan como propiedades propias de TrazoCasa; el tipo de operación nativo de puerta queda sin definir. Puertas y ventanas se representan cerradas mediante paneles simplificados, no mediante familias paramétricas de carpintería.

Los colores declarados se incluyen también como estilos IFC. Los acabados son etiquetas del modelo, no una estratigrafía certificada de materiales. No se infieren propiedades estructurales, térmicas, acústicas ni de resistencia al fuego. `TrazoCasa_Export` registra el contrato de coordenadas, la versión y los límites de exportación. Las fechas de procedencia corresponden a la generación del archivo, no a una fecha de construcción.

## Alcance y límites visibles

El diálogo informa las omisiones según el contenido: mobiliario y escaleras del catálogo, personas, vehículos, vegetación, contornos sin placas, huecos sin anfitrión constructivo, textos, cotas, proyecciones, imágenes y vistas auxiliares. Para dibujos 2D, usar DXF. No se crean ambientes BIM ni superficies útiles desde los contornos manuales.

La exportación es de salida: IFC no reemplaza el archivo editable `.trazocasa`, y no modifica el proyecto, su versión de formato, guardado, historial ni planta activa. La edición de sólidos, bloques, relaciones y propiedades depende del programa receptor. No se promete equivalencia con familias nativas de Revit/Archicad ni documentación técnica de obra validada.

## Validación reproducible

Desde la carpeta real `C:\Users\hecto\Programación\ProyectoInmobiliarias\TrazoCasa`:

```powershell
npm test
npm run build

$env:TRAZOCASA_IFC_FIXTURES = Join-Path $env:TEMP 'trazocasa-ifc-fixtures'
node --test src/ifc.test.mjs
$ifcVenv = Join-Path $env:TEMP 'trazocasa-ifc-reader'
python -m venv $ifcVenv
& "$ifcVenv\Scripts\python.exe" -m pip install ifcopenshell==0.9.0.post1 pytest==9.2.0
& "$ifcVenv\Scripts\python.exe" scripts/validate-ifc.py $env:TRAZOCASA_IFC_FIXTURES
Remove-Item Env:TRAZOCASA_IFC_FIXTURES
```

Pruebas de Node: GUID y codificación STEP, estructura espacial, clases y relaciones, estabilidad de identidad ante cambios, cubiertas, omisiones, determinismo con fecha fija, inmutabilidad, referencias y datos inválidos. Total de la suite: **277 pruebas**, incluidos 12 casos IFC.

El auditor externo usa IfcOpenShell 0.9.0.post1 con reglas **EXPRESS** y su motor geométrico. Verifica esquema, unicidad de GUID, unidades, niveles, contención, relaciones de vaciado/relleno, reconstrucción de sólidos, volúmenes analíticos, orientación/posición, Unicode y ausencia de caras sobre el interior de los huecos.

Resultado de los casos sintéticos: **10 archivos, 51 sólidos, sin incidencias de esquema/EXPRESS ni errores geométricos**. Incluyen dos plantas con nivel negativo y muro oblicuo, modelo vacío, ejemplo existente, contornos invertidos, cubiertas plana/a un agua/a dos aguas/a tres aguas/a cuatro aguas/por perímetro, y cubierta cóncava con hueco. Casos de control: muro con puerta y ventana = 2,912 m³; losa perforada = 5,75 m³; cubierta perforada = 4,60 m³.

### Validación pendiente en aplicaciones receptoras

La reconstrucción con IfcOpenShell no sustituye una revisión en la aplicación de destino. Quedan pendientes la descarga completa y la revisión visual en escritorio/móvil: el navegador integrado no respondió y el acceso de Computer Use a Chrome venció sin habilitarse. La validación visual pendiente de DXF tampoco se declara resuelta.

Abrir `complete.ifc`, `roof-gable.ifc` y `concave-gable.ifc` en el visor/editor BIM que se vaya a utilizar. Revisar árbol por plantas, unidades, niveles, clases, selección individual, vaciados, cubierta inclinada, dimensiones y propiedades de origen. Exportar dos revisiones con una pared movida y comprobar la conservación de GUID. Registrar nombre y versión de la aplicación, soporte de operaciones booleanas, y qué propiedades/relaciones conserva al guardar y reabrir.

Referencias: [IFC4 de buildingSMART](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/), [procesamiento geométrico de IfcOpenShell](https://docs.ifcopenshell.org/ifcopenshell-python/geometry_processing.html) y [validador de IfcOpenShell](https://docs.ifcopenshell.org/autoapi/ifcopenshell/validate/index.html).
