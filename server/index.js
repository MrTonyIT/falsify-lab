import { createServer } from "node:http";
import { readFile, stat, realpath } from "node:fs/promises";
import { resolve, join, extname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LabService, ApiError, examples } from "./service.js";
const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ttf": "font/ttf",
};
async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024)
      throw new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The request exceeds 1 MiB.",
      );
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request is not valid JSON.");
  }
}
export async function createLabServer(options = {}) {
  const service =
    options.service ??
    new LabService({
      root: join(project, "results"),
      configPath: process.env.FALSIFIER_CONFIG,
      corpusPath: process.env.FALSIFIER_CORPUS,
    });
  await service.init();
  const server = createServer(async (req, res) => {
    const json = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const host = req.headers.host ?? "";
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
        throw new ApiError(
          403,
          "INVALID_HOST",
          "This application is available on localhost only.",
        );
      const url = new URL(req.url, "http://" + host);
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        (req.headers.origin && req.headers.origin !== "http://" + host)
      )
        throw new ApiError(
          403,
          "CROSS_ORIGIN",
          "Cross-origin requests are not allowed.",
        );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Frame-Options", "DENY");
      if (url.pathname.startsWith("/api/")) {
        if (req.method === "GET" && url.pathname === "/api/health")
          return json({ status: "online", name: "Falsify Lab" });
        if (req.method === "GET" && url.pathname === "/api/system/status")
          return json(await service.status());
        if (req.method === "GET" && url.pathname === "/api/examples")
          return json(examples);
        if (req.method === "GET" && url.pathname === "/api/problems")
          return json(service.problemList());
        if (req.method === "POST" && url.pathname === "/api/falsify") {
          if (!req.headers["content-type"]?.startsWith("application/json"))
            throw new ApiError(
              415,
              "JSON_REQUIRED",
              "Use an application/json request.",
            );
          return json(await service.start(await body(req)), 202);
        }
        if (req.method === "GET" && url.pathname === "/api/runs")
          return json(service.list());
        if (
          req.method === "GET" &&
          ["/api/metrics", "/api/benchmarks", "/api/test-suites"].includes(
            url.pathname,
          )
        )
          return json(await service.data());
        const run = url.pathname.match(
          /^\/api\/runs\/(lab-[a-f0-9-]+)(\/events)?$/,
        );
        if (req.method === "GET" && run) {
          const job = service.get(run[1]);
          if (!run[2]) return json(job);
          const after = Number(
            req.headers["last-event-id"] ?? url.searchParams.get("after") ?? 0,
          );
          if (!Number.isSafeInteger(after) || after < 0)
            throw new ApiError(
              400,
              "INVALID_CURSOR",
              "Event cursor must be a nonnegative integer.",
            );
          if ((service.listeners.get(job.id)?.size ?? 0) >= 8)
            throw new ApiError(
              429,
              "TOO_MANY_STREAMS",
              "Too many event streams.",
            );
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          res.flushHeaders();
          let cursor = Number(
            req.headers["last-event-id"] ?? url.searchParams.get("after") ?? 0,
          );
          let blocked = false;
          const send = (e) => {
            if (!blocked && !res.destroyed && e.id > cursor) {
              cursor = e.id;
              blocked = !res.write(
                `id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`,
              );
              if (blocked)
                res.once("drain", () => {
                  blocked = false;
                  job.events.forEach(send);
                });
            }
          };
          const unsubscribe = service.subscribe(job.id, send);
          job.events.forEach(send);
          const heartbeat = setInterval(() => {
            if (!blocked) res.write(": keep-alive\n\n");
          }, 15000);
          res.on("close", () => {
            clearInterval(heartbeat);
            unsubscribe();
          });
          return;
        }
        throw new ApiError(
          404,
          "NOT_FOUND",
          "This API endpoint does not exist.",
        );
      }
      if (req.method !== "GET")
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      const base = join(project, "web", "dist");
      let path = resolve(base, "." + decodeURIComponent(url.pathname));
      if (relative(base, path).startsWith(".."))
        throw new ApiError(403, "FORBIDDEN", "Invalid path.");
      try {
        if (!(await stat(path)).isFile()) path = join(base, "index.html");
      } catch {
        path = join(base, "index.html");
      }
      const actualBase = await realpath(base),
        actualPath = await realpath(path);
      if (relative(actualBase, actualPath).startsWith(".."))
        throw new ApiError(403, "FORBIDDEN", "Invalid asset path.");
      const content = await readFile(actualPath);
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] ?? "application/octet-stream",
        "Cache-Control":
          extname(path) === ".html" ? "no-cache" : "public,max-age=3600",
      });
      res.end(content);
    } catch (error) {
      if (!res.headersSent)
        json(
          {
            error: {
              code: error.code ?? "INTERNAL_ERROR",
              message:
                error instanceof ApiError
                  ? error.message
                  : "The server could not complete this request. Check local configuration and storage.",
            },
          },
          error.status ?? 500,
        );
      else res.end();
    }
  });
  return { server, service };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { server } = await createLabServer();
  const port = Number(process.env.PORT ?? 4173);
  server.listen(port, "127.0.0.1", () =>
    console.log(`FALSIFY LAB ready at http://localhost:${port}`),
  );
}
