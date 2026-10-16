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

Los nuevos archivos usan formato v6, con espesor de paredes, muebles y orientación de puertas. Los archivos v1, v2, v3, v4 y v5 se migran al abrirlos conservando su geometría y apariencia. Las versiones anteriores del editor no pueden abrir archivos v6.

Exportación SVG y PNG (hasta 2400 px en el lado mayor), encuadrando paredes, arcos de puertas, textos y muebles girados, incluso fuera de la vivienda. El PNG incluye fondo claro; no exporta la cuadrícula ni los controles de selección.

## Alcance

Una planta; paredes rectas; puertas, ventanas, etiquetas y muebles. Compatible con mouse y eventos táctiles, con diseño adaptable. Hosting configurado con Firebase. Sin cuentas, métricas, donaciones ni sincronización remota de planos. La fuente de Google Fonts es opcional y tiene fuentes de sistema de respaldo.

No incluye todavía PDF, detección automática de ambientes, resolución de intersecciones de paredes, pinch-to-zoom ni documentación técnica de obra. La apariencia del trazo es esquemática; los datos conservan geometría precisa. Las longitudes mostradas corresponden al eje de las paredes.

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

## Edición de paredes (0.4)

Al seleccionar una pared aparecen sus extremos **A** y **B**. Arrastrarlos modifica la geometría y mantiene las esquinas compartidas y los encuentros en T existentes. Un extremo que termina sobre otra pared puede deslizarse sobre ella; para separarlo en otra dirección, primero dividí la pared principal en ese encuentro. No se resuelven automáticamente intersecciones nuevas.

Las puertas y ventanas mantienen su distancia al extremo fijo cuando cambia la longitud; al trasladar una pared completa, acompañan el desplazamiento. Se rechazan cambios que produzcan aberturas fuera de la pared, superposiciones o tramos demasiado cortos.

- **Espesor:** editable entre 5 y 60 cm. Las paredes nuevas usan 15 cm; las antiguas sin espesor explícito conservan su apariencia de 10,5 cm. Se refleja en el lienzo, SVG y PNG.
- **Dividir pared:** ingresar la distancia en metros desde A. Conserva el espesor y la posición y orientación de las aberturas. Cada tramo debe medir al menos 20 cm; el corte debe dejar 2,5 cm de separación con puertas y ventanas.
- Los cambios participan de deshacer/rehacer, autoguardado y archivos `.trazocasa`.

Las longitudes siguen representando ejes de paredes, no medidas interiores útiles. El espesor es una propiedad gráfica y no implica verificación constructiva.


## Cotas manuales (0.5)

Elegí **Cota (C)** y marcá tres puntos: inicio, final y ubicación de la línea de medida. La distancia se calcula entre los dos primeros puntos, también en diagonal. Los puntos se ajustan a extremos de paredes cercanos o a la cuadrícula de 10 cm. Escape cancela sin agregar una cota.

Al seleccionar una cota, arrastrá A/B para cambiar sus puntos o la línea para ajustar su separación. El panel permite ingresar la separación en metros, con coma o punto; los valores negativos cambian el lado. Se admiten longitudes desde 10 cm, separaciones entre -100 y 100 m y hasta 500 cotas por proyecto.

Son anotaciones independientes: no siguen automáticamente las paredes al modificarlas. Participan de deshacer/rehacer, eliminación, autoguardado y archivos. Se incluyen en SVG y PNG aunque se oculten las medidas automáticas de paredes. El encuadre incluye las cotas exteriores. El formato v5 conserva compatibilidad de lectura con v1–v4; editores anteriores no abren archivos v5.


## Superficies manuales (0.6)

Elegí **Superficie (S)** y marcá los vértices en orden. Cerrá tocando el primer punto, con **Cerrar superficie** o Enter. **Quitar último punto** y Retroceso corrigen el trazado; Escape o Cancelar lo descartan sin modificar el plano. Se admiten de 3 a 100 vértices y hasta 200 superficies por proyecto.

Se calcula el área de contornos simples, incluidos los cóncavos. Se rechazan lados menores a 10 cm, superficies menores a 0,01 m², cruces y contactos del contorno consigo mismo. No se admiten huecos interiores.

Seleccioná el nombre o el relleno para editarlo. El panel permite renombrar; arrastrar el contorno o el nombre mueve la superficie, y los círculos ajustan sus vértices recalculando los m². Los cambios inválidos se cancelan al soltar. El nombre y el área se incluyen en SVG y PNG, y el encuadre contempla las superficies exteriores.

El área corresponde exactamente al contorno manual: si se eligen ejes de paredes, no representa superficie útil interior. No se descuentan espesores, no se detectan ambientes automáticamente y los contornos no siguen cambios en paredes. Las superficies pueden superponerse y no se suman como total de la vivienda. Crear una Habitación rectangular sigue creando paredes y una etiqueta; para medirla se utiliza Superficie.

Formato v6: guarda superficies y lee archivos v1–v5. Las cotas, superficies y demás elementos participan del autoguardado, archivos y deshacer/rehacer.
