package com.arca.web;

import org.camunda.bpm.engine.HistoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Historial de la firma en el portal: sus avisos de siniestro (C10) y sus evaluaciones (C3) con su estado. */
@RestController
@RequestMapping("/api/portal")
public class PortalController {
    private final HistoryService historyService;
    private final Instancias instancias;

    public PortalController(HistoryService historyService, Instancias instancias) {
        this.historyService = historyService;
        this.instancias = instancias;
    }

    @GetMapping("/solicitudes")
    public List<Map<String, Object>> solicitudes(@RequestParam String firma) {
        if (firma.isBlank()) {
            throw new IllegalArgumentException("Indica el nombre de la firma");
        }
        return historyService.createHistoricProcessInstanceQuery()
                .processDefinitionKeyIn("Process_C10_RegistrarAvisoSiniestro", "Process_C3_SuscribirSolicitud")
                .matchVariableValuesIgnoreCase()
                .variableValueEquals("firma", firma.trim())
                .orderByProcessInstanceStartTime().desc()
                .list().stream()
                .map(pi -> {
                    Map<String, Object> r = instancias.resumen(pi);
                    r.put("esperaRespuestas", pi.getEndTime() == null
                            && instancias.esperaMensaje(pi.getId(), "RespuestasCuestionarioRecibidas"));
                    return r;
                })
                .toList();
    }
}
