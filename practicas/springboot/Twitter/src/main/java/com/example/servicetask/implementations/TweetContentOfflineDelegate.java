package com.example.servicetask.implementations;

import org.camunda.bpm.engine.delegate.DelegateExecution;
import org.camunda.bpm.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service("tweetAdapter")
public class TweetContentOfflineDelegate implements JavaDelegate {
    private static final Logger LOG = LoggerFactory.getLogger(TweetContentOfflineDelegate.class);

    @Override
    public void execute(DelegateExecution execution) {
        LOG.info("Publicación simulada | Instancia: {} | Contenido: {}",
                execution.getProcessInstanceId(), execution.getVariable("content"));
    }
}
