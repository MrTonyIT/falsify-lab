import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  locale: "en-US",
  reducedMotion: "reduce",
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.LAB_URL ?? "http://127.0.0.1:4173";
try {
  await page.goto(base + "/#Playground", { waitUntil: "networkidle" });
  await page.locator(".monaco-editor").waitFor();
  const select = page.locator(".locale-picker select");
  assert.equal(await select.locator("option").count(), 12);
  assert.equal(
    await page
      .getByRole("combobox", { name: "Code language", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Live playground", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Code language", exact: true })
    .selectOption("cpp");
  assert.equal(await page.locator(".file-tag").innerText(), "main.cpp");
  const statement = page.getByRole("textbox", { name: "Problem statement" });
  const before = await statement.inputValue();
  const editor = await page.locator(".monaco-editor .view-lines").innerText();
  for (const locale of [
    "vi",
    "es",
    "fr",
    "de",
    "pt",
    "ja",
    "ko",
    "zh",
    "ar",
    "hi",
    "ru",
    "en",
  ]) {
    await select.selectOption(locale);
    assert.equal(await page.locator("html").getAttribute("lang"), locale);
    assert.equal(
      await page.locator("html").getAttribute("dir"),
      locale === "ar" ? "rtl" : "ltr",
    );
    assert.equal(
      await page.locator(".problem-panel textarea").inputValue(),
      before,
    );
    assert.equal(
      await page.locator(".monaco-editor .view-lines").innerText(),
      editor,
    );
    assert.equal(
      await page.locator(".language-config select").inputValue(),
      "cpp",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      locale + " desktop overflow",
    );
  }
  await select.selectOption("vi");
  await page.getByRole("heading", { name: /Tìm đầu vào/ }).waitFor();
  await page.screenshot({
    path: "artifacts/playground-vi.png",
    fullPage: true,
  });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await select.inputValue(), "vi");
  await page.locator(".monaco-editor").waitFor();
  await page.getByTestId("falsify").click();
  await page.locator(".pipeline-step.running").first().waitFor();
  await select.selectOption("ja");
  await page
    .getByRole("heading", { name: "反例が見つかりました。" })
    .waitFor({ timeout: 30000 });
  assert.equal(
    await page.locator(".output-panel.expected pre").innerText(),
    "-1\n",
  );
  assert.equal(
    await page.locator(".output-panel.different pre").innerText(),
    "1\n",
  );
  await select.selectOption("en");
  await page
    .getByRole("button", { name: "NEW EXPERIMENT", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Live playground", exact: true })
    .click();
  await page.locator(".language-config select").selectOption("cpp");
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/falsify") && r.method() === "POST",
  );
  await page.getByTestId("falsify").click();
  assert.equal((await request).postDataJSON().language, "cpp");
  await page
    .getByText("Live generation needs a configured model provider.", {
      exact: false,
    })
    .waitFor();
  for (const locale of ["vi", "ar", "de", "ja"]) {
    await select.selectOption(locale);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      locale + " mobile overflow",
    );
    await page.screenshot({
      path: `artifacts/mobile-${locale}.png`,
      fullPage: true,
    });
  }
  await select.selectOption("ar");
  await page.locator(".mobile-menu").click();
  const sidebar = await page.locator(".sidebar").boundingBox();
  assert(
    sidebar.x >= 0 && sidebar.x + sidebar.width <= 391,
    "RTL navigation remains onscreen",
  );
  await page
    .locator(".sidebar nav button")
    .filter({ hasText: "النظام" })
    .click();
  await page.locator(".runtime-grid").waitFor();
  assert.equal(await page.locator(".runtime-grid > div").count(), 11);
  await page.screenshot({
    path: "artifacts/system-ar-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/languages-smoke.json",
    JSON.stringify(
      {
        ok: true,
        locales: 12,
        programmingLanguages: 11,
        tests: [
          "locale persistence",
          "input/code preservation",
          "switch locale during SSE job",
          "C++ API payload",
          "RTL navigation",
          "mobile layout",
          "honest runtime status",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Languages E2E passed: 12 locales, persistence, code preservation, live SSE switching, 11 source languages, API payload and RTL mobile.",
  );
} finally {
  await browser.close();
}
