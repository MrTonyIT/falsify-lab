import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
});
const page = await browser.newPage({
    locale: "en-US",
    viewport: { width: 1400, height: 1000 },
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.LAB_URL ?? "http://127.0.0.1:4173", {
    waitUntil: "networkidle",
  });
  await page.getByTestId("falsify").click();
  await page.getByRole("heading", { name: "Counterexample found." }).waitFor();
  await page
    .getByTestId("falsify")
    .filter({ hasText: "NEW EXPERIMENT" })
    .waitFor();
  const inputDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full input", exact: true })
    .click();
  const input = await readFile(await (await inputDownload).path());
  assert.equal(input.toString(), "1\n1\n-1\n");
  const evidenceDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export evidence", exact: true })
    .click();
  const evidence = JSON.parse(
    await readFile(await (await evidenceDownload).path(), "utf8"),
  );
  assert.equal(evidence.execution_kind, "mock");
  assert.equal(evidence.source_included, false);
  assert.deepEqual(Buffer.from(evidence.input_b64, "base64"), input);
  await page
    .getByText("Check a revision on this input", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load bundled corrected example" })
    .click();
  await page
    .getByRole("button", { name: "Run saved input without AI" })
    .click();
  await page.getByTestId("replay-result").waitFor();
  assert(
    (await page.getByTestId("replay-result").innerText()).includes(
      "Matches expected output on this input only.",
    ),
  );
  await page.getByLabel("Interface language").selectOption("vi");
  await page
    .getByRole("button", { name: "Tải input đầy đủ", exact: true })
    .waitFor();
  assert(
    (await page.locator(".replay-panel").innerText()).includes(
      "Không gọi model.",
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400); // Let the existing responsive sidebar transition settle before visual QA.
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  );
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/learner-replay-vi-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Ngôn ngữ giao diện").selectOption("en");
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.getByTestId("falsify").click();
  await page
    .getByRole("button", { name: "Live playground", exact: true })
    .click();
  await page.getByLabel("Supported reviewed problem").waitFor();
  await page
    .getByText("Draft catalog — pending human review", { exact: true })
    .click();
  assert(
    (await page.locator("main").innerText()).includes(
      "Not live-enabled or independently verified.",
    ),
  );
  assert.equal(
    await page
      .getByLabel("Supported reviewed problem")
      .locator("option")
      .count(),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Learner browser flow passed: full downloads, immutable demo replay, VI, mobile, pending catalog. No provider calls.",
  );
} finally {
  await browser.close();
}
