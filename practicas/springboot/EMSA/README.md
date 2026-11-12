# EMSA · Gestión de fallas técnicas

Laboratorio de Camunda Platform 7.20.0 con Spring Boot 3.1.1 y Java 17.

## Ejecutar

Desde esta carpeta, con un JDK 17 seleccionado en `JAVA_HOME`, ejecute en PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

El wrapper descarga Maven y las dependencias la primera vez. Abra [Tasklist](http://127.0.0.1:8080/camunda/app/tasklist/default/) con usuario `admin` y contraseña `admin`. La base H2 guarda las instancias en `data/`. En [Cockpit](http://127.0.0.1:8080/camunda/app/cockpit/default/) se pueden consultar el despliegue y las instancias activas.

## Recorrer el caso

1. En **Start process**, elija **Gestión de fallas técnicas EMSA** y registre el nombre, la dirección y la falla.
2. En **Todas las tareas**, abra **Agendar visita técnica**, revise los datos y complete la tarea. Use **Claim** para asignarse cada tarea antes de completarla. Si la lista sigue mostrando la tarea anterior, actualice la página.
3. Abra **Validar visita**. Si la visita se realizó, marque la casilla y complete el reporte con el tipo de solución, el cobro extra y la descripción. Si la visita no se realizó, se omite el informe.
4. En **Generar factura de pago**, revise el valor base, el extra y el total. En paralelo, **Guardar factura de pago** escribe el resumen en la consola de la aplicación.
5. En **Recibir pago**, ingrese el importe total pagado. Si difiere de la factura, se solicita una corrección. Al coincidir los importes, la instancia llega al evento **Reporte manejado exitosamente**.

## Reglas de la práctica

| Tipo de solución | Valor base |
|---|---:|
| Manual | 100.000 |
| Especializada | 250.000 |
| Sin intervención | 20.000 |
| Sin solución | 20.000 |

El total es el valor base más el cobro extra. El selector ofrece las cuatro opciones que tienen tarifa en la tabla DMN. La guía también muestra «Intermedia» en una captura, sin asignarle un valor.

Para la ruta de visita no realizada, la guía deja sin definir las entradas de la tabla. En este proyecto se aplica «Sin intervención» con extra cero. En el pago se compara `valorPagado` con `valorTotal`; cada reintento permite corregir el importe completo.

Los dos diagramas BPMN, la decisión DMN y los cuatro formularios Camunda están en `src/main/resources/static/`. Los formularios generados de validación de visita y recepción de pago se definen en los propios BPMN.

## Repetir las pruebas

```powershell
.\mvnw.cmd verify
```

Las cinco pruebas ejecutan el motor con una base H2 en memoria. Cubren las cuatro tarifas y la visita no realizada. Verifican el total, la ejecución del delegado, el reintento de pago y el cierre sin tareas pendientes. Maven genera el ejecutable `target/emsa-1.0.0.jar`.

El caso comprobado en el navegador usó una solución manual de 100.000 y un extra de 15.000. Tasklist mostró una factura de 115.000. Un primer importe de 100.000 abrió de nuevo la tarea de pago. Al ingresar 115.000, el historial registró el estado `COMPLETED`.
