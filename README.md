# BPMN · Procesos de ARCA y prácticas del curso

Modelos BPMN 2.0 ejecutables en **Camunda Platform 7.24** para tres procesos de ARCA, la aseguradora de mala praxis profesional por uso de IA, más las prácticas del curso.

## Estructura

```
bpmn/
├── arca/                                      Proyecto principal
│   ├── C10-registrar-el-aviso-de-siniestro/   Proceso 1
│   ├── C3-suscribir-la-solicitud/             Proceso 2
│   ├── G3-publicar-una-version-del-modelo-de-score/   Proceso 3
│   ├── pruebas/probar-procesos.mjs            Prueba de punta a punta de los tres procesos
│   └── docs/                                  Arquitectura e imágenes de los diagramas
└── practicas/
    ├── L06a-autonomous-work/                  Retos A–E (compuerta inclusiva, multiinstancia, error, compensación, ad hoc)
    ├── L08-service-task-lafayette/            Service Task con worker en JavaScript
    └── springboot/                            Camunda embebido en Spring Boot (Twitter, EMSA)
```

Cada carpeta de proceso de ARCA es autocontenida:

| Archivo | Contenido |
|---|---|
| `<proceso>.bpmn` | Modelo principal con pools, carriles y extensiones de Camunda 7 |
| `<subproceso>.bpmn` | Proceso que invoca la Call Activity |
| `*.dmn` | Tabla de decisión |
| `forms/*.form` | Camunda Forms de las tareas de usuario |
| `worker/` | Worker en JavaScript para todas las External Tasks del proceso |

## Elementos de la rúbrica

| Elemento | C10 Registrar el aviso de siniestro | C3 Suscribir la solicitud | G3 Publicar una versión del modelo |
|---|---|---|---|
| Camunda Forms | 3: revisar aviso, concepto jurídico, preverificación | 3: revisar caso, analizar caso, resolver caso | 4: consolidar, calibrar, documentar, aprobar |
| DMN | `C10_RequiereConceptoJuridico` | `C3_RutaSuscripcion` (tiers) | `G3_CriteriosValidacion` |
| XOR | 5 compuertas exclusivas | 5 compuertas exclusivas | 5 compuertas exclusivas |
| Call Activity | Comunicar a la firma (2 veces) | Notificar la decisión al canal | Someter la versión al carrier |
| Evento de mensaje | Inicio por aviso de reclamación | Inicio por cuestionario y tarea de recepción | Inicio, captura de la respuesta del carrier y fin "Versión publicada" |
| Compuerta de eventos o temporizador | Temporizador no interruptor de 24 h | Temporizador interruptor de 24 h | Compuerta basada en eventos: respuesta o 15 días |
| External Task (JavaScript) | 7 topics en `worker/index.js` | 8 topics en `worker/index.js` | 5 topics en `worker/index.js` |

## Cómo ejecutarlo

**Requisitos:** Camunda Run 7.24, JDK 17 o 21, Node.js 18 o superior y Camunda Modeler 5.

1. **Motor.** Descarga Camunda Run 7.24 y descomprímelo en la raíz del repositorio; el `.gitignore` lo excluye. Arráncalo con `start.bat` y entra a `http://localhost:8080` con el usuario `demo` y la clave `demo`.
2. **Despliegue.** En Camunda Modeler abre el `.bpmn` principal de un proceso, pulsa Deploy y agrega en esa ventana todos los demás archivos de su carpeta: el subproceso, el `.dmn` y los `.form`. Los formularios se resuelven por nombre de archivo, así que deben ir en el mismo despliegue.
3. **Workers.** En la carpeta `worker` de cada proceso:

   ```bash
   npm install
   npm start
   ```

   Por defecto se conectan a `http://localhost:8080/engine-rest`. Para usar otro motor, define la variable de entorno `CAMUNDA_URL`.

4. **Prueba automática.** Con el motor en marcha y `npm install` hecho en los tres workers, desde la carpeta `arca`:

   ```bash
   node pruebas/probar-procesos.mjs
   ```

   Despliega las tres carpetas, arranca los workers y recorre todos los caminos, incluidos los temporizadores, que dispara por la API.

### Variables para recorrer los caminos

Los workers simulan los sistemas de ARCA. Estas variables, enviadas al iniciar el proceso, controlan sus resultados:

| Proceso | Variable | Efecto |
|---|---|---|
| C10 | `polizaVigente` o `fechaHecho`, `inicioVigencia`, `finVigencia` | Define si la póliza estaba vigente a la fecha del hecho |
| C3 | `habilitarDecisionComercial` | `true` recorre la parte de diseño; sin ella el proceso termina como hoy, sin decisión comercial |
| C3 | `puntajeCapa1` y, al responder, `puntajeCapa2` | Puntaje compuesto = 30 % Capa 1 + 70 % Capa 2 |
| C3 | `reclamoPagado`, `incidenteIA`, `sinEOVigente`, `restriccionCapa1` | Fuerzan la revisión humana |
| G3 | `simularFalloValidacion` | El primer intento de validación detecta sesgo y vuelve a calibración |

Los mensajes que esperan los procesos son `AvisoReclamacion`, `CuestionarioIniciado`, `RespuestasCuestionarioRecibidas`, `NecesidadNuevaVersion` y `RespuestaCarrier`, este último con la variable `aprobadaCarrier`.

## Supuestos

Estos valores no vienen de los documentos de ARCA y deben validarse con el negocio:

- C10 pide concepto jurídico si una exclusión es dudosa o si el monto reclamado es de 250.000 USD o más.
- C10 informa a la firma el estado del aviso si la preverificación lleva 24 horas abierta.
- G3 aprueba una versión sin sesgo, con AUC de al menos 0,70 y una variación de prima de hasta 15 %.
- G3 espera 15 días la respuesta del carrier.
- En C3, la tabla de tiers y la fórmula de prima siguen el diseño de la plataforma, pero sus factores son de demostración.
