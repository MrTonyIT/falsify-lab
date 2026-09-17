import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
  headless: true,
  args: ["--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 1512, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.LAB_URL ?? "http://127.0.0.1:4173";
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: /Find the input your code/ })
    .waitFor();
  await page.locator(".monaco-editor").waitFor();
  await page.screenshot({ path: "artifacts/playground.png", fullPage: true });
  let submitted;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/falsify") && req.method() === "POST")
      submitted = req.postDataJSON();
  });
  await page.getByTestId("falsify").click();
  await page.locator(".pipeline-step.running").first().waitFor();
  await page.screenshot({ path: "artifacts/running.png", fullPage: true });
  await page
    .getByRole("heading", { name: "Counterexample found." })
    .waitFor({ timeout: 30000 });
  await page
    .getByTestId("falsify")
    .filter({ hasText: "NEW EXPERIMENT" })
    .waitFor();
  assert.equal(submitted.mode, "demo");
  assert(submitted.statement && submitted.constraints && submitted.code);
  assert.equal(
    await page.locator(".output-panel.expected pre").innerText(),
    "-1\n",
  );
  assert.equal(
    await page.locator(".output-panel.different pre").innerText(),
    "1\n",
  );
  await page.screenshot({
    path: "artifacts/counterexample.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /^Runs/ }).first().click();
  await page
    .getByRole("button", { name: "The missing minus sign" })
    .first()
    .waitFor();
  await page.screenshot({ path: "artifacts/runs.png", fullPage: true });
  await page
    .getByRole("button", { name: "The missing minus sign" })
    .first()
    .click();
  await page.getByRole("heading", { name: "Counterexample found." }).waitFor();
  for (const section of [
    "Benchmarks",
    "Test Suites",
    "Analytics",
    "System",
    "Settings",
  ]) {
    await page
      .getByRole("button", { name: new RegExp("^" + section + "$") })
      .first()
      .click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: "artifacts/" + section.toLowerCase().replace(" ", "-") + ".png",
      fullPage: true,
    });
    if (section === "Benchmarks") {
      assert((await page.locator("main").innerText()).includes("NOT RUN"));
      const measured = await (await fetch(base + "/api/metrics")).json();
      const demo = measured.runs.find((r) => r.kind === "demo");
      if (demo) {
        await page.getByLabel("Results dataset").selectOption(demo.id);
        await page.waitForTimeout(800);
        const summary = Object.values(demo.analysis.groups)[0];
        assert.equal(
          await page
            .locator(".metric-card")
            .first()
            .locator("strong")
            .innerText(),
          summary.kill_at_1.toFixed(1) + "%",
        );
        await page.screenshot({
          path: "artifacts/benchmarks-demo.png",
          fullPage: true,
        });
        await page.getByLabel("Results dataset").selectOption("official");
      }
    }
  }
  await page
    .getByRole("button", { name: /Playground/ })
    .first()
    .click();
  await page.getByTestId("falsify").click(); // clear previous job
  await page.getByLabel("Load example").selectOption("sum-survivor");
  await page.getByTestId("falsify").click();
  await page
    .getByRole("heading", {
      name: "No counterexample found within the configured attempt budget.",
    })
    .waitFor({ timeout: 30000 });
  assert(
    (await page.getByTestId("result").innerText()).includes(
      "does not establish that your code is correct",
    ),
  );
  await page
    .getByTestId("falsify")
    .filter({ hasText: "NEW EXPERIMENT" })
    .waitFor();
  await page.getByTestId("falsify").click();
  await page
    .getByRole("button", { name: "Live playground", exact: true })
    .click();
  await page.getByTestId("falsify").click();
  await page.locator('.error-card[role="alert"]').waitFor();
  assert(
    (await page.locator('.error-card[role="alert"]').innerText()).includes(
      "configured model provider",
    ),
  );
  await page.screenshot({
    path: "artifacts/live-configuration-error.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "No horizontal page overflow on mobile",
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: /^Runs/ }).first().click();
  await page
    .getByRole("heading", { name: "Every attempt tells a story." })
    .waitFor();
  assert.deepEqual(errors, [], "No browser runtime errors");
  await writeFile(
    "artifacts/web-smoke.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "editor",
          "payload",
          "SSE pipeline",
          "counterexample",
          "history",
          "run detail",
          "benchmarks",
          "suites",
          "analytics",
          "system",
          "survivor wording",
          "API error",
          "mobile navigation",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Web E2E passed: live API, streamed core events, demo kill/survive, history, all pages, errors and mobile.",
  );
} finally {
  await browser.close();
}
