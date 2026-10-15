# TrazoCasa

Prototipo local de un editor 2D de viviendas con estética de bosquejo. Vite + React + TypeScript, SVG y coordenadas en metros.

## Ejecutar

Requiere Node.js 20.19 o superior.

```sh
npm install
npm run dev
```

Abrir la URL local que muestra Vite. Para generar la versión de producción: `npm run build`.

## Herramientas

- **V**: seleccionar y arrastrar paredes, aberturas y etiquetas.
- **W**: pared con dos clics/toques. Shift restringe a horizontal o vertical; Escape cancela.
- **D / N**: agregar puerta / ventana sobre una pared.
- **T**: agregar nombre de ambiente; editarlo en el panel de detalles.
- **H**: desplazar el lienzo. Rueda o botones para zoom.
- Ctrl/Cmd Z: deshacer; Ctrl/Cmd Shift Z: rehacer; Suprimir: eliminar.
- Ctrl/Cmd S: descargar proyecto editable `.trazocasa` (JSON versionado).

Las paredes unidas comparten el movimiento de sus extremos. Las puertas y ventanas siguen su pared y no pueden superponerse ni exceder su longitud. Las medidas se editan en metros. Ajuste de posiciones a 10 cm.

## Persistencia

Autoguardado local en `localStorage`, con recuperación al recargar y manejo de errores. Se eligió para este prototipo pequeño sin imágenes; migrar a IndexedDB al agregar proyectos múltiples y recursos. Descargar el archivo crea una copia independiente; el almacenamiento del navegador puede eliminarse. No hay sincronización ni carga remota de planos. Abrir y crear proyectos se pueden deshacer. Los archivos importados se validan (versión, geometría, límites y aberturas).

Exportación vectorial SVG, encuadrando todo el plano. No se exportan los controles del editor.

## Alcance

Una planta; paredes rectas; puertas, ventanas y etiquetas. Compatible con mouse y eventos táctiles, con diseño adaptable. Sin Firebase, cuentas, métricas, donaciones ni servicios remotos configurados. La fuente de Google Fonts es opcional y tiene fuentes de sistema de respaldo.

No incluye todavía muebles, PDF/PNG, detección automática de ambientes/superficies, resolución de intersecciones de paredes, pinch-to-zoom ni documentación técnica de obra. La apariencia del trazo es esquemática; los datos conservan geometría precisa. Las longitudes mostradas corresponden al eje de las paredes.

## Verificación del modelo

`npm test` ejecuta las pruebas de geometría, aberturas y validación de archivos con el runner de Node y TypeScript. El build de producción comprueba los tipos de la aplicación.

