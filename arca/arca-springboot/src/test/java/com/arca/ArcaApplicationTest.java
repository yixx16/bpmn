package com.arca;

import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RepositoryService;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Arranca el motor con una base H2 en memoria y comprueba el despliegue y un recorrido corto de C10. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:arca;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "camunda.bpm.database.type=h2",
        "camunda.bpm.admin-user.password=prueba",
        "arca.demo-password=prueba",
        "spring.config.import=",
})
class ArcaApplicationTest {
    @Autowired
    RepositoryService repositoryService;
    @Autowired
    RuntimeService runtimeService;
    @Autowired
    TaskService taskService;
    @Autowired
    HistoryService historyService;

    @Test
    void despliegaLosSieteProcesosYLasTresDecisiones() {
        assertThat(repositoryService.createProcessDefinitionQuery().latestVersion().count()).isEqualTo(7);
        assertThat(repositoryService.createDecisionDefinitionQuery().latestVersion().count()).isEqualTo(3);
    }

    @Test
    void c10SinVigenciaSeCierraSinCobertura() {
        ProcessInstance pi = runtimeService.createMessageCorrelation("AvisoReclamacion")
                .processInstanceBusinessKey("AV-TEST")
                .setVariables(Map.of("firma", "Test LLP", "fechaHecho", "2026-01-15",
                        "inicioVigencia", "2026-03-01", "finVigencia", "2027-03-01"))
                .correlateStartMessage();
        assertThat(historyService.createHistoricProcessInstanceQuery().processInstanceId(pi.getId()).singleResult().getEndActivityId())
                .isEqualTo("EndEvent_C10_AvisoSinCobertura");
    }

    @Test
    void c10RevisionUsaElFormularioDesplegadoYCreaLaTareaDelJefe() {
        ProcessInstance pi = runtimeService.createMessageCorrelation("AvisoReclamacion")
                .processInstanceBusinessKey("AV-TEST-2")
                .setVariables(Map.of("firma", "Test LLP", "fechaHecho", "2026-10-01"))
                .correlateStartMessage();
        var tarea = taskService.createTaskQuery().processInstanceId(pi.getId()).taskCandidateGroup("jefes-siniestros").singleResult();
        assertThat(tarea.getTaskDefinitionKey()).isEqualTo("Task_C10_RevisarAviso");
    }
}
