# ARCA · Procesos de negocio en BPMN con Camunda 7

**Nombre del proyecto:** ARCA, seguro de mala praxis profesional por uso de IA. Modelado y automatización de tres procesos de negocio en Camunda Platform 7.24.

Los procesos se pueden ejecutar de dos formas:
- En **Camunda Run** con workers en JavaScript: las carpetas de cada proceso, descritas en las secciones siguientes.
- Con **Camunda 7 embebido en Spring Boot**, con un portal para la firma, un panel interno por rol y un servicio de negocio con su propia base de datos: en los repositorios del [hub del proyecto](https://github.com/DAMT777/arca-hub), descritos en [su sección](#versión-spring-boot-camunda-7-embebido).

ARCA es una aseguradora emergente que cubre los errores profesionales que cometen las firmas de abogados al usar inteligencia artificial. En lugar de encuestar a la firma, mide su riesgo con evidencia: escanea su huella pública, le aplica un cuestionario y calcula un score de 0 a 100 que decide si es asegurable y a qué precio.

## Integrantes del grupo y proceso a cargo

| Estudiante (nombre completo) | Código | Proceso que asumió | Nombre de la carpeta en el repositorio | Implementación en Spring Boot |
|---|---|---|---|---|
| Diego Alejandro Machado Tovar | 160005017 | C10 Registrar el aviso de siniestro | `arca/C10-registrar-el-aviso-de-siniestro` | [arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine), paquete `com.arca.c10` |
| Jesus Gregorio Delgado | 160005010 | C3 Suscribir la solicitud | `arca/C3-suscribir-la-solicitud` | [arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine), paquete `com.arca.c3` |
| Johan Sebastian Forero Agudelo | 160005011 | G3 Publicar una versión del modelo de score | `arca/G3-publicar-una-version-del-modelo-de-score` | [arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine), paquete `com.arca.g3` |

## Qué desplegar en el motor y cómo iniciar cada proceso

Cada proceso se despliega en **un solo despliegue** con todos sus archivos. En Camunda Modeler: abrir el BPMN principal → **Deploy** → en *Additional files* agregar los demás archivos de la carpeta. Los formularios, las tablas DMN y los procesos invocados se buscan dentro del mismo despliegue.

### C10 Registrar el aviso de siniestro · Diego Alejandro Machado Tovar

**Nombre visible para darle "Start":** `C10 Registrar el aviso de siniestro`

| Tipo | Archivo |
|---|---|
| Proceso principal | `C10-registrar-el-aviso-de-siniestro.bpmn` |
| Proceso invocado por la Call Activity | `C10-comunicar-a-la-firma.bpmn` |
| DMN | `C10-requiere-concepto-juridico.dmn` |
| Forms | `forms/C10-revisar-aviso.form`, `forms/C10-concepto-juridico.form`, `forms/C10-preverificacion.form` |

### C3 Suscribir la solicitud · Jesus Gregorio Delgado

**Nombre visible para darle "Start":** `C3 Suscribir la solicitud`

| Tipo | Archivo |
|---|---|
| Proceso principal | `C3-suscribir-la-solicitud.bpmn` |
| Procesos invocados por las Call Activity | `C1-calcular-el-pre-score.bpmn`, `C3-notificar-la-decision-al-canal.bpmn` |
| DMN | `C3-ruta-de-suscripcion.dmn` |
| Forms | `forms/C3-revisar-caso.form`, `forms/C3-analizar-caso.form`, `forms/C3-resolver-caso.form` |

### G3 Publicar una versión del modelo de score · Johan Sebastian Forero Agudelo

**Nombre visible para darle "Start":** `G3 Publicar una versión del modelo de score`

| Tipo | Archivo |
|---|---|
| Proceso principal | `G3-publicar-una-version-del-modelo-de-score.bpmn` |
| Proceso invocado por la Call Activity | `S2-desplegar-cambios-en-plataforma.bpmn` |
| DMN | `g3-validacion-version.dmn` |
| Forms | `forms/g3-consolidar-evidencia.form`, `forms/g3-calibrar-rubrica.form`, `forms/g3-documentar-version.form`, `forms/g3-decision-comite.form` |

En Tasklist, **Start process** también lista los procesos invocados: `C10.1 Comunicar a la firma`, `C1 Calcular el Pre-Score de la firma`, `C3.1 Notificar la decisión al canal` y `S2 Desplegar cambios en plataforma`. Esos no se inician a mano: los arranca su proceso principal mediante la Call Activity.

## Cómo ejecutarlo

**Requisitos:** Camunda Run 7.24 con JDK 17 o 21, Node.js 18 o superior y Camunda Modeler 5.

1. **Motor.** Descomprimir Camunda Run en la raíz del repositorio y arrancarlo con `start.bat`. Entrar a `http://localhost:8080` con usuario `demo` y clave `demo`.
2. **Despliegue.** Como se indica arriba, o con un solo comando desde la carpeta `arca`, que despliega los tres procesos con todos sus archivos:

   ```bash
   node pruebas/demo.mjs desplegar
   ```

3. **Workers.** Las External Tasks se ejecutan con un worker en JavaScript por proceso. En la carpeta `worker` de cada proceso:

   ```bash
   npm install
   npm start
   ```

4. **Iniciar.** En Tasklist → **Start process** → elegir el nombre visible del proceso → **Start**. No hace falta ingresar datos.

### Datos por defecto

Los tres procesos arrancan sin ingresar variables. Los workers ponen valores por defecto y las tareas humanas se completan con sus formularios en Tasklist.

| Proceso | Qué pasa con los valores por defecto |
|---|---|
| C10 | El worker asume la póliza vigente a la fecha del hecho; el caso sigue a "Revisar el aviso" en Tasklist |
| C3 | El Pre-Score por defecto es 60. El proceso espera las respuestas del cuestionario, que en ARCA llegan desde la plataforma web; para simularlas, desde la carpeta `arca`: `node pruebas/demo.mjs responder` |
| G3 | La validación pasa y el worker responde como carrier aprobando la versión a los pocos segundos |

## Qué hizo cada integrante

### Diego Alejandro Machado Tovar · C10 Registrar el aviso de siniestro

Proceso core de la cadena *Aviso-a-Pago*. Recibe la reclamación contra una firma asegurada por un error atribuido al uso de IA, confirma si la póliza responde y abre el expediente del siniestro.

- **Participantes:** la piscina de ARCA con tres carriles, Motor de siniestros, Jefe de Siniestros y Asesor Jurídico, y la piscina externa de la Firma asegurada.
- **Inicio:** evento de mensaje `AvisoReclamacion`; el sistema envía de inmediato un acuse de recibo a la firma.
- **Vigencia:** el Motor de siniestros verifica que la póliza estuviera vigente a la fecha del hecho. Si no lo estaba, el aviso se registra y se cierra sin cobertura.
- **Revisión:** el Jefe de Siniestros revisa el aviso frente a límites y exclusiones con un formulario donde registra el monto reclamado y si alguna exclusión es dudosa.
- **Decisión DMN:** la tabla `C10_RequiereConceptoJuridico` decide si el caso necesita concepto del Asesor Jurídico: cuando una exclusión es dudosa o el monto es de 250.000 USD o más.
- **Concepto y preverificación:** el Asesor Jurídico emite su concepto en un formulario, y el Jefe de Siniestros determina el resultado: cobertura preverificada, con reserva de derechos o sin cobertura.
- **Temporizador:** un temporizador **no interruptor** de 24 horas sobre la preverificación informa a la firma que su aviso sigue en revisión, sin cancelar la tarea.
- **Cierre:** si hay cobertura, se abre el expediente; si no, se registra el aviso sin cobertura. En ambos casos la comunicación a la firma se hace con una **Call Activity** que invoca el proceso reutilizable `C10.1 Comunicar a la firma`.
- **Automatización:** 7 External Tasks atendidas por el worker en JavaScript `worker/index.js`.
- **Pruebas:** `pruebas.txt` trae los comandos para iniciar cada escenario desde PowerShell o cmd.
- **Spring Boot:** en [arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine), paquete `com.arca.c10`, integrado con [arca-servicios](https://github.com/DAMT777/arca-servicios):
  - `C10Delegates` reemplaza al worker con 7 JavaDelegates.
  - `C10Controller` recibe el aviso que la firma envía desde el portal (mensaje `AvisoReclamacion`).
  - El Jefe de Siniestros y el Asesor Jurídico completan sus tareas en el panel interno.

### Jesus Gregorio Delgado · C3 Suscribir la solicitud

Proceso core del grupo de Adquisición. Decide si ARCA asume el riesgo de una firma de abogados, con qué condiciones y a qué precio.

- **Participantes:** la piscina de ARCA con cuatro carriles, Plataforma ARCA (Score Engine), Suscriptor, Actuario y Director de Suscripción, y la piscina externa de la Firma de abogados y broker.
- **Inicio:** evento de mensaje `CuestionarioIniciado`, cuando la firma inicia su evaluación.
- **Pre-Score:** una **Call Activity** invoca el proceso `C1 Calcular el Pre-Score de la firma`, que escanea la web de la firma e identifica a la firma, busca a sus abogados en el colegio de abogados y en Avvo a través de Apify, y calcula el Pre-Score con sus señales.
- **Cuestionario:** con las señales de la Capa 1 se arma un cuestionario de 8 a 12 preguntas. Una tarea de recepción de mensaje espera las respuestas y la declaración de veracidad.
- **Temporizador:** un temporizador **interruptor** de 24 horas cancela la espera si la firma no responde y cierra la evaluación como abandonada.
- **Puntaje:** el Score Engine calcula el puntaje compuesto, 30 % del Pre-Score y 70 % del cuestionario, y muestra a la firma sus resultados y su plan de acción.
- **Decisión DMN:** la tabla `C3_RutaSuscripcion`, con política FIRST, asigna el tier y la ruta: FORTRESS y FORTIFIED se aceptan sin revisión, GUARDED pasa a revisión humana, EXPOSED a revisión senior y CRITICAL se declina. Un reclamo pagado, un incidente de IA, no tener E&O vigente o una restricción de la Capa 1 fuerzan la revisión humana aunque el puntaje sea alto.
- **Revisiones humanas:** el Suscriptor decide los casos GUARDED en 48 horas; en los EXPOSED, el Actuario recomienda condiciones y el Director de Suscripción decide en 5 días. Cada tarea usa su formulario, con el puntaje y el tier en solo lectura.
- **Cierre:** si se acepta, se calcula la cotización con prima y límite; si se rechaza, se genera un plan de mejora con nueva evaluación a los 90 días. La decisión se registra en el expediente y se notifica al canal con una segunda **Call Activity**, que invoca `C3.1 Notificar la decisión al canal`.
- **Automatización:** 10 External Tasks, de C3 y de sus dos procesos invocados, atendidas por el worker en JavaScript `worker/index.js`.
- **Presentación:** `guia-presentacion.md` explica la demo paso a paso y `comandos.txt` reúne los comandos.
- **Spring Boot:** en [arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine), paquete `com.arca.c3`, integrado con [arca-servicios](https://github.com/DAMT777/arca-servicios):
  - `C3Delegates` reemplaza al worker con 10 JavaDelegates, de C3, C1 y C3.1.
  - `C3Controller` permite a la firma, desde el portal, iniciar la evaluación (`CuestionarioIniciado`) y responder el cuestionario de 8 preguntas (`RespuestasCuestionarioRecibidas`).
  - El Suscriptor, el Actuario y el Director de Suscripción deciden en el panel interno.

### Johan Sebastian Forero Agudelo · G3 Publicar una versión del modelo de score

Proceso de gestión. Mantiene el modelo de score alineado con la siniestralidad y el marco regulatorio, publicando versiones calibradas, validadas, aprobadas y trazables.

- **Participantes:** la piscina de ARCA con tres carriles, Actuario Jefe, Ingeniero de Datos y Comité de Modelo, y la piscina externa del Carrier.
- **Inicio:** evento de mensaje `NecesidadNuevaVersion`, cuando hay nueva evidencia de siniestralidad, deriva del modelo, apertura de un vertical o un fallo relevante.
- **Propuesta y calibración:** el Actuario Jefe consolida la evidencia y propone el cambio, y el Ingeniero de Datos calibra la rúbrica y los pesos. Cada tarea usa su formulario.
- **Validación:** una External Task simula el backtesting y la prueba de sesgo, y la tabla DMN `g3-validacion-version` decide si la versión pasa según el AUC, la desviación del loss ratio y la razón de impacto dispar. Si no pasa, el proceso vuelve a la calibración.
- **Aprobación:** el Actuario Jefe documenta la memoria de cálculo y la nota de cambios, y el Comité de Modelo aprueba, pide ajustes, lo que regresa a la propuesta, o rechaza la versión.
- **Carrier:** la versión se somete al carrier con una tarea de envío. Una **compuerta basada en eventos** espera su respuesta como evento de mensaje, o un temporizador de 15 días que cierra el proceso sin respuesta.
- **Despliegue:** si el carrier aprueba, una **Call Activity** invoca `S2 Desplegar cambios en plataforma`, que despliega la versión, ejecuta pruebas de humo y la revierte si fallan.
- **Cierre:** con el despliegue saludable se registra la vigencia y la trazabilidad, y el evento final de mensaje `VersionModeloPublicada` avisa a los procesos que usan el modelo.
- **Automatización:** las External Tasks de G3 y S2 las atiende el worker en JavaScript `worker/worker.js`, que también simula la respuesta del carrier.
- **Documentación propia:** `README.md` de la carpeta explica el despliegue y los escenarios, y `pruebas-curl.txt` las pruebas con curl.
- **Spring Boot:** en [arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine), paquete `com.arca.g3`, integrado con [arca-servicios](https://github.com/DAMT777/arca-servicios):
  - `G3Delegates` reemplaza al worker con 7 JavaDelegates, de G3 y S2.
  - `G3Controller` permite al Actuario Jefe iniciar una nueva versión desde el panel (`NecesidadNuevaVersion`).
  - El rol Carrier aprueba o rechaza la versión (`RespuestaCarrier`), en lugar de la respuesta simulada del worker.

## Versión Spring Boot (Camunda 7 embebido)

La versión vigente con Camunda 7 embebido en Spring Boot está en sus propios repositorios, reunidos en [**ARCA · hub del proyecto**](https://github.com/DAMT777/arca-hub):
- **[arca-bpm-engine](https://github.com/DAMT777/arca-bpm-engine):** el motor y las vistas, con el portal de la firma y el panel interno por rol.
- **[arca-servicios](https://github.com/DAMT777/arca-servicios):** el servicio de negocio con su base de datos y el Score Engine, que los procesos invocan.

El README del hub explica la arquitectura, el orden de arranque y los casos de prueba. Cada integrante es responsable de su proceso en los dos componentes: Diego Alejandro Machado Tovar de C10, Jesus Gregorio Delgado de C3 y Johan Sebastian Forero Agudelo de G3.

La carpeta `arca/arca-springboot` de este repositorio es una versión anterior del motor, sin la integración con arca-servicios. Se conserva solo como referencia.

## Estructura del repositorio

```
bpmn/
├── arca/
│   ├── C10-registrar-el-aviso-de-siniestro/      Diego Alejandro Machado Tovar
│   ├── C3-suscribir-la-solicitud/                Jesus Gregorio Delgado
│   ├── G3-publicar-una-version-del-modelo-de-score/   Johan Sebastian Forero Agudelo
│   ├── arca-springboot/  versión anterior del motor Spring Boot; la vigente está en arca-bpm-engine (ver el hub)
│   ├── pruebas/        demo.mjs (comandos para la demo) y probar-procesos.mjs (prueba de punta a punta)
│   └── docs/           arquitectura, imágenes de los diagramas y guía de demo
└── practicas/          prácticas anteriores del curso (L06a, L08, Spring Boot)
```

Cada carpeta de proceso contiene sus modelos BPMN, su tabla DMN, sus formularios en `forms/` y su worker en `worker/`.

**Prueba automática:** con el motor encendido y `npm install` hecho en los tres workers, desde la carpeta `arca`, `node pruebas/probar-procesos.mjs` despliega los tres procesos y recorre todos sus caminos.
