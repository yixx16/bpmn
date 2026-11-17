// ARCA · Panel interno: bandeja de tareas por rol de C10, C3 y G3, nueva versión del modelo y respuesta del carrier
(function () {
  const { useState, useEffect } = React;
  const { html, api, useDatos, guardado, guardar, fecha, usd, hace, iniciales, codigo, tonoEstado,
    Icono, Topbar, Pildora, Proc, Tier, Vacio, Avisos, avisar, Campo,
    CampoCamunda, valoresIniciales, valoresParaEnviar } = ARCA;

  const CARRIER = { grupo: "carrier", nombre: "Carrier", usuario: "carrier" };
  // Cómo se agrupan los roles en el menú lateral (un rol puede aparecer en dos procesos)
  const MENU = [
    ["Siniestros · C10", "C10", [["jefes-siniestros", "Jefe de Siniestros"], ["asesoria-juridica", "Asesor Jurídico"]]],
    ["Suscripción · C3", "C3", [["suscriptores", "Suscriptor"], ["actuarios", "Actuario"], ["direccion-suscripcion", "Director de Suscripción"]]],
    ["Modelo de score · G3", "G3", [["actuarios", "Actuario Jefe"], ["ingenieria-datos", "Ingeniero de Datos"], ["comite-modelo", "Comité de Modelo"]]],
    ["Externo", "G3", [["carrier", "Carrier"]]],
  ];
  const ROLES_G3 = ["actuarios", "ingenieria-datos", "comite-modelo", "carrier"];

  // Variables que dan contexto a quien trabaja la tarea: etiqueta y formato
  const si = (v) => (v ? "Sí" : "No");
  const CONTEXTO = [
    ["firma", "Firma"], ["numeroPoliza", "Póliza"], ["fechaHecho", "Fecha del hecho"],
    ["limiteCobertura", "Límite de cobertura", usd], ["deducible", "Deducible", usd],
    ["requiereConceptoJuridico", "Requiere concepto jurídico", si],
    ["dominio", "Dominio"], ["abogados", "Abogados"], ["puntajeCapa1", "Pre-Score", Math.round],
    ["puntajeCapa2", "Puntaje del cuestionario", Math.round], ["reclamoPagado", "Reclamo pagado", si],
    ["incidenteIA", "Incidente de IA", si], ["sinEOVigente", "Sin E&O vigente", si],
    ["motivo", "Motivo"], ["versionCandidata", "Versión candidata"], ["auc", "AUC"],
    ["desviacionLossRatio", "Desviación del loss ratio"], ["impactoDisparejo", "Impacto dispar"],
    ["referenciaMemoria", "Memoria de cálculo"],
    ["descripcionHecho", "Descripción del hecho", null, true], ["exclusionesPoliza", "Exclusiones de la póliza", null, true],
    ["notaCambios", "Nota de cambios", null, true],
  ];

  // ---------- Detalle de la tarea con su formulario Camunda
  function DetalleTarea({ tarea, usuario, alTerminar }) {
    const [f, setF] = useState(null);
    const [valores, setValores] = useState({});
    const [ocupado, setOcupado] = useState(false);
    useEffect(() => {
      setF(null);
      api(`/api/panel/tareas/${tarea.id}/formulario`)
        .then((r) => { setF(r); setValores(valoresIniciales(r.esquema, r.variables)); })
        .catch((e) => avisar(e.message, "error"));
    }, [tarea.id]);
    if (!f) return html`<div class="tarjeta cargando">Cargando formulario…</div>`;

    const deOtro = f.asignada && f.asignada !== usuario;
    async function accion(ruta, body, exito) {
      setOcupado(true);
      try {
        const r = await api(ruta, { method: "POST", body });
        avisar(exito(r));
        return r;
      } catch (e) { avisar(e.message, "error"); return null; } finally { setOcupado(false); }
    }
    async function reclamar() {
      const r = await accion(`/api/panel/tareas/${tarea.id}/reclamar`, { usuario }, (x) => `Tarea reclamada por ${x.asignada}`);
      if (r) setF({ ...f, asignada: r.asignada });
    }
    async function completar(e) {
      e.preventDefault();
      const r = await accion(`/api/panel/tareas/${tarea.id}/completar`,
        { usuario, variables: valoresParaEnviar(f.esquema, valores) }, (x) => `«${x.completada}» completada`);
      if (r) alTerminar();
    }
    const contexto = CONTEXTO.filter(([k]) => f.variables[k] !== undefined && f.variables[k] !== null && f.variables[k] !== "");
    return html`<form class="tarjeta" onSubmit=${completar}>
      <div class="tarjeta-cab"><div>
        <div style=${{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <${Proc} c=${codigo(tarea.proceso)} /><span class="sub" style=${{ margin: 0 }}>${tarea.proceso} · ${tarea.clave ?? ""}</span></div>
        <h2>${f.nombre}</h2></div>
        ${f.asignada ? html`<${Pildora} tono=${deOtro ? "aviso" : "activo"}>Asignada a ${f.asignada}</${Pildora}>`
                     : html`<${Pildora} tono="neutro">Sin asignar</${Pildora}>`}
      </div>
      ${contexto.length > 0 && html`<div class="contexto">${contexto.map(([k, et, fmt, ancho]) => html`<div key=${k} class=${ancho ? "ancho" : ""}>
        <span>${et}</span>${fmt ? fmt(f.variables[k]) : String(f.variables[k])}</div>`)}</div>`}
      ${f.esquema.components.map((c, i) => html`<${CampoCamunda} key=${c.key ?? i} c=${c} valor=${valores[c.key]}
        cambiar=${(v) => setValores((actual) => ({ ...actual, [c.key]: v }))} />`)}
      <div class="acciones">
        <button class="btn btn-primario" disabled=${ocupado || deOtro}><${Icono} n="ok" t=${18} /> Completar tarea</button>
        ${!f.asignada && html`<button type="button" class="btn btn-secundario" disabled=${ocupado} onClick=${reclamar}>Reclamar</button>`}
      </div>
    </form>`;
  }

  // ---------- Bandeja del rol
  function Bandeja({ rol, tareas, recargar }) {
    const [abierta, setAbierta] = useState(null);
    useEffect(() => { setAbierta(null); }, [rol.grupo]);
    useEffect(() => {
      if (abierta && tareas && !tareas.some((t) => t.id === abierta.id)) setAbierta(null);
    }, [tareas]);
    if (!tareas) return html`<div class="tarjeta cargando">Cargando tareas…</div>`;
    const sinAsignar = tareas.filter((t) => !t.asignada).length;
    const mias = tareas.filter((t) => t.asignada === rol.usuario).length;
    const vencen = tareas.filter((t) => t.vence && new Date(t.vence) - Date.now() < 24 * 3600 * 1000).length;
    return html`
      <div class="kpis">
        <div class="tarjeta kpi"><b>${tareas.length}</b><span>Tareas pendientes</span></div>
        <div class="tarjeta kpi"><b>${sinAsignar}</b><span>Sin asignar</span></div>
        <div class="tarjeta kpi"><b>${mias}</b><span>Asignadas a mí</span></div>
        <div class="tarjeta kpi"><b style=${{ color: vencen ? "var(--error)" : "" }}>${vencen}</b><span>Vencen en 24 h</span></div>
      </div>
      ${!tareas.length ? html`<div class="tarjeta"><${Vacio} icono="ok" titulo="Bandeja al día">No hay tareas pendientes para ${rol.nombre}.</${Vacio}></div>`
      : html`<div class="tareas">
          ${tareas.map((t) => {
            const c = codigo(t.proceso);
            return html`<button key=${t.id} type="button" class=${"tarea" + (abierta?.id === t.id ? " abierta" : "")} onClick=${() => setAbierta(t)}>
              <span class="barra" style=${{ background: `var(--${c.toLowerCase()})` }} />
              <div><h3>${t.nombre}</h3>
                <div class="meta"><${Proc} c=${c} /><span>${t.clave ?? ""}</span>${t.firma && html`<span>${t.firma}</span>`}</div></div>
              <div class="tarea-lado"><span>${hace(t.creada)}</span>
                ${t.asignada ? html`<${Pildora} tono="activo">${t.asignada}</${Pildora}>` : html`<${Pildora} tono="neutro">Sin asignar</${Pildora}>`}
                ${t.vence && html`<span title=${fecha(t.vence)}>Vence ${new Date(t.vence) < Date.now() ? "vencida" : fecha(t.vence)}</span>`}</div>
            </button>`;
          })}</div>
        ${abierta && html`<div style=${{ marginTop: 20 }}><${DetalleTarea} key=${abierta.id} tarea=${abierta} usuario=${rol.usuario}
          alTerminar=${() => { setAbierta(null); recargar(); }} /></div>`}`}`;
  }

  // ---------- G3: nueva versión, carrier y versiones
  function NuevaVersion({ listo }) {
    const [d, setD] = useState({ motivo: "", simularValidacion: "ok", simularDespliegue: "ok" });
    const [enviando, setEnviando] = useState(false);
    async function iniciar(e) {
      e.preventDefault();
      setEnviando(true);
      try {
        const r = await api("/api/g3/versiones", { method: "POST", body: d });
        avisar(`Solicitud ${r.clave} iniciada. «Consolidar la evidencia» está en tu bandeja.`);
        setD({ ...d, motivo: "" });
        listo();
      } catch (err) { avisar(err.message, "error"); } finally { setEnviando(false); }
    }
    const set = (k) => (e) => { const v = e.target.value; setD((x) => ({ ...x, [k]: v })); };
    return html`<form class="tarjeta" onSubmit=${iniciar} style=${{ marginBottom: 20 }}>
      <div class="tarjeta-cab"><div><h2><${Proc} c="G3" /> Nueva versión del modelo de score</h2>
        <p>Como Actuario Jefe, registra la necesidad de una nueva versión por siniestralidad, deriva, un vertical nuevo o un fallo.</p></div></div>
      <${Campo} etiqueta="Motivo" requerido id="motivo">
        <input id="motivo" value=${d.motivo} onChange=${set("motivo")} required placeholder="Deriva del modelo detectada en el último trimestre" /></${Campo}>
      <div class="fila-campos">
        <${Campo} etiqueta="Escenario de prueba · validación" id="simVal">
          <select id="simVal" value=${d.simularValidacion} onChange=${set("simularValidacion")}>
            <option value="ok">Pasa la validación</option><option value="falla">Falla la primera vez y vuelve a calibración</option></select></${Campo}>
        <${Campo} etiqueta="Escenario de prueba · despliegue S2" id="simDes">
          <select id="simDes" value=${d.simularDespliegue} onChange=${set("simularDespliegue")}>
            <option value="ok">Pruebas de humo correctas</option><option value="falla">Pruebas de humo fallan y se revierte</option></select></${Campo}>
      </div>
      <div class="acciones" style=${{ marginTop: 4 }}><button class="btn btn-primario" disabled=${enviando}><${Icono} n="mas" t=${18} /> Iniciar G3</button></div>
    </form>`;
  }

  function VistaCarrier({ recargarVersiones }) {
    const [pendientes, error, recargar] = useDatos(() => api("/api/g3/carrier/pendientes"), []);
    const [comentarios, setComentarios] = useState({});
    async function responder(p, aprobada) {
      try {
        await api(`/api/g3/carrier/${p.id}/respuesta`, { method: "POST", body: { aprobada, comentario: comentarios[p.id] ?? "" } });
        avisar(`Versión ${p.versionCandidata} ${aprobada ? "aprobada" : "rechazada"}`, aprobada ? "ok" : "aviso");
        recargar(); recargarVersiones();
      } catch (e) { avisar(e.message, "error"); }
    }
    return html`<div class="tarjeta">
      <div class="tarjeta-cab"><div><h2>Versiones sometidas a aprobación</h2>
        <p>El carrier aprueba o rechaza cada versión del modelo. Sin respuesta en 15 días, el proceso se cierra.</p></div></div>
      ${error && html`<${Pildora} tono="error">${error}</${Pildora}>`}
      ${pendientes && !pendientes.length && html`<${Vacio} icono="escudo" titulo="Nada por aprobar">No hay versiones esperando la respuesta del carrier.</${Vacio}>`}
      ${(pendientes ?? []).map((p) => html`<div key=${p.id} class="version">
        <div class="tarjeta-cab" style=${{ marginBottom: 8 }}><div><h3>Versión ${p.versionCandidata ?? "sin identificador"}</h3>
          <p class="sub">${p.clave} · memoria de cálculo ${p.referenciaMemoria ?? "-"}</p></div><${Pildora} tono="aviso">Esperando respuesta</${Pildora}></div>
        <p style=${{ fontSize: ".9rem", marginBottom: 12 }}>${p.notaCambios}</p>
        <input aria-label="Comentario del carrier" placeholder="Comentario del carrier (opcional)" value=${comentarios[p.id] ?? ""}
          onChange=${(e) => { const v = e.target.value; setComentarios((c) => ({ ...c, [p.id]: v })); }} />
        <div class="acciones" style=${{ marginTop: 12 }}>
          <button class="btn btn-ok" onClick=${() => responder(p, true)}><${Icono} n="ok" t=${18} /> Aprobar</button>
          <button class="btn btn-peligro" onClick=${() => responder(p, false)}>Rechazar</button></div>
      </div>`)}
    </div>`;
  }

  function Versiones({ versiones }) {
    if (!versiones) return null;
    return html`<div class="seccion-titulo"><h2>Versiones del modelo</h2><span class="sub">Últimas 20 solicitudes de G3</span></div>
      <div class="tarjeta">${!versiones.length ? html`<${Vacio} icono="capas" titulo="Sin versiones">Aún no se ha iniciado G3.</${Vacio}>`
      : html`<div class="tabla"><table>
        <thead><tr><th>Solicitud</th><th>Versión</th><th>Motivo</th><th>Inicio</th><th>Estado</th></tr></thead>
        <tbody>${versiones.map((v) => html`<tr key=${v.id}><td>${v.clave}</td><td><b>${v.variables.versionCandidata ?? "—"}</b></td>
          <td>${v.variables.motivo}</td><td>${fecha(v.inicio)}</td>
          <td><${Pildora} tono=${tonoEstado(v)}>${v.estado}</${Pildora}></td></tr>`)}</tbody></table></div>`}</div>`;
  }

  // ---------- Página
  function Panel() {
    const [roles] = useDatos(async () => [...(await api("/api/panel/roles")), CARRIER], [], 0);
    const [grupo, setGrupo] = useState(() => guardado("arca.rol", "jefes-siniestros"));
    // Tareas de todos los grupos, para los contadores del menú y la bandeja del rol elegido
    const [todas, , recargarTareas] = useDatos(async () => {
      if (!roles) return null;
      const pares = await Promise.all(roles.filter((r) => r.grupo !== "carrier")
        .map(async (r) => [r.grupo, await api(`/api/panel/tareas?grupo=${encodeURIComponent(r.grupo)}`)]));
      return Object.fromEntries(pares);
    }, [roles]);
    const esG3 = ROLES_G3.includes(grupo);
    const [versiones, , recargarVersiones] = useDatos(() => (esG3 ? api("/api/g3/versiones") : Promise.resolve(null)), [esG3]);
    if (!roles) return html`<${Topbar} activo="panel.html" /><p class="cargando">Cargando…</p>`;

    const rol = roles.find((r) => r.grupo === grupo) ?? roles[0];
    const elegir = (g) => { guardar("arca.rol", g); setGrupo(g); };
    const NOMBRES = Object.fromEntries(MENU.flatMap(([, , items]) => items));
    return html`
      <${Topbar} activo="panel.html" />
      <main class="contenedor"><div class="panel">
        <aside class="tarjeta lateral" aria-label="Roles">
          ${MENU.map(([titulo, c, items]) => html`<div key=${titulo}><h4>${titulo}</h4>
            ${items.map(([g, nombre]) => {
              const n = todas?.[g]?.length ?? 0;
              return html`<button key=${g + nombre} class=${"rol" + (rol.grupo === g ? " activo" : "")} onClick=${() => elegir(g)}>
                <span class="punto-proc" style=${{ background: `var(--${c.toLowerCase()})` }} />${nombre}
                ${g !== "carrier" && html`<span class=${"contador" + (n ? " hay" : "")}>${n}</span>`}</button>`;
            })}</div>`)}
        </aside>
        <section>
          <div class="tarjeta" style=${{ marginBottom: 20 }}><div class="usuario-actual">
            <div class="avatar">${iniciales(NOMBRES[rol.grupo] ?? rol.nombre)}</div>
            <div><h2 style=${{ fontSize: "1.1rem" }}>${rol.grupo === "carrier" ? "Carrier" : rol.nombre}</h2>
              <p class="sub">${rol.grupo === "carrier" ? "Actor externo: aprueba la capacidad y las versiones del modelo."
                : html`Trabajas como <b>${rol.usuario}</b> · grupo ${rol.grupo}`}</p></div>
          </div></div>
          ${rol.grupo === "actuarios" && html`<${NuevaVersion} listo=${() => { recargarTareas(); recargarVersiones(); }} />`}
          ${rol.grupo === "carrier" ? html`<${VistaCarrier} recargarVersiones=${recargarVersiones} />`
            : html`<${Bandeja} rol=${rol} tareas=${todas?.[rol.grupo]} recargar=${() => { recargarTareas(); recargarVersiones(); }} />`}
          ${esG3 && html`<${Versiones} versiones=${versiones} />`}
        </section>
      </div></main>
      <${Avisos} />`;
  }

  ARCA.montar(Panel);
})();
