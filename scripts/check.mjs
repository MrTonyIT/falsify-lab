import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
let count = 0;
for (const dir of ["src", "server", "fixtures", "test", "scripts"])
  for (const name of await readdir(dir))
    if (/\.(mjs|js)$/.test(name)) {
      execFileSync(process.execPath, ["--check", join(dir, name)], {
        stdio: "inherit",
        windowsHide: true,
      });
      count++;
    }
console.log(
  `Syntax checked ${count} JavaScript modules; frontend types are checked by npm run build.`,
);
