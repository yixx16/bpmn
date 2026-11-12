import { Client, Variables, logger } from "camunda-external-task-client-js";

// configuration for the Client:
//  - 'baseUrl': url to the Process Engine
//  - 'logger': utility to automatically log important events
const config = { baseUrl: "http://localhost:8080/engine-rest", use: logger };

// create a client instance with custom configuration
const client = new Client(config);

// susbscribe to the topic configured in the Service Task
client.subscribe("SendLetter", async function ({ task, taskService }) {
  // read a variable that was set earlier in the process
  const bookTitle = task.variables.get("book");
  console.log("** Reminder to Read: " + bookTitle + "**");

  // create the variable that will be sent back to the process instance
  const responseFromAustria = "Sorry Laff can't help, BTW, Prussia wants a quick word with you…";
  const processVariables = new Variables();
  processVariables.set("austriaResponse", responseFromAustria);

  // complete the external task; the process continues to the next activity
  await taskService.complete(task, processVariables);
});
