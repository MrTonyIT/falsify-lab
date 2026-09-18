const routes = new Set([
  "Playground",
  "Runs",
  "Benchmarks",
  "Test Suites",
  "Analytics",
  "System",
  "Settings",
  "Run detail",
]);
export function parseRoute(hash) {
  try {
    const route = decodeURIComponent(String(hash).replace(/^#/, ""));
    return routes.has(route) ? route : "Playground";
  } catch {
    return "Playground";
  }
}
