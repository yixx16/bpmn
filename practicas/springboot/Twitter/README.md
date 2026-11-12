# Práctica 09 · Tareas de servicio en Camunda

El proceso revisa un tuit, ejecuta la ruta elegida y termina cuando el worker completa la tarea externa `SendLetter`. Se probó con Java 17, Camunda 7.20.0, Spring Boot 3.1.1 y Node.js 22.19.

## Ejecutar la práctica

1. Seleccione un JDK 17 en `JAVA_HOME`. Desde la raíz del proyecto ejecute `.\mvnw.cmd spring-boot:run`. El motor despliega el BPMN y los formularios al arrancar. H2 conserva el historial en `data/`.
2. En otra terminal, desde `workers/`, ejecute `npm ci` y luego `npm start`. Mantenga la aplicación y el worker abiertos durante todo el recorrido.
3. Abra [Tasklist](http://127.0.0.1:8081/camunda/app/tasklist/default/) con usuario `demo` y contraseña `demo`. El puerto de Twitter es 8081 para poder ejecutarlo junto con EMSA.
4. Seleccione **Start process → TwitterDemoProcess**. Registre un identificador de usuario de ReqRes, un correo y el contenido del tuit. En **Review Tweet**, indique si se aprueba y escriba el comentario. Si la lista de tareas tarda en actualizarse, vuelva a cargar la página.
5. Para la aprobación, marque **Approve?** y complete la revisión. En **View current date**, pulse **Claim** y revise la fecha. Para el rechazo, inicie otra instancia con `UserId = 2`, deje **Approve?** desmarcado y complete la revisión. En **View rejection info**, pulse **Claim** y revise los datos, incluido el correo consultado por HTTP. Esta ruta necesita acceso a ReqRes.
6. Antes de completar cada una de esas dos vistas, abra el enlace a **Cockpit** de la tarea en otra pestaña y seleccione **Variables**. Después vuelva a Tasklist y pulse **Complete**. El worker recogerá la tarea externa y llevará la instancia al evento **Tweet handled**.

## Implementaciones

| Tipo | Actividad | Resultado |
|---|---|---|
| Expression | Consult current date | Guarda la fecha y hora de la expresión `${now()}` en `currentDate`. |
| Delegate Expression | Publish on Twitter | El bean `tweetAdapter` registra el contenido aprobado en consola como publicación simulada. |
| Java Class | Send rejection notification | `RejectionNotificationDelegate` registra en consola el contenido rechazado y el motivo. |
| Connector | Consult email with REST via connector | El `http-connector` hace un GET a `https://reqres.in/api/users/{userId}` y extrae `data.email` como texto en `emailConnector`. |
| External | Send request for help | El worker de Node.js completa `SendLetter` con `status` igual a `Tweet approved` o `Tweet rejected`, según la decisión. |

## Evidencias

Las ocho capturas originales están en `docs/`. Las imágenes 01 a 04 corresponden a la aprobación: creación, revisión, fecha y variables de Cockpit. Las imágenes 05 a 08 corresponden al rechazo: creación, revisión, información de rechazo y variables de Cockpit.

| Ruta | ID de instancia | Evidencia del motor |
|---|---|---|
| Aprobación | `58a15b68-dcca-11f1-9eac-30138b83e271` | `approved = true`, fecha consultada y estado final `Tweet approved`. |
| Rechazo | `e18f85fd-dcca-11f1-9eac-30138b83e271` | `approved = false`, `emailConnector = janet.weaver@reqres.in` y estado final `Tweet rejected`. |

Las dos instancias finalizaron el 10 de noviembre de 2026 con estado `COMPLETED`, cero tareas pendientes y cero incidentes activos. Las capturas muestran las variables antes de completar la última tarea de usuario, tal como lo pide la guía. El worker escribe `status` después de ese momento.
