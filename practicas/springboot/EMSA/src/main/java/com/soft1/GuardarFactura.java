package com.soft1;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class GuardarFactura implements JavaDelegate {
    private static final Logger LOG = LoggerFactory.getLogger(GuardarFactura.class);

    @Override
    public void execute(DelegateExecution execution) {
        LOG.info("Factura EMSA | Cliente: {} | Domicilio: {} | Falla: {} | Valor total: {}",
                execution.getVariable("nombre"), execution.getVariable("domicilio"),
                execution.getVariable("falla"), execution.getVariable("valorTotal"));
    }
}
