package com.arca.c3;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static com.arca.Variables.numero;
import static com.arca.Variables.siNo;
import static com.arca.Variables.texto;

/**
 * C3 Suscribir la solicitud y sus procesos invocados C1 Calcular el Pre-Score y C3.1 Notificar la decisión.
 * Responsable: Jesus Gregorio Delgado.
 * Misma lógica simulada que worker/index.js: los pesos y factores son de demo, como en la plataforma.
 */
@Configuration
public class C3Delegates {
    private static final Logger LOG = LoggerFactory.getLogger(C3Delegates.class);
    private static final List<String> HALLAZGOS = List.of("restriccionCapa1", "reclamoPagado", "incidenteIA", "sinEOVigente");
    private static final Map<String, Double> FACTOR_GOBERNANZA =
            Map.of("FORTRESS", 0.85, "FORTIFIED", 0.95, "GUARDED", 1.1, "EXPOSED", 1.3, "CRITICAL", 1.5);

    // ---------- C1 Calcular el Pre-Score (Capa 1). En la plataforma, OpenAI lee la web y Apify consulta el colegio y Avvo.
    @Bean
    public JavaDelegate c1EscanearWeb() {
        return ex -> {
            String dominio = texto(ex, "dominio", "firma-demo.com");
            LOG.info("[C1] Web de {} escaneada: firma identificada", dominio);
            ex.setVariable("firmaIdentificada", dominio.split("\\.")[0]);
        };
    }

    @Bean
    public JavaDelegate c1BuscarAbogados() {
        return ex -> {
            long abogados = Math.round(numero(ex, "abogados", 5));
            LOG.info("[C1] Apify: {} abogados encontrados en el colegio y en Avvo", abogados);
            ex.setVariable("abogados", abogados);
        };
    }

    @Bean
    public JavaDelegate c1CalcularPrescore() {
        return ex -> {
            double preScore = numero(ex, "puntajeCapa1", 60);
            boolean restriccion = siNo(ex, "restriccionCapa1");
            LOG.info("[C1] Pre-Score {}{}", preScore, restriccion ? " con restricción (antecedente disciplinario)" : "");
            ex.setVariable("puntajeCapa1", preScore);
            ex.setVariable("restriccionCapa1", restriccion);
            ex.setVariable("senalesCapa1", "AI Governance, Professional Standing, Reputation, Firm Maturity");
        };
    }

    // ---------- C3
    /** Cuestionario de Capa 2: entre 8 y 12 preguntas según lo que encontró la Capa 1. */
    @Bean
    public JavaDelegate c3PresentarCuestionario() {
        return ex -> {
            long preguntas = Math.min(12, 8 + contarHallazgos(ex));
            LOG.info("[C3] Cuestionario de {} preguntas presentado a {}", preguntas, texto(ex, "dominio", "la firma"));
            ex.setVariable("numeroPreguntas", preguntas);
        };
    }

    /** Puntaje compuesto: 30 % Capa 1 y 70 % Capa 2 (pesos de demo). */
    @Bean
    public JavaDelegate c3CalcularScore() {
        return ex -> {
            double capa1 = numero(ex, "puntajeCapa1", 60);
            double capa2 = numero(ex, "puntajeCapa2", 60);
            long puntaje = Math.round(0.3 * capa1 + 0.7 * capa2);
            boolean revisionForzada = contarHallazgos(ex) > 0;
            LOG.info("[C3] Puntaje {} (Capa 1 {}, Capa 2 {}); revisión forzada: {}", puntaje, capa1, capa2, revisionForzada);
            ex.setVariable("puntaje", puntaje);
            ex.setVariable("revisionForzada", revisionForzada);
        };
    }

    @Bean
    public JavaDelegate c3MostrarResultados() {
        return ex -> LOG.info("[C3] Resultados y plan de acción mostrados: puntaje {}", ex.getVariable("puntaje"));
    }

    /** Prima anual = 420 × abogados × factor de gobernanza × área × jurisdicción × tamaño (fórmula de diseño). */
    @Bean
    public JavaDelegate c3CalcularCotizacion() {
        return ex -> {
            double abogados = numero(ex, "abogados", 5);
            double factor = FACTOR_GOBERNANZA.getOrDefault(texto(ex, "tier", ""), 1.0);
            double otros = numero(ex, "factorArea", 1) * numero(ex, "factorJurisdiccion", 1) * numero(ex, "factorTamano", 1);
            long prima = Math.round(420 * abogados * factor * otros);
            String limite = texto(ex, "limiteSolicitado", "Professional");
            LOG.info("[C3] Cotización: prima anual USD {}, límite {}", prima, limite);
            ex.setVariable("primaAnual", prima);
            ex.setVariable("limiteOfrecido", limite);
        };
    }

    @Bean
    public JavaDelegate c3GenerarPlanMejora() {
        return ex -> {
            String fecha = LocalDate.now().plusDays(90).toString();
            LOG.info("[C3] Plan de mejora generado; nueva evaluación el {}", fecha);
            ex.setVariable("fechaReevaluacion", fecha);
        };
    }

    @Bean
    public JavaDelegate c3RegistrarDecision() {
        return ex -> {
            LOG.info("[C3] Decisión {} registrada en el expediente", ex.getVariable("decision"));
            ex.setVariable("fechaDecision", Instant.now().toString());
        };
    }

    /** Proceso invocado C3.1 Notificar la decisión al canal (Call Activity). */
    @Bean
    public JavaDelegate c3EnviarNotificacion() {
        return ex -> {
            Object prima = ex.getVariable("primaAnual");
            LOG.info("[C3.1] Decisión {} (tier {}){} notificada al canal", ex.getVariable("decision"), ex.getVariable("tier"),
                    prima != null ? ", prima USD " + prima : "");
            ex.setVariable("notificacionEnviada", true);
        };
    }

    private static long contarHallazgos(DelegateExecution ex) {
        return HALLAZGOS.stream().filter(k -> siNo(ex, k)).count();
    }
}
