package com.arca.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.camunda.bpm.engine.FormService;
import org.camunda.bpm.engine.IdentityService;
import org.camunda.bpm.engine.RepositoryService;
import org.camunda.bpm.engine.TaskService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.camunda.bpm.engine.task.Task;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bandeja de tareas por rol del panel interno. Las tareas se completan con el formulario Camunda (.form)
 * desplegado junto al proceso: el panel lo dibuja y aquí solo se aceptan los campos editables de ese formulario.
 */
@RestController
@RequestMapping("/api/panel")
public class PanelController {
    private final TaskService taskService;
    private final FormService formService;
    private final RepositoryService repositoryService;
    private final IdentityService identityService;
    private final Instancias instancias;
    private final ObjectMapper json;

    public PanelController(TaskService taskService, FormService formService, RepositoryService repositoryService,
                           IdentityService identityService, Instancias instancias, ObjectMapper json) {
        this.taskService = taskService;
        this.formService = formService;
        this.repositoryService = repositoryService;
        this.identityService = identityService;
        this.instancias = instancias;
        this.json = json;
    }

    @GetMapping("/roles")
    public List<Map<String, String>> roles() {
        List<Map<String, String>> roles = new ArrayList<>();
        UsuariosDemo.ROLES.forEach((grupo, d) -> roles.add(Map.of("grupo", grupo, "nombre", d[0], "usuario", d[1])));
        return roles;
    }

    @GetMapping("/tareas")
    public List<Map<String, Object>> tareas(@RequestParam String grupo) {
        List<Map<String, Object>> lista = new ArrayList<>();
        for (Task t : taskService.createTaskQuery().taskCandidateGroup(grupo).includeAssignedTasks()
                .orderByTaskCreateTime().asc().list()) {
            ProcessInstance pi = instancias.activa(t.getProcessInstanceId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("nombre", t.getName());
            m.put("proceso", repositoryService.getProcessDefinition(t.getProcessDefinitionId()).getName());
            m.put("clave", pi == null ? null : pi.getBusinessKey());
            m.put("firma", taskService.getVariable(t.getId(), "firma"));
            m.put("creada", t.getCreateTime());
            m.put("vence", t.getDueDate());
            m.put("asignada", t.getAssignee());
            lista.add(m);
        }
        return lista;
    }

    @GetMapping("/tareas/{id}/formulario")
    public Map<String, Object> formulario(@PathVariable String id) {
        Task t = tarea(id);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("nombre", t.getName());
        r.put("asignada", t.getAssignee());
        r.put("esquema", esquema(id));
        r.put("variables", taskService.getVariables(id));
        return r;
    }

    @PostMapping("/tareas/{id}/reclamar")
    public Map<String, String> reclamar(@PathVariable String id, @RequestBody Map<String, String> cuerpo) {
        String usuario = usuarioValido(id, cuerpo.get("usuario"));
        Task t = tarea(id);
        if (t.getAssignee() != null && !t.getAssignee().equals(usuario)) {
            throw new IllegalStateException("La tarea ya la reclamó " + t.getAssignee());
        }
        if (t.getAssignee() == null) {
            taskService.claim(id, usuario);
        }
        return Map.of("asignada", usuario);
    }

    @PostMapping("/tareas/{id}/completar")
    @SuppressWarnings("unchecked")
    public Map<String, String> completar(@PathVariable String id, @RequestBody Map<String, Object> cuerpo) {
        String usuario = usuarioValido(id, (String) cuerpo.get("usuario"));
        Map<String, Object> enviadas = (Map<String, Object>) cuerpo.getOrDefault("variables", Map.of());
        Task t = tarea(id);
        if (t.getAssignee() == null) {
            taskService.claim(id, usuario);
        } else if (!t.getAssignee().equals(usuario)) {
            throw new IllegalStateException("La tarea está asignada a " + t.getAssignee());
        }

        Map<String, Object> variables = new HashMap<>();
        for (JsonNode campo : esquema(id).path("components")) {
            String clave = campo.path("key").asText(null);
            if (clave == null || campo.path("readonly").asBoolean() || campo.path("disabled").asBoolean()) {
                continue;
            }
            Object valor = enviadas.get(clave);
            boolean vacio = valor == null || valor.toString().isBlank();
            if (vacio && campo.path("validate").path("required").asBoolean()) {
                throw new IllegalArgumentException("Falta el campo obligatorio: " + campo.path("label").asText(clave));
            }
            if ("checkbox".equals(campo.path("type").asText())) {
                variables.put(clave, Boolean.TRUE.equals(valor));
            } else if (!vacio) {
                variables.put(clave, valor instanceof Number n ? (Object) n.doubleValue() : valor);
            }
        }
        taskService.complete(id, variables);
        return Map.of("completada", t.getName());
    }

    private Task tarea(String id) {
        Task t = taskService.createTaskQuery().taskId(id).singleResult();
        if (t == null) {
            throw new IllegalStateException("La tarea ya no existe: otra persona la completó o el proceso avanzó");
        }
        return t;
    }

    /** El usuario debe pertenecer a alguno de los grupos candidatos de la tarea. */
    private String usuarioValido(String taskId, String usuario) {
        if (usuario == null || usuario.isBlank()) {
            throw new IllegalArgumentException("Falta el usuario que trabaja la tarea");
        }
        boolean autorizado = taskService.getIdentityLinksForTask(taskId).stream()
                .anyMatch(l -> l.getGroupId() != null
                        && identityService.createUserQuery().userId(usuario).memberOfGroup(l.getGroupId()).count() > 0);
        if (!autorizado) {
            throw new IllegalArgumentException("El usuario " + usuario + " no pertenece a un grupo candidato de la tarea");
        }
        return usuario;
    }

    private JsonNode esquema(String taskId) {
        try (InputStream in = formService.getDeployedTaskForm(taskId)) {
            return json.readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer el formulario de la tarea", e);
        }
    }
}
