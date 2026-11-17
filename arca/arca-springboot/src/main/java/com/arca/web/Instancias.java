package com.arca.web;

import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.history.HistoricActivityInstance;
import org.camunda.bpm.engine.history.HistoricProcessInstance;
import org.camunda.bpm.engine.history.HistoricVariableInstance;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Resume una instancia para las vistas: en qué paso está o en qué evento final terminó, y sus variables.
 * El estado se toma del historial del motor, así que no se guarda nada aparte.
 */
@Component
public class Instancias {
    private final HistoryService historyService;
    private final RuntimeService runtimeService;

    public Instancias(HistoryService historyService, RuntimeService runtimeService) {
        this.historyService = historyService;
        this.runtimeService = runtimeService;
    }

    public String nuevaClave(String prefijo) {
        return prefijo + "-" + Long.toString(Instant.now().toEpochMilli(), 36).toUpperCase();
    }

    public Map<String, Object> resumen(HistoricProcessInstance pi) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", pi.getId());
        r.put("clave", pi.getBusinessKey());
        r.put("proceso", pi.getProcessDefinitionName());
        r.put("procesoKey", pi.getProcessDefinitionKey());
        r.put("inicio", pi.getStartTime());
        r.put("fin", pi.getEndTime());
        boolean activa = pi.getEndTime() == null;
        r.put("activa", activa);
        r.put("estado", activa ? pasoActual(pi.getId()) : eventoFinal(pi.getId()));
        r.put("variables", variables(pi.getId()));
        return r;
    }

    public Map<String, Object> variables(String processInstanceId) {
        Map<String, Object> vars = new HashMap<>();
        for (HistoricVariableInstance v : historyService.createHistoricVariableInstanceQuery()
                .processInstanceId(processInstanceId).list()) {
            vars.put(v.getName(), v.getValue());
        }
        return vars;
    }

    public boolean esperaMensaje(String processInstanceId, String mensaje) {
        return runtimeService.createEventSubscriptionQuery()
                .processInstanceId(processInstanceId).eventName(mensaje).count() > 0;
    }

    public ProcessInstance activa(String processInstanceId) {
        return runtimeService.createProcessInstanceQuery().processInstanceId(processInstanceId).singleResult();
    }

    /** Pasos en curso, incluidos los del proceso invocado por una Call Activity. */
    private String pasoActual(String processInstanceId) {
        List<HistoricActivityInstance> abiertas = historyService.createHistoricActivityInstanceQuery()
                .processInstanceId(processInstanceId).unfinished().list();
        String pasos = abiertas.stream()
                .filter(a -> a.getActivityName() != null
                        && (!a.getActivityType().contains("Gateway") || "eventBasedGateway".equals(a.getActivityType())))
                .map(HistoricActivityInstance::getActivityName)
                .distinct()
                .collect(Collectors.joining(" · "));
        return pasos.isEmpty() ? "En proceso" : pasos;
    }

    private String eventoFinal(String processInstanceId) {
        return historyService.createHistoricActivityInstanceQuery()
                .processInstanceId(processInstanceId).finished()
                .orderByHistoricActivityInstanceEndTime().desc().list().stream()
                .filter(a -> a.getActivityType().endsWith("EndEvent"))
                .map(HistoricActivityInstance::getActivityName)
                .findFirst().orElse("Finalizada");
    }
}
