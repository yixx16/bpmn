// ARCA · página de inicio
(function () {
  const { html, Topbar, Icono, Proc } = ARCA;

  const ACCESOS = [
    { href: "portal.html", icono: "edificio", titulo: "Portal de la firma",
      texto: "Para la firma de abogados: reportar un siniestro, solicitar la evaluación de riesgo de IA, responder el cuestionario y seguir cada solicitud." },
    { href: "panel.html", icono: "bandeja", titulo: "Panel interno",
      texto: "Para el equipo de ARCA: bandeja de tareas por rol, nueva versión del modelo de score y respuesta del carrier." },
    { href: "camunda/app/cockpit/default/", icono: "monitor", titulo: "Cockpit",
      texto: "Monitoreo de procesos e instancias en el motor Camunda 7. Entra con el usuario administrador." },
  ];
  const PROCESOS = [
    ["C10", "Registrar el aviso de siniestro", "La firma reporta una reclamación; ARCA verifica la póliza, pide concepto jurídico si hace falta y preverifica la cobertura."],
    ["C3", "Suscribir la solicitud", "Pre-Score de Capa 1, cuestionario de gobernanza de IA, tier y ruta de suscripción con revisión humana cuando aplica."],
    ["G3", "Publicar una versión del modelo de score", "Calibración, validación de sesgo, comité de modelo, aprobación del carrier y despliegue con reversión."],
  ];

  function Inicio() {
    return html`
      <${Topbar} activo="index.html" />
      <section class="hero"><div class="hero-in"><div>
        <h1>Seguro de mala praxis por uso de IA</h1>
        <p>ARCA mide el riesgo de IA de las firmas de abogados con evidencia y orquesta sus procesos de suscripción, siniestros y modelo de score con Camunda 7.</p>
      </div></div></section>
      <main class="contenedor">
        <div class="rejilla rejilla-3">
          ${ACCESOS.map((a) => html`<a key=${a.href} class="tarjeta acceso" href=${a.href}>
            <div class="icono-grande"><${Icono} n=${a.icono} t=${24} /></div>
            <h2>${a.titulo}</h2><p>${a.texto}</p>
            <span class="ir">Entrar →</span></a>`)}
        </div>
        <div class="seccion-titulo"><h2>Procesos orquestados</h2></div>
        <div class="tarjeta procesos-lista">
          ${PROCESOS.map(([c, n, t]) => html`<div key=${c}><${Proc} c=${c} /><div><b>${n}</b><p>${t}</p></div></div>`)}
        </div>
      </main>
      <footer class="pie">ARCA · MGA de responsabilidad profesional por uso de IA · Camunda 7 embebido en Spring Boot</footer>`;
  }

  ARCA.montar(Inicio);
})();
