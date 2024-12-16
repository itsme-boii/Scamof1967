//
import express from "express";
import { spawn } from "child_process";
import cors from "cors";

const app = express();
const PORT = 3002;

app.use(cors());

//Used Temporary storage for timebeing
let logs = [];

// API to get all the logs from the container using containerId
app.get("/stream-logs/:containerId", (req, res) => {
  const { containerId } = req.params;
  console.log(`Streaming logs for container ${containerId}`);
  const dockerLogs = spawn("docker", [
    "logs",
    "-f",
    "--timestamps",
    containerId,
  ]);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  dockerLogs.stdout.on("data", (data) => {
    const logData = data.toString();
    console.log(`Log data: ${logData}`);
    res.write(`data: ${logData}\n\n`);

    const timestamp = logData.split(" ")[0];
    console.log(`Timestamp: ${timestamp}`);
    const logLevel = logData.split(" ")[1];
    console.log(`Log level: ${logLevel}`);
    const message = logData.split(" ").slice(2).join(" ");
    console.log(`Message: ${message}`);

    logs.push({
      containerId,
      timestamp,
      logLevel,
      message,
    });
    // prevents excessive memory usage
    if (logs.length > 10000) {
      logs.shift();
    }
  });

  // API to filter logs based on time and logLevel
  app.get("/logs", (req, res) => {
    const { containerId, time, logLevel } = req.query;

    let filteredLogs = logs;

    if (time) {
      filteredLogs = filteredLogs.filter(
        (log) => log.Timestamp === time
      );
    }
   
    if (logLevel) {
      filteredLogs = filteredLogs.filter(
        (log) => log.logLevel === logLevel.toUpperCase()
      );
    }

    res.json(filteredLogs);
  });

  dockerLogs.stderr.on("data", (data) => {
    const errorData = data.toString();
    console.error(`Error: ${errorData}`);
    res.write(`data: ERROR: ${errorData}\n\n`);
  });

  dockerLogs.on("close", () => {
    res.end();
  });

  req.on("close", () => {
    dockerLogs.kill();
  });
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
