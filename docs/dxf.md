# Exportación CAD: DXF por planta

En **Menú → Exportar plano CAD (DXF)…**, elegir una planta y descargar su archivo. El selector comienza en la planta activa y permite exportar las demás sin cambiar el editor. La generación usa exclusivamente `Building` / `Plan`; no lee SVG, Three.js, zoom, selección ni el estado temporal del recorrido.

## Contrato geométrico

- DXF 2007 (`AC1021`), texto UTF-8, espacio modelo a escala 1:1. Sin dependencias de ejecución adicionales.
- Una unidad = **un metro** (`$INSUNITS = 6`, `$MEASUREMENT = 1`). Las coordenadas no se multiplican por 1000.
- Editor → CAD: **`(x, y) → (x, -y, 0)`**. Se conserva el origen; no se recentra la planta. Los giros de mobiliario se invierten y los arcos de puerta ajustan su sentido a la reflexión.
- Cada archivo es un dibujo 2D independiente en **Z = 0**. El nivel absoluto calculado por `floorLevels` se conserva como metadato, no como elevación geométrica. No es un modelo 3D apilado.
- Los identificadores originales se conservan en XDATA bajo `TRAZOCASA`: concatenar, en orden, los valores `1000` y analizar el JSON. Incluye `schema: 1`, `floorId`, `elevation`, `kind`, `id` y, según el elemento, `wallId`, `surfaceId`, `target`, `furnitureKind` o `groupId`. Un muro puede producir varias entidades con el mismo `id`.
- Los handles DXF y nombres internos de bloques identifican entidades dentro del archivo. No sustituyen a los identificadores del proyecto ni constituyen GUID IFC.
- La exportación no modifica la versión del formato, el proyecto, el guardado, la planta activa ni el historial.

## Capas y entidades

| Capa | Contenido |
| --- | --- |
| `MUROS` | Polilíneas cerradas con el espesor del muro, interrumpidas en puertas y ventanas. Los encuentros entre muros no se fusionan. |
| `ABERTURAS` | Puertas con hoja y arco de 90°; ventanas con contorno y ejes. Conserva ancho, posición, orientación y bisagra. |
| `COTAS` | `DIMENSION` alineadas y no asociativas, con puntos de definición, medida geométrica, estilo y bloque gráfico. |
| `TEXTOS` | `MTEXT` editable, con Unicode y saltos de línea; el texto del proyecto se trata como texto literal. |
| `SUPERFICIES` | Contornos cerrados, nombre y área **bruta**. |
| `MOBILIARIO` | Bloques `INSERT` con huella simplificada, medidas y giro. Escaleras con peldaños y flecha de subida; la mesa redonda usa un círculo. |
| `HUECOS_LOSA` | Contornos de huecos destinados a losas. |
| `HUECOS_CUBIERTA` | Contornos de huecos destinados a cubiertas. Un hueco para ambos destinos aparece en ambas capas. |
| `AUX_PROYECCIONES` | Proyecciones abiertas/cerradas, expresamente identificadas como dibujo auxiliar. |

Las entidades internas de bloques usan la capa `0` y heredan la del bloque insertado. La aplicación receptora decide cómo presentar y editar cotas, bloques y textos. No se promete equivalencia con objetos nativos de todos los programas CAD/BIM.

## Alcance y omisiones

El diálogo muestra avisos según el contenido de la planta. El mobiliario conserva su huella, no todos los detalles de los símbolos del catálogo. Las superficies son contornos manuales; su área no descuenta huecos, muros ni superposiciones, y no equivale a un ambiente BIM ni a superficie útil. Las cotas manuales siguen siendo independientes de los muros.

No se exportan imágenes de referencia, vistas complementarias del edificio, medidas automáticas del editor, retículas, guías temporales ni controles de selección. Losas y cubiertas se representan por su contorno en planta y los huecos; no se exportan pendientes, sólidos, alturas, espesores verticales, materiales ni acabados. Tampoco se genera documentación de obra validada. **IFC queda para la siguiente etapa**: esta exportación no intenta reemplazar elementos constructivos BIM con mallas.

## Verificación reproducible

Ejecutar desde la carpeta real del proyecto:

```powershell
npm test
npm run build

# Archivos sintéticos: planta completa, ejemplo, planta vacía y cuatro puertas.
$env:TRAZOCASA_DXF_FIXTURES = Join-Path $env:TEMP 'trazocasa-dxf-fixtures'
node --test src/dxf.test.mjs

# Lector independiente en un entorno temporal, fuera de node_modules.
$dxfVenv = Join-Path $env:TEMP 'trazocasa-dxf-reader'
python -m venv $dxfVenv
& "$dxfVenv\Scripts\python.exe" -m pip install ezdxf==1.4.5
& "$dxfVenv\Scripts\python.exe" scripts/validate-dxf.py $env:TRAZOCASA_DXF_FIXTURES
Remove-Item Env:TRAZOCASA_DXF_FIXTURES
```

La auditoría usa `ezdxf.readfile`, sin recuperación automática, y exige cero errores y cero reparaciones. Verifica unidades, capas, identidades, lectura de bloques/cotas, texto Unicode literal, medida de cotas, posición/giro de muebles y nivel de planta. Las pruebas de Node también cubren muros oblicuos, 40 combinaciones de orientación/bisagra/apertura, ambos signos del desplazamiento de cotas, aislamiento de plantas, contornos, identificadores largos, determinismo e inmutabilidad.

Resultado registrado: **265 pruebas aprobadas**, incluidos 14 casos DXF; siete DXF auditados con ezdxf 1.4.5, sin errores ni reparaciones. Se comprobó la presencia del menú y del diálogo en el navegador local. La herramienta de navegador se bloqueó durante la comprobación de descarga; queda pendiente verificar la descarga completa y el diseño final en escritorio/móvil. No se pudo completar la apertura visual en una aplicación CAD receptora.

### Comprobación pendiente en CAD receptor

Abrir `complete.dxf`, `example.dxf` y las cuatro variantes de puertas en la versión concreta de AutoCAD/LibreCAD/QCAD que se utilice. Ajustar la vista a la extensión del dibujo, medir el muro de ejemplo (6 m), comprobar la cota (6.00 m), tildes, capas, huellas y sentido de puertas. Editar una cota y un bloque; guardar, cerrar y reabrir. Registrar aplicación/versión y cualquier pérdida de formato. Esta prueba no queda sustituida por la auditoría estructural.

Referencias: [cabecera y unidades DXF de Autodesk](https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm), [cotas alineadas](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-7A123D5D-AC98-4A9A-A8CF-1A7EF5030418.htm), [XDATA](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-A2A628B0-3699-4740-A215-C560E7242F63.htm) y [lector ezdxf](https://ezdxf.readthedocs.io/en/stable/drawing/management.html).
