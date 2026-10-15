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

- **V**: seleccionar y arrastrar paredes, aberturas, muebles y etiquetas.
- **R**: crear una habitación rectangular con dos esquinas o medidas exactas.
- **W**: pared con dos clics/toques. Shift restringe a horizontal o vertical; Escape cancela.
- **D / N**: agregar puerta / ventana sobre una pared.
- **T**: agregar nombre de ambiente; editarlo en el panel de detalles.
- **F**: catálogo de muebles; elegir uno y tocar el lienzo para colocarlo. Escape cancela.
- **H**: desplazar el lienzo. Rueda o botones para zoom.
- Ctrl/Cmd Z: deshacer; Ctrl/Cmd Shift Z: rehacer; Suprimir: eliminar.
- Ctrl/Cmd S: descargar proyecto editable `.trazocasa` (JSON versionado).

Las paredes unidas comparten el movimiento de sus extremos. Las puertas y ventanas siguen su pared y no pueden superponerse ni exceder su longitud. Las medidas se editan en metros. Ajuste de posiciones a 10 cm.

## Persistencia

Autoguardado local en `localStorage`, con recuperación al recargar y manejo de errores. Se eligió para este prototipo pequeño sin imágenes; migrar a IndexedDB al agregar proyectos múltiples y recursos. Descargar el archivo crea una copia independiente; el almacenamiento del navegador puede eliminarse. No hay sincronización ni carga remota de planos. Abrir y crear proyectos se pueden deshacer. Los archivos importados se validan (versión, geometría, límites y aberturas).

Los nuevos archivos usan formato v3, con muebles y orientación de puertas. Los archivos v1 y v2 se migran al abrirlos sin alterar la geometría, las etiquetas ni el aspecto de sus puertas. Las versiones anteriores del editor no pueden abrir archivos v3.

Exportación SVG y PNG (hasta 2400 px en el lado mayor), encuadrando paredes, arcos de puertas, textos y muebles girados, incluso fuera de la vivienda. El PNG incluye fondo claro; no exporta la cuadrícula ni los controles de selección.

## Alcance

Una planta; paredes rectas; puertas, ventanas, etiquetas y muebles. Compatible con mouse y eventos táctiles, con diseño adaptable. Sin Firebase, cuentas, métricas, donaciones ni servicios remotos configurados. La fuente de Google Fonts es opcional y tiene fuentes de sistema de respaldo.

No incluye todavía PDF, detección automática de ambientes/superficies, resolución de intersecciones de paredes, pinch-to-zoom ni documentación técnica de obra. La apariencia del trazo es esquemática; los datos conservan geometría precisa. Las longitudes mostradas corresponden al eje de las paredes.

## Verificación del modelo

`npm test` ejecuta las pruebas de geometría, aberturas y validación de archivos con el runner de Node y TypeScript. El build de producción comprueba los tipos de la aplicación.


## Muebles

Catálogo inicial: cama doble, sofá, mesa, escritorio, placard e inodoro. Se pueden mover, duplicar, eliminar y girar (90° o ángulo libre). Ancho y fondo editables entre 0,20 y 10 metros; se aceptan coma o punto decimal. Máximo 500 muebles por plano. Todas las modificaciones participan de deshacer/rehacer y del guardado local o en archivo.

Las dimensiones representan la huella en el piso. No se comprueban colisiones entre muebles o con paredes; el usuario decide la distribución. Las medidas de catálogo son valores iniciales editables.


## Habitaciones rectangulares y puertas (0.3)

La herramienta **Habitación (R)** crea cuatro paredes y un nombre centrado en una sola acción de deshacer/rehacer. Dos modos:

- **Dos esquinas:** tocar dos puntos opuestos; admite cualquier dirección de dibujo.
- **Medidas exactas:** ingresar ancho y fondo (0,50 a 100 m, con coma o punto decimal), y tocar la esquina superior izquierda.

Las medidas corresponden a ejes de paredes, no a superficie útil. Las paredes y el nombre se editan luego por separado: no se crea una entidad de habitación ni se calcula superficie automática. Se reutilizan paredes completamente coincidentes, conservando sus aberturas. Se rechazan duplicados completos y superposiciones colineales parciales; las intersecciones entre paredes no se dividen automáticamente. Escape o Cancelar trazado descartan la primera esquina sin modificar el proyecto.

Al seleccionar una puerta, **Cambiar lado de apertura** refleja el arco al otro lado de la pared y **Cambiar bisagra** intercambia el extremo de giro. Ambas opciones se combinan, participan del historial y se conservan en archivos, autoguardado, SVG y PNG.

La suite `npm test` incluye compatibilidad v1/v2, las cuatro orientaciones de puertas, creación de rectángulos, paredes compartidas con aberturas y rechazo atómico de geometría inválida.
