// Worker de C10 Registrar el aviso de siniestro.
// Atiende las External Tasks de C10 y de su proceso invocado C10.1 Comunicar a la firma.
// La lógica es una simulación: en ARCA cada topic llamaría al Motor de siniestros.
import { Client, Variables, logger } from "camunda-external-task-client-js";

const client = new Client({
  baseUrl: process.env.CAMUNDA_URL ?? "http://localhost:8080/engine-rest",
  use: logger,
  asyncResponseTimeout: 10000,
});

// Envuelve cada suscripción: si la lógica falla, se crea un incidente visible en Cockpit.
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

manejar("c10-acusar-recibo", (entrada, salida) => {
  console.log(`[C10] Acuse de recibo enviado a ${entrada.get("firma") ?? "la firma asegurada"}`);
  salida.set("fechaAcuse", new Date().toISOString());
});

// La póliza debe estar vigente a la fecha del hecho. Si llegan las fechas, se calcula;
// si no, se respeta polizaVigente cuando ya viene informado, y en otro caso se asume vigente.
manejar("c10-verificar-vigencia", (entrada, salida) => {
  const [hecho, inicio, fin] = ["fechaHecho", "inicioVigencia", "finVigencia"].map((k) => entrada.get(k));
  let vigente = entrada.get("polizaVigente");
  if (hecho && inicio && fin) {
    const t = new Date(hecho).getTime();
    vigente = t >= new Date(inicio).getTime() && t <= new Date(fin).getTime();
  }
  vigente = vigente ?? true;
  console.log(`[C10] Póliza vigente a la fecha del hecho: ${vigente}`);
  salida.set("polizaVigente", vigente);
});

manejar("c10-recuperar-poliza", (entrada, salida) => {
  salida.set("limiteCobertura", entrada.get("limiteCobertura") ?? 1000000);
  salida.set("deducible", entrada.get("deducible") ?? 10000);
  salida.set("exclusionesPoliza", "Uso de IA sin supervisión humana; actos dolosos; multas y sanciones");
  console.log("[C10] Póliza, límites, exclusiones y expediente de suscripción recuperados");
});

manejar("c10-abrir-expediente", (entrada, salida) => {
  const numero = `SIN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
  console.log(`[C10] Expediente abierto: ${numero}`);
  salida.set("numeroExpediente", numero);
});

manejar("c10-registrar-sin-cobertura", (entrada, salida) => {
  console.log("[C10] Aviso registrado como sin cobertura");
  salida.set("estadoAviso", "CERRADO_SIN_COBERTURA");
});

// Ruta del temporizador de 24 h: la preverificación sigue abierta y se informa a la firma.
manejar("c10-informar-estado", (entrada, salida) => {
  console.log("[C10] Han pasado 24 h sin preverificación: se informa a la firma que el aviso sigue en revisión");
  salida.set("ultimoAvisoEstado", new Date().toISOString());
});

// Proceso invocado C10.1 Comunicar a la firma (Call Activity).
manejar("c10-enviar-comunicacion", (entrada, salida) => {
  const tipo = entrada.get("tipoComunicacion");
  const detalle = tipo === "PREVERIFICACION"
    ? `resultado ${entrada.get("resultadoPreverificacion")}, expediente ${entrada.get("numeroExpediente")}`
    : "aviso cerrado sin cobertura";
  console.log(`[C10.1] Comunicación ${tipo} enviada a la firma: ${detalle}`);
  salida.set("comunicacionEnviada", true);
});
