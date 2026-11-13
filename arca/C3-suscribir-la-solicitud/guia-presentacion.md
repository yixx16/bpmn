# Guía para presentar C3 Suscribir la solicitud

Todo lo necesario para la sustentación de C3: preparación, comandos, qué hacer en cada pantalla, qué decir y cómo responder.

## 1. Preparación, 15 minutos antes

Necesitas **tres ventanas**: la del motor, una terminal para los workers y otra para los comandos. Además, el navegador con Cockpit y Tasklist.

### Ventana 1: el motor

En una consola `cmd`, dentro de la carpeta `camunda-bpm-run-7.24.0-alpha1` en la raíz del repositorio:

```bat
set "JAVA_HOME=C:\Program Files\Java\jdk-21" && start.bat
```

Espera a que el log diga `Started CamundaBpmRun`.

### Ventana 2: los workers

En una terminal, entra a la carpeta `arca` y despliega los procesos:

```bash
cd "C:/Users/jesus/projects/bpmn/arca"
```

```bash
node pruebas/demo.mjs desplegar
```

Luego arranca los workers y **deja esta ventana visible** durante toda la presentación:

```bash
node pruebas/demo.mjs workers
```

Si es la primera vez en ese equipo, antes ejecuta `npm install` dentro de `arca/C3-suscribir-la-solicitud/worker`.

### Ventana 3: los comandos

Abre otra terminal y entra también a la carpeta `arca`:

```bash
cd "C:/Users/jesus/projects/bpmn/arca"
```

### Navegador

1. Entra a `http://localhost:8080/camunda/app/welcome/` con usuario `demo` y clave `demo`.
2. Abre **Cockpit** en una pestaña y **Tasklist** en otra.

### Ensayo

Haz la demo completa una vez antes de entrar, para confirmar que todo responde.

## 2. Qué hace cada pieza

| Pieza | Para qué la usas | Qué representa en ARCA |
|---|---|---|
| Cockpit | Ver el diagrama, dónde está el caso, sus variables y la decisión DMN | La consola de operación |
| Tasklist | Completar la tarea humana con su formulario | El trabajo del Suscriptor |
| Ventana de workers | Ver las External Tasks ejecutándose en JavaScript | El Score Engine y la plataforma |
| Ventana de comandos | Enviar los mensajes de la firma y adelantar el tiempo | La firma y el reloj |

La web no tiene botones para que "la firma responda": en la realidad eso llega de fuera. Por eso se hace con un comando.

## 3. El relato de C3, para abrir

> Una firma de abogados inicia su evaluación. ARCA calcula su Pre-Score escaneando su web y buscando a sus abogados, y con eso le arma un cuestionario. Cuando la firma responde, el Score Engine calcula el puntaje compuesto y una tabla de decisión asigna el tier. Según el tier, el caso se aprueba automáticamente, pasa a revisión del Suscriptor, sube al Actuario y al Director, o se declina con un plan de mejora. Al final se registra la decisión y se notifica al canal.

## 4. La demo paso a paso, unos 8 minutos

### Paso 1. Mostrar el diagrama

**Haces:** en Cockpit, Dashboard → **Processes** → **C3 Suscribir la solicitud**.

**Dices:** el relato de la sección 3, señalando los carriles: Plataforma ARCA, Suscriptor, Actuario y Director de Suscripción.

**Extra:** abajo, la pestaña **Called Process Definitions** muestra los dos procesos que C3 invoca con Call Activity: C1 Calcular el Pre-Score y C3.1 Notificar la decisión al canal.

### Paso 2. Iniciar un caso

```bash
node pruebas/demo.mjs iniciar c3 guarded
```

**Muestras:** en la ventana de workers aparecen el escaneo de la web, la búsqueda de abogados vía Apify y el Pre-Score. Luego, el cuestionario de 8 preguntas.

**Dices:**
- "Se envió el **mensaje de inicio** `CuestionarioIniciado`: así empieza el proceso."
- "La **Call Activity** 'Calcular el Pre-Score' invocó el proceso C1, que es reutilizable. Sus tareas son **External Tasks** que atiende un worker en JavaScript."
- "En la plataforma real esas llamadas van a OpenAI y Apify; aquí el worker las simula."

**Haces:** abre el enlace de Cockpit que imprime el comando. La instancia espera en **Recibir respuestas y declaración de veracidad**.

**Dices:** "Es una tarea de recepción de **mensaje**: el proceso espera a que la firma envíe sus respuestas. Tiene un **temporizador de 24 horas**: si la firma no responde, la evaluación se abandona."

### Paso 3. La firma responde

```bash
node pruebas/demo.mjs responder
```

**Muestras:** en la ventana de workers, el puntaje compuesto: 50.

**Dices:** "La firma respondió: otro mensaje. El puntaje combina 30 % de la Capa 1 y 70 % del cuestionario."

**Haces:** recarga Cockpit. La instancia está ahora en **Revisar el caso y decidir**, en el carril del Suscriptor. La pestaña **Variables** muestra `puntaje = 50`, `tier = GUARDED` y `ruta = HUMANA`.

### Paso 4. La tabla DMN

**Haces:** en Cockpit, menú **Decisions** → **Ruta de suscripción por tier** → abajo, la ejecución más reciente.

**Muestras:** la regla resaltada: puntaje entre 45 y 65 → GUARDED → revisión humana.

**Dices:** "La **tabla DMN** separa la regla de negocio del flujo: si cambian los umbrales, se cambia la tabla y no el proceso. Usa la política **FIRST**: gana la primera regla que coincide, por eso las reglas de revisión forzada van arriba."

### Paso 5. La tarea del Suscriptor

**Haces:** en Tasklist, filtro **All tasks** → **Revisar el caso y decidir**.

1. Arriba a la derecha, clic en **Claim**. Si ya dice "Demo Demo", la tarea ya es tuya.
2. Marca **Rechazar (DECLINE)**.
3. En **Justificación** escribe: "Gobernanza de IA insuficiente para aceptar sin condiciones".
4. Clic en **Complete**, que se pone rojo cuando los campos obligatorios están llenos.

**Dices:**
- "Es un **Camunda Form**. Puntaje y tier aparecen en gris porque los calculó el proceso: el Suscriptor los ve, pero no puede alterarlos."
- "Decisión y justificación son obligatorias: no se puede completar sin ellas."
- "La tarea vence en 48 horas, que es el plazo del tier GUARDED."

Antes de completar, la pestaña **Diagram** de esa vista muestra en qué parte de C3 está la tarea.

### Paso 6. El final del proceso

**Muestras:** en la ventana de workers aparecen el plan de mejora con reevaluación a 90 días, el registro de la decisión y la notificación del proceso **C3.1**.

**Dices:** "La compuerta exclusiva llevó el rechazo al plan de mejora. La segunda **Call Activity** invocó C3.1 para notificar al canal."

**Cierras** con:

```bash
node pruebas/demo.mjs historial
```

La instancia terminó en **Decisión notificada al canal**. Cockpit ya no la muestra porque solo lista instancias en curso; por eso se usa este comando.

### Paso 7, opcional: el temporizador

```bash
node pruebas/demo.mjs iniciar c3 guarded
```

Sin ejecutar `responder`:

```bash
node pruebas/demo.mjs vencer c3
```

**Dices:** "El temporizador de 24 horas es **interruptor**: cancela la espera de respuestas y la evaluación termina como abandonada. Aquí lo adelanté para no esperar el plazo real."

Comprueba el resultado con `node pruebas/demo.mjs historial`: termina en "Evaluación abandonada".

## 5. Escenarios disponibles

Se usan con `node pruebas/demo.mjs iniciar c3 <escenario>` y luego `node pruebas/demo.mjs responder`.

| Escenario | Puntaje | Qué pasa |
|---|---|---|
| `fortress` | 90 | La tabla aprueba sola: cotización de 1.785 USD sin tareas humanas |
| `guarded` | 50 | Revisión del Suscriptor; si acepta, prima de 2.310 USD |
| `exposed` | 30 | El Actuario recomienda y el Director de Suscripción decide; si acepta, prima de 2.730 USD |
| `critical` | 10 | La tabla declina sola y genera el plan de mejora |
| `forzada` | 90 | Tiene un reclamo pagado: va a revisión humana aunque el puntaje sea alto |

La prima es `420 × abogados × factor del tier`. Las simulaciones usan 5 abogados.

## 6. Dónde está cada elemento de la rúbrica

| Elemento | Dónde está en C3 | Cuándo lo muestras |
|---|---|---|
| Camunda Forms | Revisar el caso, Analizar el caso, Resolver el caso | Paso 5 |
| DMN | Determinar la ruta de suscripción | Paso 4 |
| XOR | ¿Ruta? y ¿Decisión final?, con sus compuertas de unión | Pasos 4 y 6 |
| Call Activity | Calcular el Pre-Score (invoca C1) y Notificar la decisión al canal (invoca C3.1) | Pasos 1, 2 y 6 |
| Evento de mensaje | Inicio "Firma inicia el cuestionario" y "Recibir respuestas" | Pasos 2 y 3 |
| Temporizador | Sesión vencida (24 h), interruptor | Pasos 2 y 7 |
| External Task en JavaScript | 10 topics en `C3-suscribir-la-solicitud/worker/index.js` | Toda la demo, en la ventana de workers |

## 7. Preguntas probables

**¿Por qué una tabla DMN y no compuertas?**
Las reglas de tiers cambian con el negocio. En una tabla se ajustan sin tocar el proceso, y quedan legibles para quien no programa. Usa la política FIRST: las reglas de revisión forzada van primero para que ganen sobre las de puntaje.

**¿Por qué Call Activity para el Pre-Score?**
C1 es un proceso propio del inventario de ARCA y también se usa por separado, en la cotización inicial. La Call Activity lo reutiliza en vez de duplicarlo. Las variables viajan con `camunda:in` y vuelven con `camunda:out`.

**¿Qué diferencia hay entre Call Activity y subproceso?**
El subproceso vive dentro del mismo modelo. La Call Activity invoca otro proceso desplegado aparte, que puede reutilizarse desde varios procesos.

**¿Cómo funciona la External Task?**
Camunda no llama al worker. El worker pregunta periódicamente si hay trabajos de su topic, los ejecuta y los completa devolviendo variables. Si falla, se crea un incidente visible en Cockpit.

**¿El temporizador es interruptor o no interruptor?**
Interruptor: al vencer cancela la tarea de recepción y el proceso sigue por el camino de abandono.

**¿Las llamadas a OpenAI y Apify son reales?**
En la plataforma sí. En la demo el worker las simula, para no depender de servicios externos.

**¿Qué pasa si la firma tiene un reclamo pagado?**
La tabla DMN fuerza la revisión humana aunque el puntaje sea alto. Se demuestra con el escenario `forzada`.

**¿Por qué el puntaje y el tier están en gris en el formulario?**
Son campos de solo lectura: los calculó el proceso y el Suscriptor no debe poder modificarlos.

**¿De dónde salen los tiers y la fórmula de la prima?**
Del diseño de la plataforma de ARCA. Los factores de la prima son de demostración.

## 8. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| El comando dice "No responde Camunda" | Espera a que el motor muestre `Started CamundaBpmRun` |
| "Ninguna instancia está esperando el mensaje" | Ejecuta `node pruebas/demo.mjs estado` para ver dónde está cada instancia |
| La tarea no aparece en Tasklist | Revisa que la ventana de workers siga abierta y recarga Tasklist |
| El botón Complete no se activa | Falta el Claim o algún campo obligatorio |
| Aparece un incidente rojo en Cockpit | Inicia un caso nuevo; el detalle está en la pestaña Incidents |

**Plan B:** si la demo en vivo se complica, ejecuta `node pruebas/probar-procesos.mjs`. Recorre automáticamente todos los caminos y muestra cada comprobación. La imagen `docs/imagenes/C3-suscribir-la-solicitud.png` sirve si no hay tiempo de abrir Cockpit.

## 9. Chuleta de comandos

Todos desde la carpeta `arca`:

| Comando | Para qué |
|---|---|
| `node pruebas/demo.mjs desplegar` | Despliega los procesos con sus DMN y formularios |
| `node pruebas/demo.mjs workers` | Arranca los workers; deja la ventana abierta |
| `node pruebas/demo.mjs iniciar c3 guarded` | Inicia un caso con el escenario elegido |
| `node pruebas/demo.mjs responder` | La firma envía sus respuestas |
| `node pruebas/demo.mjs vencer c3` | Dispara ahora el temporizador de 24 horas |
| `node pruebas/demo.mjs estado` | Muestra dónde está cada instancia y las tareas abiertas |
| `node pruebas/demo.mjs historial` | Muestra en qué evento terminaron las últimas instancias |
