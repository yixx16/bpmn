package com.arca;

import org.camunda.bpm.engine.ProcessEngineException;
import org.camunda.bpm.engine.delegate.DelegateExecution;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/** Lectura de variables de proceso con valores por defecto y errores con mensaje claro. */
public final class Variables {
    private Variables() {
    }

    public static String texto(DelegateExecution ex, String nombre, String porDefecto) {
        Object v = ex.getVariable(nombre);
        return v == null || v.toString().isBlank() ? porDefecto : v.toString();
    }

    public static double numero(DelegateExecution ex, String nombre, double porDefecto) {
        Object v = ex.getVariable(nombre);
        if (v == null) {
            return porDefecto;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (NumberFormatException e) {
            throw new ProcessEngineException("La variable '" + nombre + "' debe ser numérica y vale '" + v + "'");
        }
    }

    public static boolean siNo(DelegateExecution ex, String nombre) {
        Object v = ex.getVariable(nombre);
        return v instanceof Boolean b ? b : v != null && Boolean.parseBoolean(v.toString());
    }

    public static LocalDate fecha(DelegateExecution ex, String nombre) {
        Object v = ex.getVariable(nombre);
        if (v == null || v.toString().isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(v.toString().substring(0, Math.min(10, v.toString().length())));
        } catch (DateTimeParseException e) {
            throw new ProcessEngineException("La variable '" + nombre + "' debe ser una fecha AAAA-MM-DD y vale '" + v + "'");
        }
    }
}
