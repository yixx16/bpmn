// Prueba de punta a punta de C10, C3 y G3 contra un Camunda Run 7 local.
// Requisitos: Camunda Run en marcha y `npm install` hecho en la carpeta worker de cada proceso.
// Uso (desde la carpeta arca):  node pruebas/probar-procesos.mjs
// Despliega cada carpeta de proceso (BPMN, DMN y formularios), arranca su worker y recorre sus caminos.
// Los temporizadores se disparan ejecutando su job por la API, sin esperar el plazo real.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARCA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.CAMUNDA_URL ?? "http://localhost:8080/engine-rest";
const PROCESOS = ["C10-registrar-el-aviso-de-siniestro", "C3-suscribir-la-solicitud", "G3-publicar-una-version-del-modelo-de-score"];
let fallos = 0;

// ---------------------------------------------------------------- utilidades
const ok = (cond, msg) => { console.log(`${cond ? "  OK   " : "  FALLA"} ${msg}`); if (!cond) fallos++; };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const s = (v) => ({ value: v, type: "String" });
const b = (v) => ({ value: v, type: "Boolean" });
const n = (v) => ({ value: v, type: "Double" });

async function api(ruta, opts = {}) {
  const r = await fetch(API + ruta, opts);
  const t = await r.text();
  let body; try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body };
}
const post = (ruta, json) => api(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json ?? {}) });

async function esperar(fn, ms = 20000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const v = await fn();
    if (v) return v;
    await pausa(300);
  }
  return null;
}
const tarea = (pi, id) => esperar(async () => (await api(`/task?processInstanceId=${pi}&taskDefinitionKey=${id}`)).body[0]);
const completar = (t, vars = {}) => post(`/task/${t.id}/complete`, { variables: vars });
const paso = (pi, id) => esperar(async () => (await api(`/history/activity-instance?processInstanceId=${pi}&activityId=${id}&finished=true`)).body.length > 0);
const terminada = (pi) => esperar(async () => (await api(`/history/process-instance/${pi}`)).body.state === "COMPLETED");
const variable = async (pi, nombre) => (await api(`/history/variable-instance?processInstanceId=${pi}&variableName=${nombre}`)).body[0]?.value;
const suscripcion = (pi, msg) => esperar(async () => (await api(`/event-subscription?processInstanceId=${pi}&eventName=${msg}`)).body.length > 0);
const subprocesos = async (pi, key) => (await api(`/history/process-instance?superProcessInstanceId=${pi}&processDefinitionKey=${key}`)).body;

async function iniciar(mensaje, vars) {
  const r = await post("/message", { messageName: mensaje, processVariables: vars, resultEnabled: true });
  return r.body[0]?.processInstance?.id;
}
async function correlacionar(pi, mensaje, vars = {}) {
  await suscripcion(pi, mensaje);
  return post("/message", { messageName: mensaje, processInstanceId: pi, processVariables: vars, resultEnabled: true });
}
async function dispararTemporizador(pi) {
  const job = await esperar(async () => (await api(`/job?processInstanceId=${pi}&timers=true`)).body[0]);
  return job ? post(`/job/${job.id}/execute`) : { status: 0 };
}

// ---------------------------------------------------------------- despliegue y workers
async function desplegar(carpeta) {
  const dir = path.join(ARCA, carpeta);
  const fd = new FormData();
  fd.append("deployment-name", carpeta);
  fd.append("deployment-source", "pruebas");
  const archivos = [
    ...(await readdir(dir)).filter((f) => /\.(bpmn|dmn)$/.test(f)).map((f) => path.join(dir, f)),
    ...(await readdir(path.join(dir, "forms"))).map((f) => path.join(dir, "forms", f)),
  ];
  for (const f of archivos) fd.append(path.basename(f), new Blob([await readFile(f)]), path.basename(f));
  const r = await api("/deployment/create", { method: "POST", body: fd });
  ok(r.status === 200, `${carpeta}: despliegue de ${archivos.length} archivos (HTTP ${r.status})${r.status === 200 ? "" : " " + JSON.stringify(r.body).slice(0, 300)}`);
  return r.status === 200;
}

const salidas = {};
function arrancarWorker(carpeta, env = {}) {
  const dir = path.join(ARCA, carpeta, "worker");
  const principal = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).main ?? "index.js";
  // El worker de G3 responde solo como carrier; en la prueba lo hace a los 500 ms para no esperar.
  const w = spawn(process.execPath, [principal], { cwd: dir, env: { ...process.env, CAMUNDA_URL: API, CARRIER_DELAY_MS: "500", ...env } });
  salidas[carpeta] = "";
  w.stdout.on("data", (d) => (salidas[carpeta] += d));
  w.stderr.on("data", (d) => (salidas[carpeta] += d));
  return w;
}

// ---------------------------------------------------------------- C10
async function probarC10() {
  console.log("\n== C10 · aviso cubierto, sin concepto jurídico");
  let pi = await iniciar("AvisoReclamacion", { firma: s("Smith & Lee LLP"), polizaVigente: b(true) });
  let t = await tarea(pi, "Task_C10_RevisarAviso");
  ok(t?.formKey === "camunda-forms:deployment:C10-revisar-aviso.form", "la revisión usa el Camunda Form C10-revisar-aviso.form");
  await completar(t, { montoReclamado: n(120000), exclusionDudosa: b(false) });
  t = await tarea(pi, "Task_C10_Preverificar");
  ok(!!t, "la tabla DMN decide que no hace falta concepto jurídico");
  ok((await variable(pi, "requiereConceptoJuridico")) === false, "requiereConceptoJuridico = false");
  await completar(t, { resultadoPreverificacion: s("CUBIERTO"), fundamentoPreverificacion: s("Póliza vigente y sin exclusiones") });
  ok(await terminada(pi), "la instancia terminó");
  ok(await paso(pi, "EndEvent_C10_SiniestroRegistrado"), "terminó en Siniestro registrado");
  ok((await variable(pi, "numeroExpediente"))?.startsWith("SIN-"), "el worker abrió el expediente");
  const sub = await subprocesos(pi, "Process_C10_ComunicarFirma");
  ok(sub.length === 1 && sub[0].state === "COMPLETED", "la Call Activity ejecutó C10.1 Comunicar a la firma");

  console.log("\n== C10 · monto alto: concepto jurídico y sin cobertura");
  pi = await iniciar("AvisoReclamacion", { polizaVigente: b(true) });
  await completar(await tarea(pi, "Task_C10_RevisarAviso"), { montoReclamado: n(300000), exclusionDudosa: b(false) });
  t = await tarea(pi, "Task_C10_ConceptoJuridico");
  ok(!!t, "la tabla DMN envía el aviso al Asesor Jurídico por el monto");
  await completar(t, { conceptoJuridico: s("La exclusión por uso sin supervisión aplica"), coberturaRecomendada: s("SIN_COBERTURA") });
  await completar(await tarea(pi, "Task_C10_Preverificar"), { resultadoPreverificacion: s("SIN_COBERTURA"), fundamentoPreverificacion: s("Exclusión aplicable") });
  ok(await terminada(pi) && await paso(pi, "EndEvent_C10_AvisoSinCobertura"), "terminó en Aviso cerrado sin cobertura");
  ok((await subprocesos(pi, "Process_C10_ComunicarFirma")).length === 1, "se comunicó la ausencia de cobertura por la Call Activity");

  console.log("\n== C10 · póliza no vigente a la fecha del hecho");
  pi = await iniciar("AvisoReclamacion", { fechaHecho: s("2026-01-15"), inicioVigencia: s("2026-03-01"), finVigencia: s("2027-03-01") });
  ok(await terminada(pi) && await paso(pi, "EndEvent_C10_AvisoSinCobertura"), "sin vigencia, el aviso se cierra sin revisión");

  console.log("\n== C10 · temporizador no interruptor de 24 h");
  pi = await iniciar("AvisoReclamacion", { polizaVigente: b(true) });
  await completar(await tarea(pi, "Task_C10_RevisarAviso"), { montoReclamado: n(5000), exclusionDudosa: b(false) });
  t = await tarea(pi, "Task_C10_Preverificar");
  const r = await dispararTemporizador(pi);
  ok(r.status === 204, "se disparó el temporizador de 24 h");
  ok(await paso(pi, "EndEvent_C10_EstadoInformado"), "se informó el estado a la firma");
  ok(!!(await tarea(pi, "Task_C10_Preverificar")), "la preverificación siguió abierta (no interruptor)");
  await completar(t, { resultadoPreverificacion: s("RESERVA"), fundamentoPreverificacion: s("Cobertura con reserva") });
  ok(await terminada(pi) && await paso(pi, "EndEvent_C10_SiniestroRegistrado"), "luego terminó en Siniestro registrado");
}

// ---------------------------------------------------------------- C3
async function hastaPuntaje(inicio, capa2) {
  const pi = await iniciar("CuestionarioIniciado", { dominio: s("smithlee.com"), ...inicio });
  await correlacionar(pi, "RespuestasCuestionarioRecibidas", { puntajeCapa2: n(capa2) });
  return pi;
}
async function probarC3() {
  console.log("\n== C3 · FORTRESS: emisión automática");
  let pi = await hastaPuntaje({ puntajeCapa1: n(90) }, 90);
  ok(await terminada(pi) && await paso(pi, "EndEvent_C3_DecisionNotificada"), "terminó en Decisión notificada al canal");
  const preScore = await subprocesos(pi, "Process_C1_CalcularPreScore");
  ok(preScore.length === 1 && preScore[0].state === "COMPLETED", "la Call Activity ejecutó C1 Calcular el Pre-Score");
  ok((await variable(pi, "numeroPreguntas")) >= 8, "el cuestionario se armó con las señales de la Capa 1");
  ok((await variable(pi, "tier")) === "FORTRESS" && (await variable(pi, "decision")) === "ACCEPT", "la tabla DMN asignó FORTRESS y ACCEPT");
  ok((await variable(pi, "primaAnual")) === 1785, "prima anual = 420 × 5 × 0,85 = 1785");
  ok((await subprocesos(pi, "Process_C3_NotificarCanal")).length === 1, "la Call Activity ejecutó C3.1 Notificar la decisión al canal");

  console.log("\n== C3 · GUARDED: revisión humana que rechaza");
  pi = await hastaPuntaje({ puntajeCapa1: n(50) }, 50);
  let t = await tarea(pi, "Task_C3_RevisarCaso");
  ok(t?.formKey === "camunda-forms:deployment:C3-revisar-caso.form", "aparece Revisar el caso con su Camunda Form");
  ok(t?.due && Math.abs(new Date(t.due) - Date.now() - 48 * 3600e3) < 3600e3, "vence en 48 h");
  await completar(t, { decision: s("DECLINE"), justificacionDecision: s("Gobernanza insuficiente") });
  ok(await terminada(pi) && await paso(pi, "Task_C3_PlanMejora"), "pasó por el plan de mejora y terminó");

  console.log("\n== C3 · EXPOSED: revisión senior que acepta");
  pi = await hastaPuntaje({ puntajeCapa1: n(30) }, 30);
  await completar(await tarea(pi, "Task_C3_AnalizarCaso"), { recomendacionActuario: s("Aceptar con exclusión de litigios complejos") });
  t = await tarea(pi, "Task_C3_ResolverCaso");
  ok(t?.due && Math.abs(new Date(t.due) - Date.now() - 5 * 86400e3) < 3600e3, "la revisión senior vence en 5 días");
  await completar(t, { decision: s("ACCEPT"), justificacionDecision: s("Riesgo aceptable con condiciones") });
  ok(await terminada(pi) && (await variable(pi, "primaAnual")) === 2730, "terminó con cotización EXPOSED (prima 2730)");

  console.log("\n== C3 · revisión forzada por reclamo pagado");
  pi = await hastaPuntaje({ puntajeCapa1: n(90), reclamoPagado: b(true) }, 90);
  t = await tarea(pi, "Task_C3_RevisarCaso");
  ok(!!t, "con puntaje FORTRESS igual pasa a revisión humana");
  await completar(t, { decision: s("ACCEPT"), justificacionDecision: s("Reclamo menor ya cerrado") });
  ok(await terminada(pi), "la instancia terminó");

  console.log("\n== C3 · CRITICAL: se declina automáticamente");
  pi = await hastaPuntaje({ puntajeCapa1: n(10) }, 10);
  ok(await terminada(pi) && (await variable(pi, "decision")) === "DECLINE" && (await variable(pi, "fechaReevaluacion")), "DECLINE con plan de mejora y reevaluación");

  console.log("\n== C3 · temporizador de sesión (24 h)");
  pi = await iniciar("CuestionarioIniciado", { dominio: s("abandono.com") });
  await suscripcion(pi, "RespuestasCuestionarioRecibidas");
  ok((await dispararTemporizador(pi)).status === 204, "se disparó el vencimiento de la sesión");
  ok(await terminada(pi) && await paso(pi, "EndEvent_C3_EvaluacionAbandonada"), "terminó en Evaluación abandonada");
}

// ---------------------------------------------------------------- G3
const G3 = "G3-publicar-una-version-del-modelo-de-score";
async function iniciarG3(extra = {}) {
  return iniciar("NecesidadNuevaVersion", { motivo: s("Deriva detectada"), ...extra });
}
async function consolidarYCalibrar(pi, version) {
  await completar(await tarea(pi, "Task_G3_Consolidar"), {
    fuenteEvidencia: s("DERIVA"), resumenEvidencia: s("El loss ratio se desvió 12 %"), cambioPropuesto: s("Subir el peso de verificación de fuentes"),
  });
  await completar(await tarea(pi, "Task_G3_Calibrar"), {
    versionCandidata: s(version), datosCalibracion: s("Siniestros 2025-2026"), cambiosSenalesPesos: s("Verificación de fuentes de 10 a 15"),
  });
}
async function documentarYDecidir(pi, decision) {
  await completar(await tarea(pi, "Task_G3_Documentar"), { referenciaMemoria: s("MC-2026-11"), notaCambios: s("Recalibración por deriva") });
  await completar(await tarea(pi, "Task_G3_AprobarComite"), { decisionComite: s(decision) });
}
let workerG3;
// Reinicia el worker de G3 con otra respuesta del carrier. Libera las tareas que el worker anterior
// alcanzó a bloquear antes de cerrarse, para no esperar los 30 s de su bloqueo.
async function reiniciarWorkerG3(respuestaCarrier) {
  workerG3?.kill();
  await pausa(500);
  for (const t of (await api("/external-task?locked=true")).body ?? []) await post(`/external-task/${t.id}/unlock`);
  workerG3 = arrancarWorker(G3, { CARRIER_RESPUESTA: respuestaCarrier });
  await pausa(2500);
}
async function probarG3() {
  console.log("\n== G3 · camino feliz");
  let pi = await iniciarG3();
  await consolidarYCalibrar(pi, "score-v1.3");
  ok(!!(await tarea(pi, "Task_G3_Documentar")) && (await variable(pi, "validacionSuperada")) === true, "la tabla DMN aprobó la validación");
  await documentarYDecidir(pi, "APROBADA");
  ok(await terminada(pi) && await paso(pi, "EndEvent_G3_Publicada"), "el carrier aprobó y terminó en Versión publicada (evento de mensaje)");
  ok(await paso(pi, "Event_G3_RespuestaCarrier"), "la compuerta de eventos recibió la respuesta del carrier");
  const s2 = await subprocesos(pi, "Process_S2_DesplegarCambios");
  ok(s2.length === 1 && s2[0].state === "COMPLETED", "la Call Activity ejecutó S2 Desplegar cambios en plataforma");
  ok((await variable(pi, "versionVigente")) === "score-v1.3", "versión score-v1.3 registrada como vigente");

  console.log("\n== G3 · la validación falla y vuelve a calibración");
  pi = await iniciarG3({ simularValidacion: s("falla") });
  await consolidarYCalibrar(pi, "score-v1.4");
  let t = await tarea(pi, "Task_G3_Calibrar");
  ok(!!t, "la tabla DMN rechazó la validación y volvió a calibración");
  await completar(t, { versionCandidata: s("score-v1.4b"), datosCalibracion: s("x"), cambiosSenalesPesos: s("x") });
  ok(!!(await tarea(pi, "Task_G3_Documentar")), "la segunda validación pasó");

  console.log("\n== G3 · el comité pide ajustes y luego rechaza");
  await documentarYDecidir(pi, "AJUSTES");
  ok(!!(await tarea(pi, "Task_G3_Consolidar")), "el comité pidió ajustes y volvió a consolidar");
  await consolidarYCalibrar(pi, "score-v1.5");
  await documentarYDecidir(pi, "RECHAZADA");
  ok(await terminada(pi) && await paso(pi, "EndEvent_G3_Rechazada"), "terminó en Propuesta rechazada");

  console.log("\n== G3 · el despliegue falla y S2 revierte");
  pi = await iniciarG3({ simularDespliegue: s("falla") });
  await consolidarYCalibrar(pi, "score-v1.6");
  await documentarYDecidir(pi, "APROBADA");
  ok(await terminada(pi) && await paso(pi, "EndEvent_G3_Revertida"), "terminó en Despliegue revertido");
  ok((await subprocesos(pi, "Process_S2_DesplegarCambios"))[0]?.state === "COMPLETED" && await paso((await subprocesos(pi, "Process_S2_DesplegarCambios"))[0].id, "EndEvent_S2_Revertido"), "S2 terminó en Despliegue revertido");

  console.log("\n== G3 · el carrier rechaza");
  await reiniciarWorkerG3("rechaza");
  pi = await iniciarG3();
  await consolidarYCalibrar(pi, "score-v1.7");
  await documentarYDecidir(pi, "APROBADA");
  ok(await terminada(pi) && await paso(pi, "EndEvent_G3_NoAprobada"), "terminó en Versión no aprobada por el carrier");

  console.log("\n== G3 · el carrier no responde en 15 días");
  await reiniciarWorkerG3("silencio");
  pi = await iniciarG3();
  await consolidarYCalibrar(pi, "score-v1.8");
  await documentarYDecidir(pi, "APROBADA");
  await suscripcion(pi, "RespuestaCarrier");
  ok((await dispararTemporizador(pi)).status === 204, "se disparó el plazo de 15 días");
  ok(await terminada(pi) && await paso(pi, "EndEvent_G3_SinRespuesta"), "terminó en Sin respuesta del carrier");
}

// ---------------------------------------------------------------- ejecución
const version = await api("/version");
if (version.status !== 200) {
  console.error(`No responde Camunda en ${API}. Arranca Camunda Run antes de la prueba.`);
  process.exit(2);
}
console.log(`Camunda ${version.body.version} en ${API}`);
for (const p of PROCESOS) if (!(await desplegar(p))) process.exit(1);
const workers = PROCESOS.filter((p) => p !== G3).map((p) => arrancarWorker(p));
workerG3 = arrancarWorker(G3, { CARRIER_RESPUESTA: "aprueba" });
// Si la prueba termina por un error, los workers no deben quedar vivos.
process.on("exit", () => { workers.forEach((w) => w.kill()); workerG3?.kill(); });
await pausa(3000);
try {
  await probarC10();
  await probarC3();
  await probarG3();
} finally {
  workers.forEach((w) => w.kill());
  workerG3?.kill();
}
const incidentes = (await api("/incident")).body.length;
ok(incidentes === 0, `sin incidentes abiertos en el motor (${incidentes})`);
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : "\nTodas las comprobaciones pasaron");
process.exit(fallos ? 1 : 0);
