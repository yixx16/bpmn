package com.arca.c10;

import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.util.concurrent.ThreadLocalRandom;

import static com.arca.Variables.fecha;
import static com.arca.Variables.numero;
import static com.arca.Variables.texto;

/**
 * C10 Registrar el aviso de siniestro y C10.1 Comunicar a la firma.
 * Responsable: Diego Alejandro Machado Tovar.
 * Cada bean atiende la tarea de servicio cuyo delegateExpression lleva su nombre.
 * Misma lógica simulada que worker/index.js: en ARCA cada tarea llamaría al Motor de siniestros.
 */
@Configuration
public class C10Delegates {
    private static final Logger LOG = LoggerFactory.getLogger(C10Delegates.class);

    @Bean
    public JavaDelegate c10AcusarRecibo() {
        return ex -> {
            LOG.info("[C10] Acuse de recibo enviado a {}", texto(ex, "firma", "la firma asegurada"));
            ex.setVariable("fechaAcuse", Instant.now().toString());
        };
    }

    /** La póliza debe estar vigente a la fecha del hecho. Sin fechas, respeta polizaVigente o asume vigente. */
    @Bean
    public JavaDelegate c10VerificarVigencia() {
        return ex -> {
            LocalDate hecho = fecha(ex, "fechaHecho");
            LocalDate inicio = fecha(ex, "inicioVigencia");
            LocalDate fin = fecha(ex, "finVigencia");
            boolean vigente;
            if (hecho != null && inicio != null && fin != null) {
                vigente = !hecho.isBefore(inicio) && !hecho.isAfter(fin);
            } else {
                Object informado = ex.getVariable("polizaVigente");
                vigente = informado == null || Boolean.parseBoolean(informado.toString());
            }
            LOG.info("[C10] Póliza vigente a la fecha del hecho: {}", vigente);
            ex.setVariable("polizaVigente", vigente);
        };
    }

    @Bean
    public JavaDelegate c10RecuperarPoliza() {
        return ex -> {
            ex.setVariable("limiteCobertura", numero(ex, "limiteCobertura", 1_000_000));
            ex.setVariable("deducible", numero(ex, "deducible", 10_000));
            ex.setVariable("exclusionesPoliza", "Uso de IA sin supervisión humana; actos dolosos; multas y sanciones");
            LOG.info("[C10] Póliza, límites, exclusiones y expediente de suscripción recuperados");
        };
    }

    @Bean
    public JavaDelegate c10AbrirExpediente() {
        return ex -> {
            String numeroExpediente = String.format("SIN-%d-%05d", Year.now().getValue(), ThreadLocalRandom.current().nextInt(100_000));
            LOG.info("[C10] Expediente abierto: {}", numeroExpediente);
            ex.setVariable("numeroExpediente", numeroExpediente);
        };
    }

    @Bean
    public JavaDelegate c10RegistrarSinCobertura() {
        return ex -> {
            LOG.info("[C10] Aviso registrado como sin cobertura");
            ex.setVariable("estadoAviso", "CERRADO_SIN_COBERTURA");
        };
    }

    /** Ruta del temporizador de 24 h: la preverificación sigue abierta y se informa a la firma. */
    @Bean
    public JavaDelegate c10InformarEstado() {
        return ex -> {
            LOG.info("[C10] Han pasado 24 h sin preverificación: se informa a la firma que el aviso sigue en revisión");
            ex.setVariable("ultimoAvisoEstado", Instant.now().toString());
        };
    }

    /** Proceso invocado C10.1 Comunicar a la firma (Call Activity). */
    @Bean
    public JavaDelegate c10EnviarComunicacion() {
        return ex -> {
            String tipo = texto(ex, "tipoComunicacion", "SIN_TIPO");
            String detalle = "PREVERIFICACION".equals(tipo)
                    ? "resultado " + texto(ex, "resultadoPreverificacion", "-") + ", expediente " + texto(ex, "numeroExpediente", "-")
                    : "aviso cerrado sin cobertura";
            LOG.info("[C10.1] Comunicación {} enviada a la firma: {}", tipo, detalle);
            ex.setVariable("comunicacionEnviada", true);
        };
    }
}
