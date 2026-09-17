import { parentPort, workerData } from "node:worker_threads";
import { analyze } from "../src/metrics.js";
parentPort.postMessage(
  analyze(workerData.finals, workerData.attempts, { repetitions: 500 }),
);
