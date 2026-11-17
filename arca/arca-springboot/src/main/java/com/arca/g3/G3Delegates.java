package com.arca.g3;

import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;

import static com.arca.Variables.texto;

/**
 * G3 Publicar una versión del modelo de score y su proceso invocado S2 Desplegar cambios en plataforma.
 * Responsable: Johan Sebastian Forero Agudelo.
 * Misma lógica simulada que worker/worker.js. La respuesta del carrier ya no se simula con un temporizador:
 * la da el rol Carrier desde el panel interno.
 */
@Configuration
public class G3Delegates {
    private static final Logger LOG = LoggerFactory.getLogger(G3Delegates.class);

    /** Backtesting y prueba de sesgo simulados. Variable opcional simularValidacion = ok | falla. */
    @Bean
    public JavaDelegate g3ValidarVersion() {
        return ex -> {
            boolean falla = "falla".equals(texto(ex, "simularValidacion", "ok"));
            double auc = falla ? 0.64 : 0.78;
            double desviacion = falla ? 0.18 : 0.04;
            double impacto = falla ? 0.72 : 0.91;
            LOG.info("[G3] Validación ({}): AUC {}, desviación del loss ratio {}, impacto dispar {}",
                    falla ? "falla" : "ok", auc, desviacion, impacto);
            ex.setVariable("auc", auc);
            ex.setVariable("desviacionLossRatio", desviacion);
            ex.setVariable("impactoDisparejo", impacto);
            // Si la validación falla, la siguiente vuelta simula una corrección exitosa
            ex.setVariable("simularValidacion", "ok");
        };
    }

    @Bean
    public JavaDelegate g3SometerCarrier() {
        return ex -> LOG.info("[G3] Versión {} enviada al carrier; queda esperando su respuesta (plazo de 15 días)",
                texto(ex, "versionCandidata", "sin-identificador"));
    }

    @Bean
    public JavaDelegate g3RegistrarVigencia() {
        return ex -> {
            String version = texto(ex, "versionCandidata", "sin-identificador");
            LOG.info("[G3] Versión {} registrada como vigente", version);
            ex.setVariable("versionVigente", version);
            ex.setVariable("fechaVigencia", Instant.now().toString());
        };
    }

    /** Evento final de mensaje VersionModeloPublicada, que avisa a C1, C3 y C7. */
    @Bean
    public JavaDelegate g3PublicarVersion() {
        return ex -> LOG.info("[G3] Mensaje VersionModeloPublicada emitido hacia C1, C3 y C7");
    }

    // ---------- S2 Desplegar cambios en plataforma
    @Bean
    public JavaDelegate s2DesplegarCambio() {
        return ex -> LOG.info("[S2] Desplegando cambios en la plataforma");
    }

    /** Pruebas de humo. Variable opcional simularDespliegue = ok | falla. */
    @Bean
    public JavaDelegate s2PruebasHumo() {
        return ex -> {
            boolean saludable = !"falla".equals(texto(ex, "simularDespliegue", "ok"));
            LOG.info("[S2] Pruebas de humo: {}", saludable ? "OK" : "FALLARON");
            ex.setVariable("despliegueSaludable", saludable);
        };
    }

    @Bean
    public JavaDelegate s2RevertirDespliegue() {
        return ex -> {
            LOG.info("[S2] Revirtiendo al estado anterior");
            ex.setVariable("despliegueSaludable", false);
        };
    }
}
