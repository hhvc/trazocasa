# TrazoCasa

Editor local de viviendas con planta 2D de estilo bosquejo y visualización 3D de plantas, muros, aberturas, losas y cubiertas planas o inclinadas. Vite + React + TypeScript, SVG, Three.js y coordenadas en metros.

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

Los nuevos archivos usan formato v7, con espesor de paredes, muebles y orientación de puertas. Los archivos v1, v2, v3, v4, v5 y v6 se migran al abrirlos conservando su geometría y apariencia. Las versiones anteriores del editor no pueden abrir archivos v7.

Exportación SVG y PNG (hasta 2400 px en el lado mayor), encuadrando paredes, arcos de puertas, textos y muebles girados, incluso fuera de la vivienda. El PNG incluye fondo claro; no exporta la cuadrícula ni los controles de selección.

## Alcance

Hasta 20 plantas; paredes rectas; puertas, ventanas, etiquetas y muebles. Compatible con mouse y eventos táctiles, con diseño adaptable. Hosting configurado con Firebase. Sin cuentas, métricas, donaciones ni sincronización remota de planos. La fuente de Google Fonts es opcional y tiene fuentes de sistema de respaldo.

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

Se calcula el área de contornos simples, incluidos los cóncavos. Se rechazan lados menores a 10 cm, superficies menores a 0,01 m², cruces y contactos del contorno consigo mismo. Los huecos interiores se dibujan desde los controles de losa y cubierta del contorno (ver la sección de huecos de escalera y patios). El área de superficie sigue midiendo el contorno completo.

Seleccioná el nombre o el relleno para editarlo. El panel permite renombrar; arrastrar el contorno o el nombre mueve la superficie, y los círculos ajustan sus vértices recalculando los m². Los cambios inválidos se cancelan al soltar. El nombre y el área se incluyen en SVG y PNG, y el encuadre contempla las superficies exteriores.

El área corresponde exactamente al contorno manual: si se eligen ejes de paredes, no representa superficie útil interior. No se descuentan espesores, no se detectan ambientes automáticamente y los contornos no siguen cambios en paredes. Las superficies pueden superponerse y no se suman como total de la vivienda. Crear una Habitación rectangular sigue creando paredes y una etiqueta; para medirla se utiliza Superficie.

Formato v6: guarda superficies y lee archivos v1–v5. Las cotas, superficies y demás elementos participan del autoguardado, archivos y deshacer/rehacer.


## Catálogo ampliado (0.7)

Se agregan bidet (0,36 × 0,55 m), bacha de baño (0,60 × 0,45 m), bacha de cocina con escurridor (0,80 × 0,50 m), silla (0,45 × 0,50 m), cama simple (0,90 × 1,90 m) y sofá de tres cuerpos (2,40 × 0,95 m). Son dimensiones iniciales orientativas y editables. Todos admiten movimiento, giro, duplicado, eliminación, historial, guardado y exportación SVG/PNG. Los símbolos son vistas superiores esquemáticas; no incluyen espacios de circulación ni conexiones sanitarias.

Se mantiene el formato v6. Los planos existentes conservan sus muebles; las versiones del editor anteriores a 0.7 no reconocen los seis tipos nuevos.


## Catálogo ampliado (0.8)

Televisor con base (1,20 × 0,30 m), bañera (0,70 × 1,70 m), mesa ratona redonda (diámetro 0,80 m), sillón individual (0,85 × 0,85 m), heladera (0,70 × 0,70 m), cocina de cuatro hornallas (0,60 × 0,60 m) y lavarropas de carga superior (0,60 × 0,65 m). Dimensiones orientativas editables; el televisor incluye su base y no representa pulgadas de pantalla. La mesa tiene un único diámetro y se rechazan archivos que la deformen en elipse. Todos conservan movimiento, rotación, duplicado, historial, guardado y exportaciones. Se mantiene formato v6; editores anteriores a 0.8 no reconocen estos siete tipos nuevos.


## Cabecera compacta (0.9)

Se unifican las dos barras superiores en una cabecera de 56 px (52 px en móvil). El nombre permanece editable; Menú reúne Nuevo, Abrir, Guardar archivo, exportaciones y ayuda. El desplegable se superpone al editor, se cierra al elegir una acción, tocar fuera o pulsar Escape, y se recorre con Tab. Guardar sigue disponible con Ctrl/Cmd S cuando el menú está cerrado.


## Plantas y escaleras (0.10)

El selector sobre el lienzo cambia de planta. El botón + abre la administración: crear una planta superior en blanco, copiar solo las paredes de la planta activa (sin aberturas) o duplicarla completa, renombrar y eliminar con confirmación. Siempre se conserva al menos una planta; máximo 20. Las nuevas plantas se agregan al final de la lista y comparten coordenadas, sin vínculos entre sus elementos.

El botón **Inferior** muestra paredes y escaleras de la planta inmediatamente anterior como referencia tenue, sin edición ni exportación. La vista conserva posición y zoom al cambiar de planta; Encuadrar plano ajusta la planta activa.

En Muebles se incorpora **Escalera recta**, inicialmente 1 × 3 m, con ancho, largo (Fondo), giro y duplicado editables. La flecha indica subida. Es un símbolo 2D: el número de peldaños dibujados es ilustrativo, sin cálculo de altura, huella, contrahuella, descansos, huecos o conexión estructural entre plantas. Colocá su representación en cada piso que la necesite.

El formato v7 guarda todas las plantas y la selección activa. Los archivos v1–v6 se migran a Planta baja conservando sus datos. El contenido de cada planta utiliza el esquema de geometría v6. El historial es del proyecto completo: deshacer/rehacer restaura ediciones y plantas eliminadas. Cambiar de planta por sí solo no agrega un paso al historial. Al crear un proyecto nuevo se reemplaza el proyecto completo, recuperable con Deshacer.

Guardar archivo y autoguardado incluyen todas las plantas; SVG/PNG exportan únicamente la planta activa y su nombre aparece en el archivo. Se admiten archivos de hasta 20 MB; el almacenamiento del navegador mantiene su propio límite, y se avisa si no puede guardar.


### Descanso de escalera

En Muebles, Descanso de escalera agrega una plataforma rectangular de 1 × 1 m. Su ancho y largo se editan independientemente (0,20 a 10 m); admite movimiento, giro y duplicado. Para una L, combiná dos tramos rectos a 90° junto al descanso; para una U, usá dos tramos paralelos con subida opuesta y un descanso que abarque ambos anchos. Las piezas se colocan manualmente y siguen siendo independientes. El descanso también aparece en la referencia Inferior y se guarda y exporta como los demás elementos. Se mantiene el formato v7; las versiones anteriores del editor no reconocen este nuevo tipo.

## Alineación de elementos

Al insertar o arrastrar muebles, escaleras y descansos, se ajustan sus bordes y centros a elementos cercanos de la planta activa. Las guías azules indican la alineación; las caras y ejes de paredes horizontales y verticales también sirven como referencia. La tolerancia es de 8 píxeles, con un máximo de 20 cm. Para objetos girados se utiliza su rectángulo envolvente respecto de los ejes del plano; no se unen automáticamente caras diagonales.

**Ajuste a elementos** permite desactivar esta función manteniendo el ajuste de 10 cm. Mantener **Alt** durante el movimiento permite ubicar libremente, sin ninguno de los dos ajustes. La cuadrícula controla únicamente su visibilidad. Las guías son temporales, no se guardan ni se exportan, y cada arrastre conserva un solo paso de Deshacer. Las piezas siguen siendo independientes; no se agrupan ni se evitan superposiciones.

## Selección múltiple y grupos (0.11)

Con Seleccionar, **Shift + clic** agrega o quita muebles y piezas de escalera; el botón **Selección múltiple** permite hacerlo también con toques. Desactivá ese botón para arrastrar la selección. Un clic en vacío o Limpiar selección la vacía. Paredes, cotas, superficies, textos y aberturas mantienen su edición individual.

El panel de detalles permite **Agrupar**, **Desagrupar**, **Girar conjunto 90°**, **Duplicar conjunto** y **Eliminar selección**. El giro cambia posiciones y orientaciones alrededor del centro del rectángulo envolvente; el movimiento y duplicado conservan las separaciones exactas. Las copias tienen grupos independientes. Cada acción ocupa un paso del historial. Para editar medidas individuales de un grupo, desagrupalo primero.

Al arrastrar varias piezas, la alineación usa el rectángulo del conjunto y excluye las piezas seleccionadas de los destinos de ajuste. Los grupos se limitan a la planta activa; no vinculan pisos. Se guardan en archivos y autoguardado como un `groupId` opcional en cada mueble, manteniendo formato v7 y la lectura de proyectos anteriores. Editores anteriores a 0.11 conservan la geometría, pero no la agrupación. Las selecciones y marcos son temporales y no se exportan.

## Escaleras prearmadas (0.12)

La herramienta **Escaleras (E)** inserta escaleras en L o U como un grupo de dos tramos rectos y un descanso. Permite indicar ancho común, largos independientes, fondo del descanso, sentido al subir y giro de 0°, 90°, 180° o 270°. En U se puede agregar una separación entre tramos: el descanso cubre ambos anchos y la separación. En L el ancho del descanso coincide con el tramo y su fondo puede ser mayor.

Las medidas de cada pieza van de 0,20 a 10 m. Para que las piezas encajen, el fondo del descanso debe ser al menos igual al ancho de los tramos; en U el ancho total no supera 10 m. Son límites del editor, no recomendaciones constructivas. La huella total se muestra antes de colocar y el puntero representa el centro de su rectángulo envolvente. La vista previa y el ajuste a elementos usan el conjunto completo.

Una inserción ocupa un solo paso de Deshacer y tres lugares del límite de 500 muebles por planta. Los grupos admiten movimiento, giro, duplicado y desagrupado para editar cada pieza. Se mantiene el formato v7, con los tipos de pieza ya existentes. Las flechas indican subida, sin cálculo de alturas, huellas, contrahuellas o normativa de obra.

## Google Drive (0.13)

Menú → Google Drive permite conectar una cuenta, abrir un proyecto, guardar cambios y guardar una copia. La descarga local y el autoguardado continúan disponibles. La integración requiere tres variables públicas de configuración: ver [Activar Google Drive](docs/google-drive.md) y `.env.example`.

Los archivos contienen todas las plantas y conservan formato v7. Se valida el contenido y se compara la versión remota antes de actualizar para detectar cambios previos de otro dispositivo. No hay edición simultánea ni sincronización automática. La sesión y el vínculo al archivo remoto no se conservan al recargar: para actualizar el original hay que volver a abrirlo desde Drive. El enlace del panel permite compartir desde Google sin que TrazoCasa modifique permisos.

Sin credenciales configuradas se muestra el estado no habilitado. Las pruebas con API y SDK simulados no sustituyen la validación con cuentas reales y dominios autorizados; la guía incluye los casos pendientes de activación.

## Editor gratuito y funcionamiento local

El flujo principal es gratuito y no exige una cuenta. El dibujo, el autoguardado, la exportación y la preparación de impresión se ejecutan en el navegador. El autoguardado no sustituye una copia descargada: puede perderse al borrar los datos del navegador. Los archivos `.trazocasa` incluyen todas las plantas y pueden compartirse o subirse manualmente a cualquier almacenamiento personal.

**Menú → Imprimir / Guardar PDF** prepara la planta activa en una ventana independiente, con título y nombre de planta. Permite imprimir o elegir Guardar como PDF en el diálogo del navegador. La hoja está preparada para A4 horizontal, con el dibujo ajustado al espacio disponible, sin escala técnica fija. No incorpora las otras plantas ni constituye documentación de obra. No utiliza servicios de conversión remotos.

Drive queda oculto por defecto, incluso si existen credenciales. Su implementación se conserva para una posible activación futura: requiere `VITE_ENABLE_GOOGLE_DRIVE=true` además de la configuración documentada. Esto reemplaza el comportamiento anterior del menú de 0.13.

El botón **Apoyar TrazoCasa** utiliza por defecto el enlace público `https://link.mercadopago.com.ar/trazocasa`. Puede reemplazarse con `VITE_DONATION_URL` y una nueva compilación. Definir esa variable vacía oculta el botón. Abre el proveedor en otra pestaña; TrazoCasa no recoge datos de tarjetas, verifica pagos ni desbloquea funciones. Las comisiones y condiciones corresponden al proveedor elegido.

Próximas mejoras propuestas: recuperación local más robusta, impresión a escala y plantillas profesionales. No se implementan todavía suscripciones, almacenamiento remoto propio ni servicios de IA.

## Mis proyectos: biblioteca local

Menú → Mis proyectos reúne los proyectos guardados en este navegador. El trabajo anterior se incorpora a la biblioteca al abrir esta versión. Cada proyecto nuevo o importado conserva su propia identidad; abrir desde la biblioteca inicia un historial de edición independiente. La miniatura representa las paredes de la planta activa.

Permite abrir, duplicar, renombrar proyectos no activos, descargar archivos individuales y mover proyectos no activos a una papelera recuperable. El título del proyecto activo se cambia desde el editor. La papelera no se vacía automáticamente y sus proyectos pueden restaurarse. No hay eliminación definitiva en esta versión.

Descargar respaldo completo incluye proyectos y papelera en un JSON. Importar respaldo acepta hasta 20 MB, valida todos los proyectos y agrega copias con nuevas identidades; no reemplaza los existentes. No debe abrirse como archivo de plano: se importa desde Mis proyectos.

El almacenamiento continúa en localStorage y está sujeto a la cuota del navegador. Un fallo se muestra como guardado pendiente y solicita descargar una copia; no se purgan trabajos automáticamente. Los datos pertenecen al navegador, perfil y origen del sitio: no se sincronizan entre dispositivos y pueden perderse al borrar los datos del navegador. Evitá editar el mismo proyecto en varias pestañas simultáneamente. El respaldo descargado sigue siendo necesario. No se guarda todavía un historial de versiones entre sesiones.

## Inicio, plantillas y primeros pasos

La bienvenida aparece una vez por navegador y puede reabrirse desde Menú → Inicio y plantillas. Permite continuar en el editor, abrir Mis proyectos o crear un proyecto con nombre propio, en blanco o con una plantilla de monoambiente, un dormitorio o dos dormitorios. La unidad sigue siendo metros. Las plantillas son ilustrativas y completamente editables; no constituyen diseños constructivos. Las miniaturas de la biblioteca muestran paredes, no una vista completa del mobiliario.

Crear guarda primero el trabajo actual y el nuevo proyecto en la biblioteca. Si falla el almacenamiento, conserva el editor actual y muestra un aviso. Una guía manual de cuatro pasos acompaña el dibujo sin bloquearlo: habitación, puerta, medidas y copia descargada. Omitir o finalizar se recuerda en este navegador; se puede iniciar otra vez desde la bienvenida. Avanzar en la guía no verifica automáticamente que se haya realizado la acción.

## Edición compacta en tablet y celular

Hasta 1024 px de ancho, el editor dedica el espacio principal al plano. La barra Plano / Herramientas / Detalles abre paneles plegables; Mover activa el desplazamiento del lienzo. Volver al plano cierra el panel conservando la herramienta elegida. Los ajustes de cuadrícula, medidas y alineación también están disponibles en Herramientas.

Zoom, historial y controles principales tienen áreas de al menos 44 px en esta vista. Los campos usan texto de 16 px y las paredes tienen un área táctil ampliada cuando el dispositivo declara un puntero de baja precisión. Se ignoran pulsaciones de punteros secundarios para reducir inserciones accidentales con varios dedos. No se incorpora zoom por pellizco: se utilizan los botones + / − y Encuadrar.

La compilación y las pruebas automatizadas fueron comprobadas. La revisión visual en navegador y la prueba física táctil quedaron pendientes: el navegador de revisión no pudo abrirse por un límite de uso de la aprobación automática.

## Impresión a escala

Menú → Imprimir / Guardar PDF abre una instantánea de la planta activa. La ventana permite elegir A4/A3, orientación horizontal/vertical y 1:50, 1:100 o Ajustar a página. Reserva márgenes de 12 mm y espacio para título, planta y referencia de escala. Los límites consideran todo el contenido exportado, con su margen gráfico.

En escala fija, 1 metro ocupa 20 mm a 1:50 o 10 mm a 1:100. Si el dibujo no cabe, se avisa y deshabilita Imprimir; no se reduce automáticamente ni se divide en varias hojas. Ajustar a página conserva la proporción y se identifica como sin escala fija. Su barra de control mide 5 cm en papel; en escala fija, la barra representa 1 metro del plano.

En el diálogo de impresión hay que seleccionar el mismo papel y orientación, usar 100 % / tamaño real y desactivar encabezados y pies del navegador. Comprobar la barra con una regla: el navegador y el controlador de impresora pueden aplicar ajustes ajenos a la aplicación. Los nombres largos se recortan en el encabezado para conservar las dimensiones de la hoja. El resultado sigue siendo un bosquejo, no documentación de obra. Pendiente validación visual de PDF e impresión física.

## Versiones locales recuperables

Mis proyectos → Guardar versión crea una instantánea con nombre. Versiones permite revisar fecha y miniatura de paredes, descargar una copia y restaurar con confirmación. La restauración guarda antes el estado actual como versión manual; si no puede conservarlo, cancela sin reemplazar el proyecto.

Cuando se guarda un cambio, se conserva automáticamente el estado anterior si no hay versiones o pasaron al menos cinco minutos desde la última. No se generan versiones al guardar sin cambios ni mediante un temporizador con el editor inactivo. Cada proyecto conserva hasta 20 versiones y aproximadamente 2 MB de texto serializado de historial. Se reemplazan las automáticas más antiguas para respetar esos límites, nunca las manuales. Si solo quedan manuales o una instantánea supera el límite, no se añaden más automáticas; las acciones manuales muestran el error. El guardado del proyecto actual continúa sujeto a la cuota del navegador. El panel explica los límites.

El respaldo completo incluye el historial; descargar un proyecto individual incluye solo su estado actual. Bibliotecas anteriores sin versiones siguen siendo compatibles. Las versiones son locales y también se pierden si se borran los datos del sitio: no sustituyen un respaldo descargado. No hay todavía eliminación individual de versiones manuales; al alcanzar el límite se puede descargar el proyecto e importarlo como un proyecto nuevo para empezar otro historial.

## Resumen de superficies

Menú → Resumen de superficies muestra cada contorno manual por planta, sus subtotales y la suma general. Los nombres repetidos no se fusionan. Se calcula con todos los decimales y se muestran dos; las superposiciones se suman, no se descuentan muros ni huecos y no se interpreta superficie construida. Si no hay contornos se ofrece Dibujar superficie. Ver cambia de planta, encuadra el plano y selecciona el contorno.

Descargar resumen CSV genera un archivo local con separador punto y coma, coma decimal y codificación UTF-8 con BOM, incluyendo los subtotales y una nota sobre su alcance. No transmite datos ni requiere servicios externos. Los nombres que podrían interpretarse como fórmulas en una planilla se exportan como texto. La validación automatizada cubre totales por planta, contornos superpuestos, plantas vacías y escape de CSV; la revisión visual sigue pendiente.

## Acciones rápidas sobre el plano

Al seleccionar un elemento aparece una barra junto a los controles inferiores del lienzo. Muebles, escaleras y grupos admiten Duplicar y Girar 90°; todos los elementos seleccionados admiten Eliminar y Quitar selección. Al eliminar una pared también se eliminan sus aberturas, igual que desde el inspector. Deshacer recupera la operación completa.

Las acciones reutilizan las validaciones del panel de detalles. La barra se oculta durante el arrastre, al usar otras herramientas, durante la guía inicial y cuando se abre un panel móvil. Los botones tienen un alto mínimo de 44 px. No forma parte del SVG ni de las exportaciones. La revisión visual sigue pendiente.

## Revisión de biblioteca en navegador (19/10/2026)

Se verificó creación desde plantilla, encuadre a 390 × 844, duplicación, envío a papelera y recuperación. Se detectó que los diálogos nativos prompt no funcionan en el navegador integrado. Guardar versión y Renombrar ahora utilizan formularios dentro de la biblioteca; restaurar usa una confirmación integrada. Se comprobó creación de versión, restauración y presencia de la versión automática de seguridad «Antes de restaurar» (conservada como manual).

La revisión no cubre aún impresión física, importación de respaldos ni gestos en hardware táctil. La imagen de referencia se pospone mientras se completan estas comprobaciones.

## Imagen de referencia por planta

Menú → Imagen de referencia permite cargar PNG/JPEG (hasta 10 MB y 40 megapíxeles), convertirlos localmente a JPEG de hasta 1400 px de lado y 400 000 caracteres, y conservarlos dentro del proyecto. Las transparencias originales se convierten a fondo blanco. No se suben imágenes a servicios externos. La compresión puede reducir detalles finos.

Se calibra marcando dos puntos sobre la vista previa e indicando su distancia real en metros. También permite indicar ancho total, posición X/Y de la esquina superior izquierda, opacidad y visibilidad. Aplicar encuadra la referencia. La imagen permanece fija al dibujar, sin selección ni arrastre; las paredes y muebles no se mueven al recalibrarla. No corrige perspectiva, no vectoriza ni admite PDF o giro en esta primera versión.

La imagen se incluye en archivos, biblioteca, versiones y respaldo; aumenta el uso del almacenamiento local. Se puede quitar con Deshacer disponible. Está excluida de PNG, SVG, impresión y resumen de superficies. Encuadrar plano continúa considerando el dibujo, no la referencia. Se mantiene el formato de proyecto actual con un campo opcional: versiones anteriores de TrazoCasa pueden descartar la referencia al guardar.

La visibilidad de la imagen también se cambia desde el botón Ocultar referencia / Mostrar referencia sobre el lienzo, debajo del selector de planta. Aparece siempre que esa planta tenga una imagen, incluso si está oculta. Conserva calibración, posición y transparencia; se guarda con el proyecto y admite Deshacer. El control no se exporta.

## Vehículos y mesa de luz

Muebles incluye Auto chico (1,70 × 3,80 m), Auto mediano (1,80 × 4,50 m), Camioneta tipo pickup (2,00 × 5,30 m) y Mesa de luz (0,50 × 0,40 m). Las medidas son editables y admiten giro, duplicación, grupos, alineación y exportación como el resto del catálogo. Los vehículos representan carrocerías orientativas, sin espacio de circulación ni apertura de puertas; conviene ajustar las dimensiones al modelo real y contemplar los espejos.

Se conserva el formato actual; editores anteriores no reconocen estos cuatro nuevos tipos de mobiliario.

## Parrilla y jardín

El catálogo incorpora Parrilla argentina (1,50 × 0,80 m, con rejilla y brasero lateral), Fogonero (1 × 1 m), Árbol de copa (3 × 3 m), Palmera (2,50 × 2,50 m), Arbusto (1 × 0,80 m) y Planta en maceta (0,50 × 0,50 m). Todos admiten medidas independientes, giro, duplicación, agrupación, alineación y exportación. Las medidas de vegetación representan su huella vista desde arriba, no el diámetro del tronco. Editores anteriores no reconocen estos nuevos tipos.

## Proyecciones de techos y aleros

Proyección (P) permite marcar puntos y Terminar abierta (mínimo dos) o Cerrar contorno (mínimo tres). Quitar último punto corrige el trazado; Cancelar o Escape lo descarta. En tablet/celular se vuelve al panel Herramientas para finalizar. Puede usarse la planta inferior como guía visual.

Con Seleccionar, arrastrar la línea mueve el conjunto; los círculos editan vértices. El panel de detalles permite asignar un nombre opcional y alternar abierto/cerrado. Los contornos se guardan por planta, admiten Deshacer y no siguen automáticamente paredes ni techos de otras plantas. Máximo 200 proyecciones por planta y 200 vértices por contorno, separados al menos 10 cm.

Mostrar/Ocultar proyecciones controla su visibilidad y su inclusión en PNG/SVG/impresión. No tienen relleno, no agregan superficies al resumen y no son paredes. El formato mantiene un campo opcional; editores anteriores pueden descartarlo al guardar. Validación visual pendiente.

### Finalizar proyecciones sobre el lienzo

Mientras haya puntos pendientes aparece una barra con Guardar abierta, Guardar cerrada, Quitar punto y Descartar. Cambiar de herramienta conserva el borrador durante esa sesión; Seguir dibujando vuelve al trazado. Enter guarda abierta, Shift + Enter cerrada, y tocar cerca del primer punto cierra un contorno de al menos tres vértices. Se ignoran clics consecutivos repetidos. Escape descarta explícitamente. Los borradores no se incluyen en archivos ni sobreviven a una recarga o cambio de planta/proyecto; la barra los identifica como «sin guardar».

## Modelo 3D y fachadas desde la planta

**Ver 3D**, junto al selector de plantas, abre el edificio completo. El selector **Alcance del modelo** alterna entre edificio completo y solo la planta activa. El lienzo ocupa la pantalla; **Niveles y opciones** despliega un inspector superpuesto. **Editar planta** vuelve al dibujo 2D para cambiar posiciones, largos, espesores y aberturas.

- En **3D**, arrastrar gira el modelo; botón derecho desplaza. Rueda o dos dedos acercan/alejan. Los botones de zoom y **Encuadrar** también están disponibles.
- **Frente, Contrafrente, Lateral izquierdo y Lateral derecho** muestran proyecciones ortográficas, sin perspectiva. Frente mira desde el borde inferior del plano. En estas vistas, arrastrar desplaza sin girar.
- Seleccionar un muro o abertura en el modelo, o elegirlo en el inspector, permite editar sus alturas en metros, con coma o punto decimal. Los mismos controles están disponibles en las propiedades del editor 2D.
- Los muros sin altura propia usan la altura general de su planta: inicialmente **2,80 m**. Cada muro puede sobrescribirla y luego volver a **Usar altura general**. Límites de altura: 0,50 a 20 m.
- Puertas: altura inicial **2,10 m**, siempre desde el piso. Ventanas: altura inicial **1,20 m** y antepecho **0,90 m**. Los huecos se recortan del muro. Se rechazan cambios que dejen una abertura por encima de su pared; ajustar primero la abertura si se necesita bajar el muro.
- Los cambios de altura participan de deshacer/rehacer, autoguardado, biblioteca, versiones y archivos `.trazocasa`. **Descargar proyecto editable** guarda el edificio completo; **Descargar vista PNG** exporta el encuadre actual, sin controles ni resaltado de selección.

Se muestran juntas las plantas en sus coordenadas originales, con muros, huecos, losas y cubiertas planas o inclinadas. Las cuatro fachadas y el PNG respetan el alcance y la visibilidad elegidos. Elegir un elemento del edificio activa su planta; los elementos copiados en distintos pisos se seleccionan y editan de forma independiente.

### Niveles de piso

En **Niveles y opciones → Elemento → Nivel y altura general** se edita el nivel absoluto del piso, entre -100 y 500 m. Admite coma decimal y **Usar nivel automático**. Por defecto la primera planta comienza en 0 m; cada planta siguiente se sitúa sobre la pared más alta de la anterior (o su altura general si está vacía), sumando el mayor espesor de sus losas de piso, con un mínimo de 20 cm. Por ejemplo: muros de 2,80 m y losa de 20 cm sitúan el piso superior a 3,00 m.

El cálculo sigue el orden del selector, no el nombre de la planta. Cambiar alturas, espesores o eliminar una planta recalcula los niveles automáticos que le siguen. Los niveles manuales se mantienen fijos; se permiten desniveles y superposiciones, sin detección automática de interferencias.

### Losas y techos

El botón **Losas y techos**, al comienzo de las herramientas de planta y en la barra superior de 3D, abre el panel de creación y edición.

1. Elegir **Dibujar losa** o **Dibujar cubierta**. Marcar el perímetro sobre la planta, incluyendo el alero deseado. **Guardar contorno**, Enter o tocar el primer punto confirma y abre las propiedades; **Quitar punto** corrige y **Cancelar** descarta el borrador.
2. También se puede elegir un **Contorno existente** en el panel. Una superficie puede tener losa, techo o ambos.
3. Activar las casillas necesarias, indicar espesores de 0,05 a 1 m y pulsar **Aplicar losa y techo**. La losa termina al nivel del piso y se extiende hacia abajo. El techo se mide por su cara inferior y tiene espesor vertical constante.
4. **Ver y editar contorno en planta** permite moverlo o cambiar sus vértices. Los elementos siguen el contorno; no siguen automáticamente los cambios de paredes. Desactivar una casilla y aplicar quita el volumen, conservando el contorno y sus huecos.

Formas de cubierta:

- **Plano**: altura inferior constante.
- **Un agua**: un plano inclinado. La orientación indica hacia dónde sube: 0° hacia la derecha del plano, 90° hacia abajo, 180° hacia la izquierda, 270° hacia arriba.
- **Dos aguas**: pendientes opuestas con cumbrera centrada. La orientación gira el par de pendientes; la cumbrera es perpendicular a esa dirección.
- **Tres aguas**: dos pendientes principales y una pendiente de cierre en un extremo. Girar 180° intercambia el extremo cerrado.
- **Cuatro aguas**: dos pares de pendientes opuestas sobre el rectángulo envolvente orientado. En una planta cuadrada de pendientes iguales, la cumbrera termina en un punto.
- **Varias aguas · una por lado**: faldones hacia adentro desde los lados del contorno convexo. Un pentágono genera cinco aguas; un hexágono, seis. Hasta 32 vértices; los lados colineales se fusionan.

La pendiente admite 1 a 200 %, con coma o punto decimal: 30 % significa subir 30 cm por cada metro horizontal. La altura del alero inferior admite 0,50 a 20 m y la cumbrera no puede superar 20 m sobre el piso. Las formas de una a cuatro aguas usan las proyecciones extremas del contorno en la orientación elegida; el recorte respeta el perímetro real y los huecos, incluso si no es rectangular.

Para techos compuestos o contornos en L/U, combinar varios paños con sus propias alturas, pendientes y orientaciones. No se calculan automáticamente limahoyas, uniones entre paños, drenajes ni encuentros estructurales. La opción por lados rechaza contornos cóncavos; no los transforma silenciosamente en otra forma. Las áreas de superficie y área neta siguen siendo proyecciones horizontales, no metraje real de material inclinado.

### Muros bajo cubiertas

**Ajustar muros a la cubierta** extiende o recorta la terminación hasta la cara inferior, incluyendo los hastiales triangulares. Se activa inicialmente al dibujar un techo nuevo y se conserva desactivado en cubiertas antiguas. Se considera cubierto el tramo cuyo eje está dentro o sobre el contorno y fuera de los huecos de techo. Si hay varios techos superpuestos con ajuste activo, se usa el inferior. Los tramos exteriores conservan su altura base.

La altura original del muro se conserva. Desactivar el ajuste recupera la terminación horizontal. Las puertas y ventanas deben caber bajo todo el perfil: si un cambio las deja fuera, se rechaza sin perder el proyecto. Los niveles automáticos superiores usan la altura máxima efectiva de los muros; los niveles manuales permanecen fijos.

**Ocultar losas / Ocultar cubiertas** solo cambia la visibilidad y la exportación PNG; ocultar el techo no deshace el ajuste de muros. La altura de la cubierta no cambia al editar la altura base de una pared. Los huecos se mantienen al inclinar el techo.

Los niveles, pendientes, orientación, ajuste y huecos se conservan en autoguardado, archivos, biblioteca, versiones y Deshacer/Rehacer. Duplicar una planta completa conserva sus contornos y propiedades, calculando un nivel nuevo; copiar solo paredes no copia sus cubiertas ni losas.

### Huecos de escalera y patios

1. Seleccionar el contorno de la superficie en 2D o en el inspector 3D.
2. En **Huecos de escalera y patios**, elegir **Losa**, **Cubierta** o **Losa y cubierta** y pulsar **Dibujar hueco en planta**. Desde 3D se vuelve al editor 2D.
3. Marcar al menos tres vértices dentro del contorno. **Cerrar hueco**, Enter o tocar el primer punto confirma. **Quitar punto** corrige el último vértice; Escape o **Cancelar hueco** descarta el dibujo sin guardar.
4. Seleccionar el hueco por su borde o nombre. Arrastrar lo mueve; los círculos editan sus vértices. El panel permite cambiar nombre, destino, ancho X y largo Y con coma o punto decimal. Las medidas escalan la forma desde su esquina mínima X/Y.
5. **Eliminar solo este hueco** conserva la superficie, su losa y su cubierta. Los cambios admiten Deshacer/Rehacer.

Cada contorno admite hasta 20 huecos, de 3 a 100 vértices. Deben quedar enteramente dentro del contorno y no pueden tocarlo, cruzarse, superponerse ni contener otros huecos. Mover la superficie mueve también sus huecos; cambiar un vértice exterior no los desplaza y se rechaza si los deja fuera.

Los huecos solo recortan los elementos activados del contorno y el destino elegido. No perforan muros ni generan escaleras automáticamente. Si el techo ajusta muros, los tramos bajo sus huecos conservan la altura base. Para una escalera entre pisos, dibujar el hueco en la losa del piso superior. Para un patio que atraviesa varias plantas, agregar el recorte a cada losa o cubierta correspondiente.

En 2D se muestran con borde discontinuo y nombre; el relleno de la superficie descuenta los huecos destinados a la losa. El inspector muestra **Losa neta** y **Cubierta neta**, descontando sus huecos respectivos. Las etiquetas de superficie y el resumen general conservan el área del contorno completo. Los huecos se conservan en archivos locales, autoguardado y copias de plantas completas; el visor 3D y la exportación PNG respetan los recortes.

Pendientes: encuentros automáticos entre paños, mobiliario 3D y cortes. La cuadrícula de referencia se muestra en 3D; las fachadas la omiten. No es documentación constructiva ni un cálculo estructural.

La visualización se procesa íntegramente en el navegador. Three.js se descarga como módulo separado al abrir el visor; requiere WebGL 2. Si no está disponible, se informa el problema y se puede continuar en 2D. El motor dibuja cuando cambia la escena o la cámara, sin una animación continua.

Se conserva el formato v7 del edificio y v6 de cada planta, agregando campos opcionales para alturas, antepechos, niveles de piso, losas, cubiertas (forma, pendiente, orientación y ajuste de muros) y huecos interiores. Los archivos anteriores abren con las alturas iniciales indicadas, sin cambiar sus coordenadas. Versiones anteriores del editor pueden descartar estos campos al guardar. Las antiguas vistas manuales ya no tienen acceso desde la interfaz; sus datos existentes se conservan al abrir y guardar proyectos, para evitar perder dibujos anteriores.

Las pruebas automatizadas cubren compatibilidad, persistencia, alturas inválidas, conservación de propiedades al editar/copiar muros y geometría de huecos en muros rectos o diagonales, niveles de varias plantas, selección independiente y extrusión de contornos cóncavos en ambos sentidos, recortes interiores con distintas orientaciones, validación de huecos, edición de vértices, movimiento y áreas netas.

Las pruebas de techos cubren una a múltiples aguas, orientación, contornos en ambos sentidos, límites de pendiente y altura, persistencia, hastiales, aberturas bajo pendientes, recortes atravesando cumbreras y geometría del espesor de los muros.
