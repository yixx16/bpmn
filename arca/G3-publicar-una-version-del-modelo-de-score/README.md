# G3 · Publicar una versión del modelo de score (ARCA) — guía de ejecución

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `G3-publicar-una-version-del-modelo-de-score.bpmn` | Proceso principal (actualizado) |
| `S2-desplegar-cambios-en-plataforma.bpmn` | Proceso invocado por la Call Activity |
| `g3-validacion-version.dmn` | Tabla de decisión de la validación |
| `forms/g3-consolidar-evidencia.form`, `forms/g3-calibrar-rubrica.form`, `forms/g3-documentar-version.form`, `forms/g3-decision-comite.form` | Camunda Forms de las 4 User Tasks |
| `worker/worker.js` + `worker/package.json` | External Tasks en JavaScript |
| `pruebas-curl.txt` | Pruebas del proceso con curl |

## 1. Desplegar (Camunda Platform 7.24)
En Camunda Modeler: abre el BPMN de G3 → *Deploy* → en "Additional files" agrega **S2.bpmn, el .dmn y los 4 .form** para que viajen en el mismo despliegue (los formularios y la DMN se resuelven por `deployment`).

## 2. Grupos en Tasklist
Crea en Admin los grupos `actuarios`, `ingenieria-datos` y `comite-modelo` y agrega tu usuario.

## 3. Arrancar los workers
```
cd worker
npm install
node worker.js
```
Variables de entorno opcionales: `CAMUNDA_URL`, `CARRIER_RESPUESTA` (`aprueba` | `rechaza` | `silencio`), `CARRIER_DELAY_MS`.

## 4. Iniciar el proceso (Message Start Event)
```
curl -X POST http://localhost:8080/engine-rest/message -H "Content-Type: application/json" -d '{"messageName":"NecesidadNuevaVersion","businessKey":"G3-001","processVariables":{"motivo":{"value":"Deriva detectada","type":"String"}}}'
```
Variables opcionales para la demo: `simularValidacion` = `falla` (fuerza el ciclo de recalibración) y `simularDespliegue` = `falla` (fuerza la reversión en S2).

## 5. Escenarios de demo
| Escenario | Cómo provocarlo | Resultado |
|---|---|---|
| Camino feliz | Valores por defecto | Versión publicada |
| Validación falla | `simularValidacion=falla` | DMN → `false` → vuelve a calibrar |
| Comité pide ajustes | Elegir "Requiere ajustes" | Vuelve a Consolidar |
| Carrier rechaza | `CARRIER_RESPUESTA=rechaza` | Fin: no aprobada por el carrier |
| Carrier no responde | `CARRIER_RESPUESTA=silencio` | Timer de 15 días → fin sin respuesta |
| Despliegue falla | `simularDespliegue=falla` | S2 revierte → fin "Despliegue revertido" |

Para no esperar 15 días: `GET /engine-rest/job?processInstanceId=<id>` y luego `POST /engine-rest/job/<jobId>/execute`.
