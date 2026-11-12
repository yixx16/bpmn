// Worker de C3 Suscribir la solicitud.
// Atiende las External Tasks de C3 y de su proceso invocado C3.1 Notificar la decisión al canal.
// La lógica es una simulación del Score Engine; los pesos y factores son de demo, como en la plataforma.
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

// Entre 8 y 12 preguntas según lo que encontró la Capa 1.
manejar("c3-seleccionar-preguntas", (entrada, salida) => {
  const hallazgos = ["restriccionCapa1", "reclamoPagado", "incidenteIA", "sinEOVigente"].filter((k) => entrada.get(k) === true).length;
  const preguntas = Math.min(12, 8 + hallazgos);
  console.log(`[C3] Cuestionario de Capa 2 con ${preguntas} preguntas`);
  salida.set("numeroPreguntas", preguntas);
});

manejar("c3-presentar-cuestionario", (entrada) => {
  console.log(`[C3] Cuestionario presentado a ${entrada.get("dominio") ?? "la firma"}`);
});

// Puntaje compuesto: 30 % Capa 1 y 70 % Capa 2 (pesos de demo).
// Hoy todo resultado sale con la decisión comercial bloqueada; habilitarDecisionComercial = true
// permite recorrer la parte de diseño.
manejar("c3-calcular-score", (entrada, salida) => {
  const capa1 = entrada.get("puntajeCapa1") ?? 60;
  const capa2 = entrada.get("puntajeCapa2") ?? 60;
  const puntaje = Math.round(0.3 * capa1 + 0.7 * capa2);
  const revisionForzada = ["reclamoPagado", "incidenteIA", "sinEOVigente", "restriccionCapa1"].some((k) => entrada.get(k) === true);
  const bloqueada = entrada.get("habilitarDecisionComercial") !== true;
  console.log(`[C3] Puntaje ${puntaje} (Capa 1 ${capa1}, Capa 2 ${capa2}); revisión forzada: ${revisionForzada}; decisión bloqueada: ${bloqueada}`);
  salida.set("puntaje", puntaje);
  salida.set("revisionForzada", revisionForzada);
  salida.set("commercialDecisionBlocked", bloqueada);
});

manejar("c3-mostrar-resultados", (entrada) => {
  console.log(`[C3] Resultados y plan de acción mostrados: puntaje ${entrada.get("puntaje")}`);
});

// Prima anual = 420 × abogados × factor de gobernanza × área × jurisdicción × tamaño (fórmula de diseño).
const FACTOR_GOBERNANZA = { FORTRESS: 0.85, FORTIFIED: 0.95, GUARDED: 1.1, EXPOSED: 1.3, CRITICAL: 1.5 };
manejar("c3-calcular-cotizacion", (entrada, salida) => {
  const abogados = entrada.get("abogados") ?? 5;
  const factor = FACTOR_GOBERNANZA[entrada.get("tier")] ?? 1;
  const otros = ["factorArea", "factorJurisdiccion", "factorTamano"].reduce((p, k) => p * (entrada.get(k) ?? 1), 1);
  const prima = Math.round(420 * abogados * factor * otros);
  const limite = entrada.get("limiteSolicitado") ?? "Professional";
  console.log(`[C3] Cotización: prima anual USD ${prima}, límite ${limite}`);
  salida.set("primaAnual", prima);
  salida.set("limiteOfrecido", limite);
});

manejar("c3-generar-plan-mejora", (entrada, salida) => {
  const fecha = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  console.log(`[C3] Plan de mejora generado; nueva evaluación el ${fecha}`);
  salida.set("fechaReevaluacion", fecha);
});

manejar("c3-registrar-decision", (entrada, salida) => {
  console.log(`[C3] Decisión ${entrada.get("decision")} registrada en el expediente`);
  salida.set("fechaDecision", new Date().toISOString());
});

// Proceso invocado C3.1 Notificar la decisión al canal (Call Activity).
manejar("c3-enviar-notificacion", (entrada, salida) => {
  const prima = entrada.get("primaAnual");
  console.log(`[C3.1] Decisión ${entrada.get("decision")} (tier ${entrada.get("tier")})${prima ? `, prima USD ${prima}` : ""} notificada al canal`);
  salida.set("notificacionEnviada", true);
});
