// Ayudante para presentar los procesos de ARCA en la web de Camunda.
// La web (Cockpit y Tasklist) sirve para ver y completar tareas, pero no puede enviar los mensajes
// que en ARCA llegan de sistemas externos ni adelantar temporizadores. Este script hace esa parte.
//
// Uso, desde la carpeta arca:
//   node pruebas/demo.mjs desplegar                  Despliega los tres procesos con sus DMN y formularios
//   node pruebas/demo.mjs workers                    Arranca los tres workers en esta terminal (Ctrl+C para detener)
//   node pruebas/demo.mjs iniciar <c10|c3|g3> [esc]  Inicia una instancia con un escenario preparado
//   node pruebas/demo.mjs responder [puntaje]        C3: la firma envía sus respuestas del cuestionario
//   node pruebas/demo.mjs carrier <aprobar|rechazar> G3: el carrier responde (si su worker corre con CARRIER_RESPUESTA=silencio)
//   node pruebas/demo.mjs vencer <c10|c3|g3>         Dispara ahora el temporizador pendiente del proceso
//   node pruebas/demo.mjs estado                     Muestra dónde está cada instancia y las tareas abiertas
//   node pruebas/demo.mjs historial                  Muestra en qué evento final terminaron las últimas instancias
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARCA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.CAMUNDA_URL ?? "http://localhost:8080/engine-rest";
const WEB = API.replace(/\/engine-rest\/?$/, "/camunda/app");

const PROCESOS = {
  c10: { carpeta: "C10-registrar-el-aviso-de-siniestro", clave: "Process_C10_RegistrarAvisoSiniestro", mensaje: "AvisoReclamacion" },
  c3: { carpeta: "C3-suscribir-la-solicitud", clave: "Process_C3_SuscribirSolicitud", mensaje: "CuestionarioIniciado" },
  g3: { carpeta: "G3-publicar-una-version-del-modelo-de-score", clave: "Process_G3_PublicarVersionModelo", mensaje: "NecesidadNuevaVersion" },
};

const s = (v) => ({ value: v, type: "String" });
const b = (v) => ({ value: v, type: "Boolean" });
const n = (v) => ({ value: v, type: "Double" });

// Escenarios: variables con las que arranca cada instancia.
const ESCENARIOS = {
  c10: {
    cubierto: { texto: "Póliza vigente; la revisión decide el camino", vars: { firma: s("Smith & Lee LLP"), polizaVigente: b(true) } },
    "sin-vigencia": {
      texto: "El hecho ocurrió antes de la vigencia: se cierra sin cobertura",
      vars: { firma: s("Smith & Lee LLP"), fechaHecho: s("2026-01-15"), inicioVigencia: s("2026-03-01"), finVigencia: s("2027-03-01") },
    },
  },
  c3: {
    fortress: { texto: "Puntaje 90: emisión automática", vars: { puntajeCapa1: n(90), puntajeCapa2Demo: n(90) } },
    guarded: { texto: "Puntaje 50: revisión humana del Suscriptor", vars: { puntajeCapa1: n(50), puntajeCapa2Demo: n(50) } },
    exposed: { texto: "Puntaje 30: Actuario y Director de Suscripción", vars: { puntajeCapa1: n(30), puntajeCapa2Demo: n(30) } },
    critical: { texto: "Puntaje 10: se declina con plan de mejora", vars: { puntajeCapa1: n(10), puntajeCapa2Demo: n(10) } },
    forzada: {
      texto: "Puntaje 90 con reclamo pagado: revisión humana forzada",
      vars: { puntajeCapa1: n(90), puntajeCapa2Demo: n(90), reclamoPagado: b(true) },
    },
  },
  g3: {
    normal: { texto: "Camino feliz: la versión se publica", vars: { motivo: s("Deriva detectada") } },
    "validacion-falla": {
      texto: "La primera validación falla y vuelve a calibración",
      vars: { motivo: s("Deriva detectada"), simularValidacion: s("falla") },
    },
    "despliegue-falla": {
      texto: "Las pruebas de humo de S2 fallan y el despliegue se revierte",
      vars: { motivo: s("Deriva detectada"), simularDespliegue: s("falla") },
    },
  },
};

async function api(ruta, opts = {}) {
  let r;
  try {
    r = await fetch(API + ruta, opts);
  } catch {
    salir(`No responde Camunda en ${API}. Arranca Camunda Run primero.`);
  }
  const t = await r.text();
  let body; try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body };
}
const post = (ruta, json) => api(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json ?? {}) });
function salir(msg) { console.error(msg); process.exit(1); }
const enlace = (pi) => `${WEB}/cockpit/default/#/process-instance/${pi}/runtime`;
const proceso = (k) => PROCESOS[k?.toLowerCase()] ?? salir(`Proceso desconocido "${k}". Usa c10, c3 o g3.`);
const hora = () => new Date().toTimeString().slice(0, 8).replaceAll(":", "");

// ---------------------------------------------------------------- comandos
async function desplegar() {
  for (const { carpeta } of Object.values(PROCESOS)) {
    const dir = path.join(ARCA, carpeta);
    const fd = new FormData();
    fd.append("deployment-name", carpeta);
    fd.append("deploy-changed-only", "true");
    const archivos = [
      ...(await readdir(dir)).filter((f) => /\.(bpmn|dmn)$/.test(f)).map((f) => path.join(dir, f)),
      ...(await readdir(path.join(dir, "forms"))).map((f) => path.join(dir, "forms", f)),
    ];
    for (const f of archivos) fd.append(path.basename(f), new Blob([await readFile(f)]), path.basename(f));
    const r = await api("/deployment/create", { method: "POST", body: fd });
    if (r.status !== 200) salir(`Falló el despliegue de ${carpeta}: ${JSON.stringify(r.body)}`);
    console.log(`Desplegado ${carpeta}: ${archivos.map((f) => path.basename(f)).join(", ")}`);
  }
  console.log(`\nAbre Cockpit para verlos: ${WEB}/cockpit/default/#/processes`);
}

async function workers() {
  for (const [k, { carpeta }] of Object.entries(PROCESOS)) {
    const dir = path.join(ARCA, carpeta, "worker");
    if (!existsSync(path.join(dir, "node_modules"))) salir(`Falta "npm install" en ${dir}`);
    const principal = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8")).main ?? "index.js";
    const w = spawn(process.execPath, [principal], { cwd: dir });
    const prefijo = `[${k.toUpperCase()}-worker] `;
    const imprimir = (d) => String(d).split(/\r?\n/)
      .filter((l) => l.trim() && !/polled 0 tasks/.test(l))
      .forEach((l) => console.log(prefijo + l));
    w.stdout.on("data", imprimir);
    w.stderr.on("data", imprimir);
    process.on("exit", () => w.kill());
  }
  console.log("Workers de C10, C3 y G3 en marcha. Deja esta terminal abierta; Ctrl+C para detenerlos.\n");
  process.on("SIGINT", () => process.exit(0));
}

async function iniciar(k, esc) {
  const p = proceso(k);
  const lista = ESCENARIOS[k.toLowerCase()];
  esc = esc ?? Object.keys(lista)[0];
  if (!lista[esc]) salir(`Escenarios de ${k}: ${Object.keys(lista).join(", ")}`);
  const businessKey = `${k.toUpperCase()}-${esc}-${hora()}`;
  const r = await post("/message", { messageName: p.mensaje, businessKey, processVariables: lista[esc].vars, resultEnabled: true });
  const pi = r.body?.[0]?.processInstance?.id;
  if (!pi) salir(`No se pudo iniciar: ${JSON.stringify(r.body)}. ¿Desplegaste los procesos?`);
  console.log(`Mensaje "${p.mensaje}" enviado: inició ${businessKey}`);
  console.log(`Escenario: ${lista[esc].texto}`);
  console.log(`Ver en Cockpit: ${enlace(pi)}`);
}

async function ultimaSuscripcion(evento) {
  const subs = (await api(`/event-subscription?eventName=${evento}&sortBy=created&sortOrder=desc`)).body;
  if (!subs?.length) salir(`Ninguna instancia está esperando el mensaje "${evento}".`);
  return subs[0].processInstanceId;
}

async function responder(puntaje) {
  const pi = await ultimaSuscripcion("RespuestasCuestionarioRecibidas");
  const demo = (await api(`/process-instance/${pi}/variables/puntajeCapa2Demo`)).body?.value;
  const valor = Number(puntaje ?? demo ?? 60);
  await post("/message", { messageName: "RespuestasCuestionarioRecibidas", processInstanceId: pi, processVariables: { puntajeCapa2: n(valor) } });
  console.log(`La firma envió sus respuestas (puntaje de Capa 2: ${valor}).`);
  console.log(`Ver en Cockpit: ${enlace(pi)}`);
}

async function carrier(respuesta) {
  if (!["aprobar", "rechazar"].includes(respuesta)) salir('Usa "carrier aprobar" o "carrier rechazar".');
  const pi = await ultimaSuscripcion("RespuestaCarrier");
  await post("/message", { messageName: "RespuestaCarrier", processInstanceId: pi, processVariables: { aprobadaCarrier: b(respuesta === "aprobar") } });
  console.log(`El carrier respondió: ${respuesta === "aprobar" ? "aprueba" : "rechaza"} la versión.`);
  console.log(`Ver en Cockpit: ${enlace(pi)}`);
}

async function vencer(k) {
  const p = proceso(k);
  const jobs = (await api(`/job?processDefinitionKey=${p.clave}&timers=true&sortBy=jobId&sortOrder=desc`)).body;
  if (!jobs?.length) salir(`No hay temporizadores pendientes en ${k.toUpperCase()}.`);
  const job = jobs[0];
  const r = await post(`/job/${job.id}/execute`);
  if (r.status !== 204) salir(`No se pudo disparar: ${JSON.stringify(r.body)}`);
  console.log(`Temporizador de ${k.toUpperCase()} disparado sin esperar el plazo real.`);
  console.log(`Ver en Cockpit: ${enlace(job.processInstanceId)}`);
}

function hojas(ai) {
  const hijos = ai.childActivityInstances ?? [];
  return hijos.length ? hijos.flatMap(hojas) : [ai.activityName ?? ai.activityId];
}

async function estado() {
  for (const [k, p] of Object.entries(PROCESOS)) {
    const instancias = (await api(`/process-instance?processDefinitionKey=${p.clave}`)).body ?? [];
    console.log(`\n${k.toUpperCase()}: ${instancias.length} instancia(s) en curso`);
    for (const pi of instancias) {
      const ai = (await api(`/process-instance/${pi.id}/activity-instances`)).body;
      console.log(`  ${pi.businessKey ?? pi.id}  →  ${hojas(ai).join(" | ")}`);
    }
  }
  const tareas = (await api("/task?sortBy=created&sortOrder=desc")).body.filter((t) => /_C10_|_C3_|_G3_/.test(t.taskDefinitionKey));
  console.log(`\nTareas abiertas en Tasklist: ${tareas.length}`);
  tareas.forEach((t) => console.log(`  ${t.name}${t.assignee ? ` (asignada a ${t.assignee})` : ""}`));
  console.log(`\nTasklist: ${WEB}/tasklist/default/`);
}

// Cockpit (edición gratuita) no muestra instancias terminadas; este comando sí.
async function historial() {
  for (const [k, p] of Object.entries(PROCESOS)) {
    const fin = (await api(`/history/process-instance?processDefinitionKey=${p.clave}&completed=true&sortBy=endTime&sortOrder=desc&maxResults=5`)).body ?? [];
    console.log(`\n${k.toUpperCase()}: últimas ${fin.length} instancia(s) completadas`);
    for (const pi of fin) {
      const actividades = (await api(`/history/activity-instance?processInstanceId=${pi.id}`)).body ?? [];
      const final = actividades.filter((a) => /EndEvent$/.test(a.activityType) && a.processInstanceId === pi.id)
        .sort((a, b) => a.endTime.localeCompare(b.endTime)).pop();
      console.log(`  ${pi.businessKey ?? pi.id}  →  terminó en "${final?.activityName ?? final?.activityId}" (${pi.endTime?.slice(11, 19)})`);
    }
  }
}

// ---------------------------------------------------------------- entrada
const [cmd, a1, a2] = process.argv.slice(2);
const comandos = {
  desplegar, workers, estado, historial,
  iniciar: () => iniciar(a1 ?? salir("Indica el proceso: c10, c3 o g3."), a2),
  responder: () => responder(a1), carrier: () => carrier(a1), vencer: () => vencer(a1 ?? salir("Indica el proceso: c10, c3 o g3.")),
};
if (!comandos[cmd]) {
  console.log("Comandos: desplegar | workers | iniciar <c10|c3|g3> [escenario] | responder [puntaje] | carrier <aprobar|rechazar> | vencer <c10|c3|g3> | estado | historial");
  for (const [k, lista] of Object.entries(ESCENARIOS)) console.log(`  Escenarios de ${k}: ${Object.keys(lista).join(", ")}`);
  process.exit(cmd ? 1 : 0);
}
await comandos[cmd]();
