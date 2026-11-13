# Guía para presentar los procesos en la web de Camunda

## Qué hace cada pieza durante la demo

| Pieza | Para qué la usas | Qué representa en ARCA |
|---|---|---|
| **Cockpit** | **Ver**: diagrama, dónde está cada instancia, variables, decisiones DMN | La consola de operación del proceso |
| **Tasklist** | **Hacer**: reclamar y completar tareas humanas con sus formularios | El trabajo de Suscriptor, Actuario, Jefe de Siniestros, Comité… |
| **Terminal de workers** | Mostrar que las External Tasks se ejecutan en JavaScript | Los sistemas: Score Engine, Motor de siniestros, pipeline de datos |
| **Script `demo.mjs`** | Enviar mensajes externos y adelantar temporizadores | La firma, el carrier y el paso del tiempo |

La web no tiene botones para que "la firma responda" o "el carrier conteste": en la realidad eso llega de fuera. Por eso el script hace esa parte.

## Preparación, unos 15 minutos antes

1. **Motor.** En una consola `cmd`, dentro de la carpeta `camunda-bpm-run-7.24.0-alpha1` en la raíz del repositorio:

   ```bat
   set "JAVA_HOME=C:\Program Files\Java\jdk-21" && start.bat
   ```

   Espera a que el log diga `Started CamundaBpmRun`.

2. **Despliegue y workers.** En una terminal, desde la carpeta `arca`:

   ```bash
   node pruebas/demo.mjs desplegar
   node pruebas/demo.mjs workers
   ```

   Deja esa terminal visible: ahí se ve cada External Task que ejecutan los workers. Si es la primera vez en ese equipo, antes ejecuta `npm install` dentro de la carpeta `worker` de cada proceso.

3. **Terminal de comandos.** Abre otra terminal en la carpeta `arca` para los comandos del script.

4. **Navegador.** Entra a `http://localhost:8080/camunda/app/welcome/` con usuario `demo` y clave `demo`. Abre **Cockpit** en una pestaña y **Tasklist** en otra.

5. **Ensayo rápido.** Corre una vez el escenario principal completo, para que el motor y los workers estén "calientes".

Si prefieres mostrar el despliegue desde Camunda Modeler: abre el `.bpmn` principal, pulsa el cohete de **Deploy** y en esa ventana agrega todos los demás archivos de la carpeta del proceso, incluidos los `.form` y el `.dmn`.

## Cómo moverte en la web

**Cockpit**
- **Dashboard → Processes**: lista de procesos desplegados. Clic en uno para ver su diagrama; los números sobre las actividades son instancias detenidas ahí.
- **Abajo, Process Instances**: clic en el ID de una instancia para abrirla. La actividad donde está esperando aparece resaltada.
- **Pestañas de la instancia**: `Variables` (datos del caso), `User Tasks`, `External Tasks`, `Called Process Instances` (Call Activity) e `Incidents`.
- **Decisions**: lista de tablas DMN. Clic en una y luego en una ejecución: resalta la regla que se cumplió y muestra entradas y salidas.
- Cockpit solo muestra instancias **en curso**. Cuando una termina, desaparece de la lista; para mostrar cómo terminó usa `node pruebas/demo.mjs historial`.

**Tasklist**
- Izquierda: el filtro **All tasks**. Centro: la lista de tareas. Derecha: el detalle.
- Para trabajar una tarea: clic en ella → **Claim** (arriba a la derecha) → llenar el formulario → **Complete**.
- La pestaña **Diagram** del detalle muestra en qué parte del proceso está la tarea; es útil para orientar al jurado.

## Guion principal: C3 Suscribir la solicitud, unos 8 minutos

| Paso | Qué haces | Qué muestras y qué dices |
|---|---|---|
| 1 | Cockpit → Processes → **C3 Suscribir la solicitud** | El diagrama: los carriles por rol y el camino del cuestionario a la decisión |
| 2 | `node pruebas/demo.mjs iniciar c3 guarded` | Se envió el **mensaje de inicio** `CuestionarioIniciado`. La **Call Activity** "Calcular el Pre-Score (Capa 1)" invocó el proceso **C1**: en la terminal de workers se ve el escaneo de la web, la búsqueda de abogados vía Apify y el Pre-Score. Abre el enlace que imprime el script: la instancia espera en "Recibir respuestas" (tarea de recepción de mensaje) |
| 3 | `node pruebas/demo.mjs responder` | La firma envió sus respuestas (otro mensaje). El worker calcula el puntaje: 50 |
| 4 | Recarga Cockpit | La instancia está en "Revisar el caso y decidir". La **tabla DMN** la mandó a revisión humana |
| 5 | Cockpit → Decisions → **Ruta de suscripción por tier** → última ejecución | La regla resaltada: puntaje entre 45 y 65 → GUARDED → revisión humana. Explica la política FIRST |
| 6 | Tasklist → **Revisar el caso y decidir** → Claim | El **Camunda Form**: puntaje y tier en solo lectura, decisión y justificación obligatorias. Elige "Rechazar" y escribe una justificación → Complete |
| 7 | Terminal de workers | Se generó el plan de mejora, se registró la decisión y el proceso invocado **C3.1** notificó al canal (segunda **Call Activity**) |
| 8 | `node pruebas/demo.mjs historial` | La instancia terminó en "Decisión notificada al canal" |

Escenarios de C3: `fortress` (emisión automática), `guarded`, `exposed` (Actuario y Director), `critical` (se declina) y `forzada` (reclamo pagado con puntaje alto).

El **temporizador** de C3: inicia una instancia y, sin responder, ejecuta `node pruebas/demo.mjs vencer c3`. Termina en "Evaluación abandonada".

## C10 Registrar el aviso de siniestro, unos 4 minutos

1. `node pruebas/demo.mjs iniciar c10 cubierto` → el **mensaje** de aviso inicia el proceso; los workers acusan recibo, verifican vigencia y recuperan la póliza.
2. Tasklist → **Revisar el aviso frente a límites y exclusiones** → Claim → monto `300000` → Complete. La **tabla DMN** decide que hace falta concepto jurídico: aparece la tarea del Asesor Jurídico. Con un monto bajo, por ejemplo `5000`, iría directo a la preverificación.
3. Con la instancia en **Determinar la preverificación de cobertura**, ejecuta `node pruebas/demo.mjs vencer c10`. El worker informa a la firma y la tarea **sigue** en Tasklist: es un **temporizador no interruptor**.
4. Completa la preverificación con "Cobertura preverificada". El worker abre el expediente y la **Call Activity** C10.1 comunica a la firma.

Escenario alterno: `iniciar c10 sin-vigencia` termina solo, sin tareas humanas, en "Aviso cerrado sin cobertura".

## G3 Publicar una versión del modelo de score, unos 4 minutos

1. `node pruebas/demo.mjs iniciar g3 normal`.
2. Tasklist, en orden: **Consolidar la evidencia** (elige un motivo) → **Preparar los datos y calibrar** (versión `v2.1`) → el worker valida y la **tabla DMN** aprueba → **Documentar memoria de cálculo** → **Revisar y aprobar la versión** (Aprobada).
3. Cockpit: la instancia espera en la **compuerta basada en eventos**, con dos caminos posibles: la respuesta del carrier o el plazo de 15 días.
4. `node pruebas/demo.mjs carrier aprobar` → despliegue, registro de vigencia y evento final de **mensaje** "Versión publicada". O bien `node pruebas/demo.mjs vencer g3` → "Sin respuesta del carrier".

Escenario `sesgo`: la primera validación detecta sesgo y la tarea de calibración vuelve a aparecer en Tasklist.

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El script dice "No responde Camunda" | El motor no ha terminado de arrancar | Espera el `Started CamundaBpmRun` |
| La tarea no aparece en Tasklist | Los workers no están corriendo | Revisa la terminal de workers; en Cockpit la instancia estará en una External Task |
| "Ninguna instancia está esperando el mensaje" | La instancia aún no llegó a ese punto, o ya pasó | Ejecuta `node pruebas/demo.mjs estado` para ver dónde está cada una |
| Un formulario no carga | Se desplegó sin los `.form` | Vuelve a ejecutar `node pruebas/demo.mjs desplegar` |
| Aparece un incidente rojo en Cockpit | Una External Task falló | Inicia una instancia nueva; el detalle está en la pestaña Incidents |

**Plan B:** si la demo en vivo se complica, ejecuta `node pruebas/probar-procesos.mjs`. Recorre automáticamente todos los caminos de los tres procesos y muestra cada comprobación. Las imágenes de `docs/imagenes` sirven si no hay tiempo de abrir Cockpit.

## Chuleta de comandos

Todos desde la carpeta `arca`:

```bash
node pruebas/demo.mjs desplegar
node pruebas/demo.mjs workers
node pruebas/demo.mjs iniciar c3 guarded
node pruebas/demo.mjs responder
node pruebas/demo.mjs carrier aprobar
node pruebas/demo.mjs vencer c10
node pruebas/demo.mjs estado
node pruebas/demo.mjs historial
```
