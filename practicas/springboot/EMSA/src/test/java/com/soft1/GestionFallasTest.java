package com.soft1;

import java.util.Map;

import org.camunda.bpm.engine.FormService;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.camunda.bpm.engine.task.Task;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:pruebasEMSA;DB_CLOSE_DELAY=-1")
class GestionFallasTest {
    @Autowired RuntimeService runtime;
    @Autowired TaskService tasks;
    @Autowired FormService forms;
    @Autowired HistoryService history;

    @ParameterizedTest(name = "Visita {0}, solución {1}, base {2}, extra {3}")
    @CsvSource({
        "true, manual, 100000, 15000",
        "true, especializada, 250000, 0",
        "true, sinIntervencion, 20000, 0",
        "true, sinSolucion, 20000, 5000",
        "false, sinIntervencion, 20000, 0"
    })
    void gestionaElReporteHastaElPago(boolean visita, String solucion, long base, long extra) {
        String id = runtime.startProcessInstanceByKey("gestionFallasEMSA", Map.of(
                "nombre", "Cliente de prueba", "domicilio", "Calle 10", "falla", "Falla de red")).getId();
        tasks.complete(tarea(id, "agendarVisita").getId());

        ProcessInstance procesoVisita = runtime.createProcessInstanceQuery().superProcessInstanceId(id).singleResult();
        String subId = procesoVisita.getId();
        assertThat(runtime.getVariables(subId)).containsEntry("falla", "Falla de red");
        forms.submitTaskForm(tarea(subId, "validarVisita").getId(), Map.of("visita", visita));
        if (visita) {
            tasks.complete(tarea(subId, "realizarReporteVisita").getId(), Map.of(
                    "tipoSolucion", solucion, "cobroExtra", extra, "descripcionSucedido", "Revisión terminada"));
        }
        assertThat(history.createHistoricProcessInstanceQuery().processInstanceId(subId).finished().count()).isOne();

        long total = base + extra;
        assertThat(runtime.getVariables(id)).containsEntry("tipoSolucion", solucion)
                .containsEntry("valor", base).containsEntry("cobroExtra", extra).containsEntry("valorTotal", total);
        assertThat(history.createHistoricActivityInstanceQuery().processInstanceId(id)
                .activityId("guardarFactura").finished().count()).isOne();
        tasks.complete(tarea(id, "generarFacturaDePago").getId());
        Task primerPago = tarea(id, "recibirPago");
        forms.submitTaskForm(primerPago.getId(), Map.of("valorPagado", total - 1));
        Task segundoPago = tarea(id, "recibirPago");
        assertThat(segundoPago.getId()).isNotEqualTo(primerPago.getId());
        forms.submitTaskForm(segundoPago.getId(), Map.of("valorPagado", total));

        assertThat(history.createHistoricActivityInstanceQuery().processInstanceId(id)
                .activityId("reporteGestionado").finished().count()).isOne();
        assertThat(history.createHistoricProcessInstanceQuery().processInstanceId(id).finished().count()).isOne();
        assertThat(tasks.createTaskQuery().processInstanceId(id).count()).isZero();
    }

    private Task tarea(String instancia, String actividad) {
        Task task = tasks.createTaskQuery().processInstanceId(instancia).taskDefinitionKey(actividad).singleResult();
        assertThat(task).as("Tarea activa %s", actividad).isNotNull();
        return task;
    }
}
