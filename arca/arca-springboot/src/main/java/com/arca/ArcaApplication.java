package com.arca;

import org.camunda.bpm.spring.boot.starter.annotation.EnableProcessApplication;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Motor Camunda 7 embebido de ARCA. Al arrancar despliega los procesos de
 * src/main/resources/procesos (C10, C3 y G3 con sus procesos invocados, DMN y formularios)
 * y sirve el portal de la firma y el panel interno.
 */
@SpringBootApplication
@EnableProcessApplication("ARCA")
public class ArcaApplication {
    public static void main(String[] args) {
        SpringApplication.run(ArcaApplication.class, args);
    }
}
