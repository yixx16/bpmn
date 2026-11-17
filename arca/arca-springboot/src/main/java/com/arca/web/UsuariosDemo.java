package com.arca.web;

import org.camunda.bpm.engine.IdentityService;
import org.camunda.bpm.engine.identity.Group;
import org.camunda.bpm.engine.identity.User;
import org.camunda.bpm.spring.boot.starter.event.PostDeployEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Crea los grupos candidatos que usan las tareas humanas de C10, C3 y G3 y un usuario de demo por grupo.
 * La contraseña de los usuarios de demo sale de la variable de entorno ARCA_DEMO_PASSWORD.
 */
@Component
public class UsuariosDemo {
    private static final Logger LOG = LoggerFactory.getLogger(UsuariosDemo.class);

    /** grupo → {nombre del grupo, usuario de demo, nombre del usuario}. */
    public static final Map<String, String[]> ROLES = new LinkedHashMap<>();

    static {
        ROLES.put("jefes-siniestros", new String[]{"Jefe de Siniestros (C10)", "jefe.siniestros", "Jefe de Siniestros"});
        ROLES.put("asesoria-juridica", new String[]{"Asesor Jurídico (C10)", "asesor.juridico", "Asesor Jurídico"});
        ROLES.put("suscriptores", new String[]{"Suscriptor (C3)", "suscriptor", "Suscriptor"});
        ROLES.put("actuarios", new String[]{"Actuario (C3) y Actuario Jefe (G3)", "actuario", "Actuario"});
        ROLES.put("direccion-suscripcion", new String[]{"Director de Suscripción (C3)", "director.suscripcion", "Director de Suscripción"});
        ROLES.put("ingenieria-datos", new String[]{"Ingeniero de Datos (G3)", "ingeniero.datos", "Ingeniero de Datos"});
        ROLES.put("comite-modelo", new String[]{"Comité de Modelo (G3)", "comite.modelo", "Comité de Modelo"});
    }

    private final IdentityService identityService;
    private final String clave;

    public UsuariosDemo(IdentityService identityService, @Value("${arca.demo-password}") String clave) {
        this.identityService = identityService;
        this.clave = clave;
    }

    @EventListener
    public void crear(PostDeployEvent evento) {
        ROLES.forEach((grupoId, datos) -> {
            if (identityService.createGroupQuery().groupId(grupoId).count() == 0) {
                Group grupo = identityService.newGroup(grupoId);
                grupo.setName(datos[0]);
                grupo.setType("WORKFLOW");
                identityService.saveGroup(grupo);
            }
            if (identityService.createUserQuery().userId(datos[1]).count() == 0) {
                User usuario = identityService.newUser(datos[1]);
                usuario.setFirstName(datos[2]);
                usuario.setLastName("ARCA");
                usuario.setPassword(clave);
                identityService.saveUser(usuario);
                identityService.createMembership(datos[1], grupoId);
                LOG.info("Usuario de demo {} creado en el grupo {}", datos[1], grupoId);
            }
        });
    }
}
