package com.arca.c3;

import com.arca.web.Instancias;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Portal de la firma para C3: iniciar la evaluación (mensaje CuestionarioIniciado) y responder el cuestionario
 * (mensaje RespuestasCuestionarioRecibidas). Responsable: Jesus Gregorio Delgado.
 */
@RestController
@RequestMapping("/api/c3")
public class C3Controller {
    /** Preguntas de gobernanza de IA de la Capa 2. Cada «sí» suma por igual al puntaje de Capa 2 (0 a 100). */
    static final List<String> PREGUNTAS = List.of(
            "¿La firma tiene una política escrita de uso de IA aprobada por los socios?",
            "¿Un abogado revisa siempre el trabajo generado con IA antes de entregarlo al cliente?",
            "¿Se verifican las citas y la jurisprudencia producidas por IA contra fuentes oficiales?",
            "¿Las herramientas de IA tienen acuerdos que impiden entrenar con datos de los clientes?",
            "¿Se informa a los clientes cuando la IA interviene en su asunto?",
            "¿El personal recibió capacitación sobre los riesgos de la IA en el último año?",
            "¿Existe un registro de las herramientas de IA autorizadas y de quién las usa?",
            "¿Hay un procedimiento para reportar y corregir errores atribuidos a la IA?");

    private final RuntimeService runtimeService;
    private final Instancias instancias;

    public C3Controller(RuntimeService runtimeService, Instancias instancias) {
        this.runtimeService = runtimeService;
        this.instancias = instancias;
    }

    public record Evaluacion(String firma, String dominio, Integer abogados) {
    }

    public record Respuestas(List<Boolean> respuestas, boolean reclamoPagado, boolean incidenteIA,
                             boolean tieneEOVigente, boolean declaracionVeracidad) {
    }

    @GetMapping("/cuestionario")
    public List<String> cuestionario() {
        return PREGUNTAS;
    }

    @PostMapping("/evaluaciones")
    public Map<String, String> iniciar(@RequestBody Evaluacion e) {
        if (e.firma() == null || e.firma().isBlank()) {
            throw new IllegalArgumentException("Falta el nombre de la firma");
        }
        if (e.dominio() == null || !e.dominio().trim().matches("[\\w.-]+\\.[a-zA-Z]{2,}")) {
            throw new IllegalArgumentException("Indica el dominio web de la firma, por ejemplo smithlee.com");
        }
        if (e.abogados() == null || e.abogados() < 1) {
            throw new IllegalArgumentException("Indica cuántos abogados tiene la firma");
        }
        Map<String, Object> variables = new HashMap<>();
        variables.put("firma", e.firma().trim());
        variables.put("dominio", e.dominio().trim().toLowerCase());
        variables.put("abogados", e.abogados().longValue());
        String clave = instancias.nuevaClave("EV");
        ProcessInstance pi = runtimeService.createMessageCorrelation("CuestionarioIniciado")
                .processInstanceBusinessKey(clave)
                .setVariables(variables)
                .correlateStartMessage();
        return Map.of("id", pi.getId(), "clave", clave);
    }

    @PostMapping("/evaluaciones/{id}/respuestas")
    public Map<String, Object> responder(@PathVariable String id, @RequestBody Respuestas r) {
        if (r.respuestas() == null || r.respuestas().size() != PREGUNTAS.size() || r.respuestas().contains(null)) {
            throw new IllegalArgumentException("Responde las " + PREGUNTAS.size() + " preguntas");
        }
        if (!r.declaracionVeracidad()) {
            throw new IllegalArgumentException("Debes aceptar la declaración de veracidad");
        }
        if (!instancias.esperaMensaje(id, "RespuestasCuestionarioRecibidas")) {
            throw new IllegalStateException("Esta evaluación no está esperando respuestas");
        }
        long si = r.respuestas().stream().filter(Boolean::booleanValue).count();
        double puntajeCapa2 = Math.round(100.0 * si / PREGUNTAS.size());

        Map<String, Object> variables = new HashMap<>();
        variables.put("puntajeCapa2", puntajeCapa2);
        variables.put("reclamoPagado", r.reclamoPagado());
        variables.put("incidenteIA", r.incidenteIA());
        variables.put("sinEOVigente", !r.tieneEOVigente());
        variables.put("declaracionVeracidad", true);
        runtimeService.createMessageCorrelation("RespuestasCuestionarioRecibidas")
                .processInstanceId(id)
                .setVariables(variables)
                .correlate();
        return Map.of("puntajeCapa2", puntajeCapa2);
    }
}
