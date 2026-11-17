// ARCA · componentes comunes en React (sin compilación: htm reemplaza a JSX).
// Requiere vendor/react, vendor/react-dom y vendor/htm cargados antes. Expone window.ARCA.
(function () {
  const { createElement, useState, useEffect, useCallback, useRef } = React;
  const html = htm.bind(createElement);

  // ---------- Datos
  async function api(ruta, opciones = {}) {
    const r = await fetch(ruta, {
      headers: { "Content-Type": "application/json" },
      ...opciones,
      body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
    });
    const texto = await r.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { error: texto }; }
    if (!r.ok) throw new Error(datos?.error ?? `Error ${r.status}`);
    return datos;
  }

  /** Carga datos y los vuelve a pedir cada `cadaMs`; devuelve [datos, error, recargar]. */
  function useDatos(cargar, deps, cadaMs = 5000) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const ref = useRef(cargar);
    ref.current = cargar;
    const recargar = useCallback(async () => {
      try { setDatos(await ref.current()); setError(null); } catch (e) { setError(e.message); }
    }, []);
    useEffect(() => {
      setDatos(null);
      recargar();
      if (!cadaMs) return undefined;
      const id = setInterval(recargar, cadaMs);
      return () => clearInterval(id);
    }, deps);
    return [datos, error, recargar];
  }

  function guardado(clave, inicial) {
    try { return localStorage.getItem(clave) ?? inicial; } catch { return inicial; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  }

  // ---------- Formato
  const fecha = (v) => v ? new Date(v).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "";
  const fechaCorta = (v) => v ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "";
  const usd = (v) => v === undefined || v === null || v === "" ? "" : "USD " + Number(v).toLocaleString("es-CO", { maximumFractionDigits: 0 });
  function hace(v) {
    if (!v) return "";
    const min = Math.round((Date.now() - new Date(v).getTime()) / 60000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
  }
  const iniciales = (t) => (t ?? "").split(/\s+/).filter((p) => /\w/.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

  /** Código corto del proceso a partir de su key o nombre. */
  function codigo(proceso) {
    const p = proceso ?? "";
    if (p.includes("C10")) return "C10";
    if (p.includes("C3") || p.includes("C1_") || p.includes("C1 ")) return "C3";
    if (p.includes("G3") || p.includes("S2")) return "G3";
    return "";
  }

  /** Tono del estado de una instancia según su evento final. */
  const FINALES = {
    "Siniestro registrado": "ok",
    "Versión publicada": "ok",
    "Aviso cerrado sin cobertura": "error",
    "Evaluación abandonada": "aviso",
    "Propuesta rechazada": "error",
    "Versión no aprobada por el carrier": "error",
    "Despliegue revertido": "error",
    "Sin respuesta del carrier": "aviso",
  };
  function tonoEstado(s) {
    if (s.activa) return "activo";
    if (s.estado === "Decisión notificada al canal") return s.variables?.decision === "ACCEPT" ? "ok" : "error";
    return FINALES[s.estado] ?? "neutro";
  }

  // ---------- Íconos (trazos de 24×24)
  const TRAZOS = {
    escudo: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z",
    alerta: "M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
    grafica: "M4 20V10m6 10V4m6 16v-7m4 7H2",
    bandeja: "M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6l2-8z",
    reloj: "M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z",
    ok: "M5 12l5 5 9-10",
    flecha: "M5 12h14m-6-6l6 6-6 6",
    usuario: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0",
    capas: "M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5m-18 4l9 5 9-5",
    edificio: "M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 8h1m3 0h1m3 0h1M8 12h1m3 0h1m3 0h1",
    monitor: "M3 4h18v12H3zM8 20h8m-4-4v4",
    mas: "M12 5v14M5 12h14",
  };
  function Icono({ n, t = 20 }) {
    return html`<svg width=${t} height=${t} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${TRAZOS[n]} /></svg>`;
  }

  // ---------- Piezas visuales
  function Topbar({ activo }) {
    const enlaces = [["index.html", "Inicio"], ["portal.html", "Portal de la firma"], ["panel.html", "Panel interno"]];
    return html`<header class="topbar"><div class="topbar-in">
      <a class="logo" href="index.html"><${Icono} n="escudo" t=${26} /> ARCA <small>AI Professional Malpractice</small></a>
      <nav>
        ${enlaces.map(([h, t]) => html`<a key=${h} href=${h} class=${activo === h ? "activo" : ""}>${t}</a>`)}
        <a href="camunda/app/cockpit/default/" target="_blank" rel="noopener">Cockpit ↗</a>
      </nav>
    </div></header>`;
  }

  const Pildora = ({ tono = "neutro", children, punto = true }) =>
    html`<span class=${`pildora tono-${tono}${punto ? "" : " sin-punto"}`}>${children}</span>`;
  const Proc = ({ c }) => c ? html`<span class=${"proc proc-" + c}>${c}</span>` : null;
  const Tier = ({ t }) => t ? html`<span class=${"tier tier-" + t}>${t}</span>` : null;

  /** Anillo de 0 a 100 coloreado por tier. */
  function Medidor({ valor, tier }) {
    const r = 27, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, Number(valor) || 0));
    const color = tier ? `var(--t-${tier.toLowerCase()})` : "var(--acento)";
    return html`<div class="medidor" title=${`Puntaje ${valor}`}>
      <svg width="64" height="64"><circle cx="32" cy="32" r=${r} fill="none" stroke="var(--borde)" stroke-width="6" />
        <circle cx="32" cy="32" r=${r} fill="none" stroke=${color} stroke-width="6" stroke-linecap="round"
          stroke-dasharray=${c} stroke-dashoffset=${c * (1 - v / 100)} /></svg>
      <span style=${{ color }}>${valor}</span></div>`;
  }

  const Vacio = ({ icono = "bandeja", titulo, children }) => html`<div class="vacio">
    <div class="icono-grande"><${Icono} n=${icono} t=${26} /></div><h3>${titulo}</h3><p>${children}</p></div>`;

  // ---------- Avisos flotantes
  let emitir = () => {};
  function avisar(texto, tono = "ok") { emitir({ id: Math.random(), texto, tono }); }
  function Avisos() {
    const [lista, setLista] = useState([]);
    useEffect(() => {
      emitir = (a) => {
        setLista((l) => [...l, a]);
        setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), 5000);
      };
    }, []);
    return html`<div class="avisos" role="status">${lista.map((a) => html`<div key=${a.id}
      class=${"aviso-flotante tono-" + a.tono}>${a.texto}</div>`)}</div>`;
  }

  function Modal({ titulo, sub, alCerrar, children }) {
    useEffect(() => {
      const tecla = (e) => e.key === "Escape" && alCerrar();
      addEventListener("keydown", tecla);
      return () => removeEventListener("keydown", tecla);
    }, []);
    return html`<div class="velo" onClick=${(e) => e.target === e.currentTarget && alCerrar()}>
      <div class="modal" role="dialog" aria-modal="true" aria-label=${titulo}>
        <div class="modal-cab"><div><h2>${titulo}</h2>${sub && html`<p class="sub">${sub}</p>`}</div>
          <button class="cerrar" onClick=${alCerrar} aria-label="Cerrar">×</button></div>
        <div class="modal-cuerpo">${children}</div></div></div>`;
  }

  /** Campo genérico con etiqueta. */
  const Campo = ({ etiqueta, requerido, ayuda, id, children }) => html`<div class="campo">
    <label htmlFor=${id}>${etiqueta}${requerido && html`<span class="requerido">*</span>`}</label>${children}
    ${ayuda && html`<div class="ayuda">${ayuda}</div>`}</div>`;

  // ---------- Formulario Camunda (.form) dibujado con React
  function valoresIniciales(esquema, variables) {
    const v = {};
    for (const c of esquema.components) if (c.key) v[c.key] = variables[c.key] ?? (c.type === "checkbox" ? false : "");
    return v;
  }
  function CampoCamunda({ c, valor, cambiar }) {
    const bloqueado = !!(c.readonly || c.disabled);
    const requerido = !!c.validate?.required && !bloqueado;
    const id = "campo_" + c.key;
    switch (c.type) {
      case "text":
        return html`<div class="texto-form">${String(c.text ?? "").split("\n").map((l, i) =>
          l.startsWith("#") ? html`<h3 key=${i}>${l.replace(/^#+\s*/, "")}</h3>` : html`<p key=${i}>${l}</p>`)}</div>`;
      case "checkbox":
        return html`<label class="casilla"><input id=${id} type="checkbox" checked=${!!valor} disabled=${bloqueado}
          onChange=${(e) => cambiar(e.target.checked)} /> ${c.label}</label>`;
      case "select":
      case "radio":
        if (bloqueado) {
          const elegido = (c.values ?? []).find((o) => o.value === valor);
          return html`<${Campo} etiqueta=${c.label} id=${id}><input id=${id} value=${elegido?.label ?? valor ?? ""} disabled /></${Campo}>`;
        }
        return html`<${Campo} etiqueta=${c.label} requerido=${requerido} id=${id}>
          <div class="opciones" role="radiogroup" aria-label=${c.label}>
            ${(c.values ?? []).map((o) => html`<label key=${o.value} class=${"opcion" + (valor === o.value ? " elegida" : "")}>
              <input type="radio" name=${c.key} value=${o.value} checked=${valor === o.value} required=${requerido}
                onChange=${() => cambiar(o.value)} />${o.label}</label>`)}
          </div></${Campo}>`;
      case "textarea":
        return html`<${Campo} etiqueta=${c.label} requerido=${requerido} id=${id}>
          <textarea id=${id} value=${valor ?? ""} disabled=${bloqueado} required=${requerido}
            onChange=${(e) => cambiar(e.target.value)} /></${Campo}>`;
      default:
        return html`<${Campo} etiqueta=${c.label} requerido=${requerido} id=${id}>
          <input id=${id} type=${c.type === "number" ? "number" : "text"} step="any" value=${valor ?? ""}
            disabled=${bloqueado} required=${requerido} onChange=${(e) => cambiar(e.target.value)} /></${Campo}>`;
    }
  }

  /** Convierte los valores del formulario a lo que espera la API: solo campos editables, números como número. */
  function valoresParaEnviar(esquema, valores) {
    const v = {};
    for (const c of esquema.components) {
      if (!c.key || c.readonly || c.disabled) continue;
      const x = valores[c.key];
      v[c.key] = c.type === "number" ? (x === "" || x === null ? null : Number(x)) : x;
    }
    return v;
  }

  window.ARCA = {
    html, api, useDatos, guardado, guardar, fecha, fechaCorta, usd, hace, iniciales, codigo, tonoEstado,
    Icono, Topbar, Pildora, Proc, Tier, Medidor, Vacio, Avisos, avisar, Modal, Campo,
    CampoCamunda, valoresIniciales, valoresParaEnviar,
    montar(Componente) { ReactDOM.createRoot(document.getElementById("app")).render(createElement(Componente)); },
  };
})();
