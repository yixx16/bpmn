package com.arca.web;

import org.camunda.bpm.engine.MismatchingMessageCorrelationException;
import org.camunda.bpm.engine.ProcessEngineException;
import org.camunda.bpm.engine.exception.NotFoundException;
import org.camunda.bpm.engine.exception.NullValueException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Convierte los errores del motor y de validación en respuestas JSON con un mensaje legible para las vistas. */
@RestControllerAdvice(basePackages = "com.arca")
public class ErroresControlados {
    private static final Logger LOG = LoggerFactory.getLogger(ErroresControlados.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> datosInvalidos(IllegalArgumentException e) {
        return respuesta(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler({IllegalStateException.class, MismatchingMessageCorrelationException.class})
    public ResponseEntity<Map<String, String>> conflicto(RuntimeException e) {
        return respuesta(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler({NotFoundException.class, NullValueException.class})
    public ResponseEntity<Map<String, String>> noEncontrado(ProcessEngineException e) {
        return respuesta(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(ProcessEngineException.class)
    public ResponseEntity<Map<String, String>> motor(ProcessEngineException e) {
        LOG.warn("Error del motor: {}", e.getMessage());
        return respuesta(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
    }

    private static ResponseEntity<Map<String, String>> respuesta(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado).body(Map.of("error", mensaje == null ? estado.getReasonPhrase() : mensaje));
    }
}
