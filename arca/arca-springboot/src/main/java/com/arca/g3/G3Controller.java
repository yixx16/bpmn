package com.arca.g3;

import com.arca.web.Instancias;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.runtime.EventSubscription;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Panel interno para G3: el Actuario Jefe inicia una nueva versión (mensaje NecesidadNuevaVersion) y el carrier
 * responde (mensaje RespuestaCarrier). Responsable: Johan Sebastian Forero Agudelo.
 */
@RestController
@RequestMapping("/api/g3")
public class G3Controller {
    private static final String RESPUESTA_CARRIER = "RespuestaCarrier";
    private static final Set<String> ESCENARIOS = Set.of("ok", "falla");

    private final RuntimeService runtimeService;
    private final HistoryService historyService;
    private final Instancias instancias;

    public G3Controller(RuntimeService runtimeService, HistoryService historyService, Instancias instancias) {
        this.runtimeService = runtimeService;
        this.historyService = historyService;
        this.instancias = instancias;
    }

    public record NuevaVersion(String motivo, String simularValidacion, String simularDespliegue) {
    }

    public record RespuestaCarrier(Boolean aprobada, String comentario) {
    }

    @PostMapping("/versiones")
    public Map<String, String> iniciar(@RequestBody NuevaVersion v) {
        if (v.motivo() == null || v.motivo().isBlank()) {
            throw new IllegalArgumentException("Indica el motivo de la nueva versión");
        }
        Map<String, Object> variables = new HashMap<>();
        variables.put("motivo", v.motivo().trim());
        variables.put("simularValidacion", escenario(v.simularValidacion()));
        variables.put("simularDespliegue", escenario(v.simularDespliegue()));
        String clave = instancias.nuevaClave("VM");
        ProcessInstance pi = runtimeService.createMessageCorrelation("NecesidadNuevaVersion")
                .processInstanceBusinessKey(clave)
                .setVariables(variables)
                .correlateStartMessage();
        return Map.of("id", pi.getId(), "clave", clave);
    }

    @GetMapping("/versiones")
    public List<Map<String, Object>> versiones() {
        return historyService.createHistoricProcessInstanceQuery()
                .processDefinitionKey("Process_G3_PublicarVersionModelo")
                .orderByProcessInstanceStartTime().desc()
                .listPage(0, 20).stream()
                .map(instancias::resumen)
                .toList();
    }

    /** Versiones sometidas que esperan la respuesta del carrier. */
    @GetMapping("/carrier/pendientes")
    public List<Map<String, Object>> pendientes() {
        return runtimeService.createEventSubscriptionQuery().eventName(RESPUESTA_CARRIER).list().stream()
                .map(EventSubscription::getProcessInstanceId)
                .distinct()
                .map(id -> {
                    Map<String, Object> vars = instancias.variables(id);
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", id);
                    m.put("clave", instancias.activa(id).getBusinessKey());
                    m.put("versionCandidata", vars.get("versionCandidata"));
                    m.put("referenciaMemoria", vars.get("referenciaMemoria"));
                    m.put("notaCambios", vars.get("notaCambios"));
                    return m;
                })
                .toList();
    }

    @PostMapping("/carrier/{id}/respuesta")
    public Map<String, Object> responder(@PathVariable String id, @RequestBody RespuestaCarrier r) {
        if (r.aprobada() == null) {
            throw new IllegalArgumentException("Indica si el carrier aprueba la versión");
        }
        if (!instancias.esperaMensaje(id, RESPUESTA_CARRIER)) {
            throw new IllegalStateException("Esta versión no está esperando la respuesta del carrier");
        }
        Map<String, Object> variables = new HashMap<>();
        variables.put("aprobadaCarrier", r.aprobada());
        variables.put("comentarioCarrier", r.comentario() == null ? "" : r.comentario().trim());
        runtimeService.createMessageCorrelation(RESPUESTA_CARRIER)
                .processInstanceId(id)
                .setVariables(variables)
                .correlate();
        return Map.of("aprobadaCarrier", r.aprobada());
    }

    private static String escenario(String valor) {
        String v = valor == null || valor.isBlank() ? "ok" : valor;
        if (!ESCENARIOS.contains(v)) {
            throw new IllegalArgumentException("Escenario de prueba inválido: " + valor);
        }
        return v;
    }
}
