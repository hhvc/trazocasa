# Activar Google Drive en TrazoCasa (0.13)

La integración está implementada, pero necesita configuración de Google Cloud para conectarse a cuentas reales. No utiliza cuentas de servicio ni un secreto OAuth en el navegador. Firebase Hosting sigue alojando la aplicación; Firebase Authentication no es necesario para esta autorización independiente.

Cada usuario conecta su propia cuenta de Google y guarda sus proyectos en su propio Drive. La configuración de Google Cloud identifica a TrazoCasa como aplicación: no es una cuenta de almacenamiento común y los usuarios no tienen que crear sus propios clientes OAuth.

## Configuración del propietario

1. Abrí Google Cloud Console y elegí el proyecto de TrazoCasa (podés utilizar el mismo proyecto asociado a Firebase). Anotá el **número de proyecto**, no el ID de texto.
2. Habilitá **Google Drive API** y **Google Picker API** en ese proyecto.
3. Configurá Google Auth Platform: nombre TrazoCasa, correo de soporte, audiencia y datos de marca requeridos. En modo de prueba agregá las cuentas que vayan a probarlo. Para disponibilidad pública, completá los requisitos de publicación que indique Google, incluidos los enlaces y dominios que solicite.
4. Creá un **ID de cliente OAuth para aplicación web**. Agregá los orígenes JavaScript exactos donde se utilizará: por ejemplo `http://127.0.0.1:5173` para desarrollo y los dominios HTTPS de tu despliegue. `localhost` y `127.0.0.1` son orígenes distintos; cada puerto debe coincidir. Este flujo usa una ventana emergente, no una ruta de redirección propia.
5. Declarar el alcance `https://www.googleapis.com/auth/drive.file`. No es necesario acceso completo a Drive. El usuario autoriza los archivos que crea con la app o elige en el selector.
6. Creá una clave de API para el navegador, restringida a las API requeridas y los referentes HTTP del sitio. Seguí las indicaciones actuales de Google Picker para los referentes, incluido `https://docs.google.com/*` cuando corresponda al iframe de Picker. El cliente OAuth, la clave y el número deben pertenecer al mismo proyecto.
7. Copiá `.env.example` como `.env.local` y completá:

```dotenv
VITE_GOOGLE_CLIENT_ID=el-cliente-web.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=la-clave-publica-restringida
VITE_GOOGLE_APP_ID=el-numero-de-proyecto
```

Estos tres valores se incluyen en el JavaScript público por diseño. Nunca agregues un secreto de cliente, credenciales de servicio ni tokens. `.env.local` está excluido de Git. Si compilás en CI, configurá allí estas variables.

8. Reiniciá Vite para desarrollo. Para publicar, ejecutá `npm run build` con las variables presentes y desplegá `dist` con tu flujo habitual de Firebase. Configurar variables después de compilar no cambia el paquete ya generado.
9. En TrazoCasa, **Menú → Google Drive → Conectar Google Drive**. El navegador debe permitir la ventana de Google. Si configurás encabezados COOP, no bloquees la comunicación con la ventana OAuth; consultá las recomendaciones de Google Identity Services.

Sin estas variables, el panel explica que Drive no está habilitado y permite descargar el proyecto local. No carga los SDK de Google ni simula una conexión.

## Funcionamiento

- Abrir usa Google Picker y valida el contenido `.trazocasa`/JSON, hasta 20 MB. Antes de reemplazar el proyecto visible permite descargarlo o cancelar; el historial conserva el anterior.
- El primer guardado y Guardar una copia crean un archivo en Mi unidad. Podés moverlo después desde Drive. Los guardados siguientes de esa sesión actualizan el ID asociado, aunque hayas cambiado el nombre del proyecto.
- El guardado incluye todas las plantas, grupos y piezas. El autoguardado del navegador continúa siendo local y no sincroniza con Drive.
- El token y la asociación remota solo viven en memoria. Al recargar, conectá y **abrí desde Drive** para volver a asociar el archivo antes de actualizarlo. Un proyecto nuevo o importado desde disco no hereda el archivo remoto del anterior. Los cambios normales y Deshacer dentro del mismo proyecto conservan la asociación.
- Si se cambia de cuenta, se descarta la asociación al archivo de la cuenta anterior. Desconectar borra la sesión de la aplicación, no cierra la sesión general de Google ni revoca el consentimiento ya otorgado; este se administra desde la cuenta de Google.
- Los archivos de solo lectura se pueden abrir y guardar como una copia propia. La app no modifica permisos de uso compartido: el enlace Ver archivo y compartir en Drive abre el archivo para administrar esos permisos en Google.
- Se compara la versión remota antes de actualizar. Si cambió, se bloquea la sobrescritura y se propone abrir la versión actual o guardar una copia. También se comprueba la versión antes y después de descargar. No hay fusión ni edición simultánea: el chequeo previo no constituye un bloqueo atómico entre clientes; evitá guardar simultáneamente sobre el mismo archivo.
- Las cargas utilizan una sesión de subida reanudable en un único envío; no hay reintento automático ni reanudación después de recargar. Ante una interrupción no se marca la copia como guardada. Revisá Drive antes de reintentar, porque el servidor puede haber recibido el archivo aunque no haya llegado la confirmación.

## Verificación con una cuenta real (pendiente de las credenciales)

1. Autorizar una cuenta de prueba y crear un archivo con dos plantas y un grupo.
2. Guardar cambios y comprobar que se actualiza el mismo archivo. Guardar una copia y comprobar que aparece otro archivo.
3. Recargar, conectar y abrir el archivo; comprobar plantas y grupos.
4. Abrir el mismo archivo en otro navegador, modificar y guardar. Volver al primero y confirmar que aparece el conflicto al guardar.
5. Compartir con una segunda cuenta en lectura: debe poder abrirlo y guardar una copia, pero no actualizar el original. Probar también permiso de edición.
6. Probar cancelar OAuth y Picker, caducidad de sesión, modo sin conexión, móvil y el dominio Firebase publicado.

Las pruebas automatizadas usan respuestas HTTP y SDK simulados. No reemplazan esta comprobación real de OAuth, Picker, políticas de Google o permisos compartidos.

## Referencias oficiales

- [Permisos mínimos de Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Autorización en navegador con Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Ejemplo oficial de Google Picker](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample)
- [Subida de archivos a Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
