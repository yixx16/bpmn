package com.arca.c10;

import com.arca.web.Instancias;
import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;

/**
 * Portal de la firma para C10: el aviso de reclamación que la firma envía es el mensaje
 * AvisoReclamacion que inicia el proceso. Responsable: Diego Alejandro Machado Tovar.
 */
@RestController
@RequestMapping("/api/c10")
public class C10Controller {
    private final RuntimeService runtimeService;
    private final Instancias instancias;

    public C10Controller(RuntimeService runtimeService, Instancias instancias) {
        this.runtimeService = runtimeService;
        this.instancias = instancias;
    }

    public record Aviso(String firma, String numeroPoliza, String fechaHecho, String inicioVigencia,
                        String finVigencia, String descripcionHecho) {
    }

    @PostMapping("/avisos")
    public Map<String, String> reportar(@RequestBody Aviso aviso) {
        obligatorio(aviso.firma(), "el nombre de la firma");
        obligatorio(aviso.numeroPoliza(), "el número de póliza");
        obligatorio(aviso.descripcionHecho(), "la descripción del hecho");
        LocalDate hecho = fecha(aviso.fechaHecho(), "la fecha del hecho", true);
        LocalDate inicio = fecha(aviso.inicioVigencia(), "el inicio de vigencia", false);
        LocalDate fin = fecha(aviso.finVigencia(), "el fin de vigencia", false);
        if ((inicio == null) != (fin == null)) {
            throw new IllegalArgumentException("Indica las dos fechas de vigencia o ninguna");
        }
        if (inicio != null && fin.isBefore(inicio)) {
            throw new IllegalArgumentException("El fin de vigencia es anterior al inicio");
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("firma", aviso.firma().trim());
        variables.put("numeroPoliza", aviso.numeroPoliza().trim());
        variables.put("descripcionHecho", aviso.descripcionHecho().trim());
        variables.put("fechaHecho", hecho.toString());
        if (inicio != null) {
            variables.put("inicioVigencia", inicio.toString());
            variables.put("finVigencia", fin.toString());
        }
        String clave = instancias.nuevaClave("AV");
        ProcessInstance pi = runtimeService.createMessageCorrelation("AvisoReclamacion")
                .processInstanceBusinessKey(clave)
                .setVariables(variables)
                .correlateStartMessage();
        return Map.of("id", pi.getId(), "clave", clave);
    }

    private static void obligatorio(String valor, String nombre) {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("Falta " + nombre);
        }
    }

    private static LocalDate fecha(String valor, String nombre, boolean obligatoria) {
        if (valor == null || valor.isBlank()) {
            if (obligatoria) {
                throw new IllegalArgumentException("Falta " + nombre);
            }
            return null;
        }
        try {
            return LocalDate.parse(valor);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Fecha inválida en " + nombre + ": usa AAAA-MM-DD");
        }
    }
}
