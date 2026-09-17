import { Worker } from "node:worker_threads";
export function analyzeAsync(finals, attempts) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./analysis-worker.js", import.meta.url),
      {
        workerData: {
          finals,
          attempts: attempts.map(({ generator_script, ...r }) => r),
        },
      },
    );
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error("Analysis exceeded interactive time limit; use CLI report"));
    }, 30000);
    worker.once("message", (value) => {
      clearTimeout(timer);
      resolve(value);
    });
    worker.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(Error("Analysis worker failed"));
    });
  });
}
