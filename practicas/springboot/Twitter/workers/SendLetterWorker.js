import { randomUUID } from "node:crypto";
import { Client, Variables } from "camunda-external-task-client-js";

const client = new Client({
  baseUrl: process.env.CAMUNDA_REST_URL || "http://127.0.0.1:8081/engine-rest",
  workerId: `twitter-${randomUUID()}`,
  asyncResponseTimeout: 10000
});

client.on("poll:error", error => console.error("Error al consultar Camunda:", error.message));
client.on("handler:error", error => console.error("Error al gestionar SendLetter:", error.message));

client.subscribe("SendLetter", async ({ task, taskService }) => {
  const { approved, email, content, comments } = task.variables.getAll();
  const status = approved ? "Tweet approved" : "Tweet rejected";
  const result = new Variables();
  result.set("status", status);
  await taskService.complete(task, result);
  console.log(`SendLetter | ${task.processInstanceId} | ${status} | ${email} | ${content} | ${comments ?? ""}`);
});
