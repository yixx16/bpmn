// Workers (External Tasks, JavaScript) de G3 y S2 - ARCA
// Uso: npm install && node worker.js
const { Client, logger, Variables } = require('camunda-external-task-client-js');

const BASE_URL = process.env.CAMUNDA_URL || 'http://localhost:8080/engine-rest';
// Comportamiento simulado del carrier: aprueba | rechaza | silencio
const CARRIER = process.env.CARRIER_RESPUESTA || 'aprueba';
const CARRIER_DELAY_MS = Number(process.env.CARRIER_DELAY_MS || 8000);

const client = new Client({
  baseUrl: BASE_URL,
  use: logger,
  asyncResponseTimeout: 10000,
  lockDuration: 30000,
});

// ------------------------------------------------------------------ G3
// 1) Validar la versión: backtesting y sesgo (resultados simulados).
//    Variable de entrada opcional: simularValidacion = ok | falla  (por defecto ok)
client.subscribe('g3-validar-version', async ({ task, taskService }) => {
  const escenario = task.variables.get('simularValidacion') || 'ok';
  const resultados = escenario === 'falla'
    ? { auc: 0.64, desviacionLossRatio: 0.18, impactoDisparejo: 0.72 }
    : { auc: 0.78, desviacionLossRatio: 0.04, impactoDisparejo: 0.91 };
  console.log(`[G3] Validación (${escenario}):`, resultados);

  const vars = new Variables();
  vars.setTyped('auc', { type: 'double', value: resultados.auc });
  vars.setTyped('desviacionLossRatio', { type: 'double', value: resultados.desviacionLossRatio });
  vars.setTyped('impactoDisparejo', { type: 'double', value: resultados.impactoDisparejo });
  // Si la validación falla, la próxima vuelta simula una corrección exitosa
  vars.setTyped('simularValidacion', { type: 'string', value: 'ok' });
  await taskService.complete(task, vars);
});

// 2) Someter la versión al carrier (Send Task). Simula la respuesta del carrier
//    correlacionando el mensaje "RespuestaCarrier" por la API REST.
client.subscribe('g3-someter-carrier', async ({ task, taskService }) => {
  console.log(`[G3] Versión enviada al carrier (instancia ${task.processInstanceId}). Respuesta simulada: ${CARRIER}`);
  await taskService.complete(task);

  if (CARRIER === 'silencio') {
    console.log('[G3] El carrier no responderá: el timer de 15 días cerrará el proceso.');
    return;
  }
  setTimeout(async () => {
    try {
      const res = await fetch(`${BASE_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageName: 'RespuestaCarrier',
          processInstanceId: task.processInstanceId,
          processVariables: { aprobadaCarrier: { value: CARRIER === 'aprueba', type: 'Boolean' } },
        }),
      });
      console.log(`[G3] Respuesta del carrier correlacionada (HTTP ${res.status})`);
    } catch (e) {
      console.error('[G3] No se pudo correlacionar la respuesta del carrier:', e.message);
    }
  }, CARRIER_DELAY_MS);
});

// 3) Registrar vigencia y trazabilidad de la versión.
client.subscribe('g3-registrar-vigencia', async ({ task, taskService }) => {
  const version = task.variables.get('versionCandidata') || 'sin-identificador';
  console.log(`[G3] Versión ${version} registrada como vigente.`);
  const vars = new Variables();
  vars.setTyped('versionVigente', { type: 'string', value: version });
  vars.setTyped('fechaVigencia', { type: 'string', value: new Date().toISOString() });
  await taskService.complete(task, vars);
});

// 4) Evento final de mensaje: notifica "VersionModeloPublicada" (C1, C3, C7).
client.subscribe('g3-publicar-version', async ({ task, taskService }) => {
  console.log('[G3] Mensaje VersionModeloPublicada emitido hacia C1, C3 y C7.');
  await taskService.complete(task);
});

// ------------------------------------------------------------------ S2
client.subscribe('s2-desplegar-cambio', async ({ task, taskService }) => {
  console.log('[S2] Desplegando cambios en la plataforma...');
  await taskService.complete(task);
});

// Pruebas de humo. Variable opcional: simularDespliegue = ok | falla (por defecto ok)
client.subscribe('s2-pruebas-humo', async ({ task, taskService }) => {
  const escenario = task.variables.get('simularDespliegue') || 'ok';
  const saludable = escenario !== 'falla';
  console.log(`[S2] Pruebas de humo: ${saludable ? 'OK' : 'FALLARON'}`);
  const vars = new Variables();
  vars.setTyped('despliegueSaludable', { type: 'boolean', value: saludable });
  await taskService.complete(task, vars);
});

client.subscribe('s2-revertir-despliegue', async ({ task, taskService }) => {
  console.log('[S2] Revirtiendo al estado anterior.');
  const vars = new Variables();
  vars.setTyped('despliegueSaludable', { type: 'boolean', value: false });
  await taskService.complete(task, vars);
});

console.log(`Workers escuchando en ${BASE_URL} (carrier simulado: ${CARRIER})`);
