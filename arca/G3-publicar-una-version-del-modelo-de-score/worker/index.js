// Worker de G3 Publicar una versión del modelo de score.
// Atiende las External Tasks de G3 y de su proceso invocado G3.1 Someter la versión al carrier.
// La lógica es una simulación: en ARCA cada topic llamaría al pipeline de datos y a la App web de administración.
import { Client, Variables, logger } from "camunda-external-task-client-js";

const client = new Client({
  baseUrl: process.env.CAMUNDA_URL ?? "http://localhost:8080/engine-rest",
  use: logger,
  asyncResponseTimeout: 10000,
});

function manejar(topic, logica) {
  client.subscribe(topic, async ({ task, taskService }) => {
    try {
      const variables = new Variables();
      await logica(task.variables, variables, task);
      await taskService.complete(task, variables);
    } catch (error) {
      console.error(`[${topic}] ${error.message}`);
      await taskService.handleFailure(task, { errorMessage: error.message, retries: 0, retryTimeout: 0 });
    }
  });
}

// Backtesting y pruebas de sesgo. Las métricas alimentan la tabla DMN de criterios de validación.
// simularFalloValidacion = true hace que el primer intento detecte sesgo, para recorrer el ciclo de recalibración.
manejar("g3-validar-version", (entrada, salida) => {
  const intento = (entrada.get("intentoValidacion") ?? 0) + 1;
  const sesgo = entrada.get("simularFalloValidacion") === true && intento === 1;
  const auc = entrada.get("aucSimulado") ?? 0.78;
  const variacion = entrada.get("variacionPrimaSimulada") ?? 8;
  console.log(`[G3] Validación #${intento} de ${entrada.get("versionPropuesta")}: AUC ${auc}, sesgo ${sesgo}, variación de prima ${variacion} %`);
  salida.set("intentoValidacion", intento);
  salida.set("auc", auc);
  salida.set("sesgoDetectado", sesgo);
  salida.set("variacionPrimaMax", variacion);
});

manejar("g3-desplegar-version", (entrada, salida) => {
  console.log(`[G3] Versión ${entrada.get("versionPropuesta")} desplegada en producción`);
  salida.set("versionDesplegada", entrada.get("versionPropuesta"));
});

manejar("g3-registrar-vigencia", (entrada, salida) => {
  const desde = new Date().toISOString();
  console.log(`[G3] Vigencia registrada desde ${desde}`);
  salida.set("vigenteDesde", desde);
});

// Evento final de mensaje "Versión publicada": avisa a C1, C3 y C7.
manejar("g3-publicar-version", (entrada) => {
  console.log(`[G3] Versión ${entrada.get("versionDesplegada")} publicada para C1, C3 y C7`);
});

// Proceso invocado G3.1 Someter la versión al carrier (Call Activity).
manejar("g3-enviar-solicitud-carrier", (entrada, salida) => {
  console.log(`[G3.1] Versión ${entrada.get("versionPropuesta")} y memoria de cálculo enviadas al carrier`);
  salida.set("solicitudCarrierEnviada", true);
});
