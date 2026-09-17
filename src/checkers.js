import { assert, LIMITS } from "./domain.js";
import { digest } from "./protocol.js";
export const CHECKER_PROFILES = Object.freeze({
  tokens: Object.freeze({
    id: "tokens",
    version: 2,
    semantics: "UTF-8 case-sensitive tokens; ASCII whitespace ignored",
  }),
  "tokens-yes-no": Object.freeze({
    id: "tokens-yes-no",
    version: 2,
    semantics: "tokens; only YES/NO are case-insensitive",
  }),
  lines: Object.freeze({
    id: "lines",
    version: 2,
    semantics: "UTF-8 lines; CRLF and trailing ASCII whitespace normalized",
  }),
});
function text(value) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  assert(data.length <= LIMITS.outputBytes, "Checker output limit");
  const result = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(data);
  assert(
    !/[\0\u0001-\u0008\u000E-\u001F\u007F]/.test(result),
    "Malformed output control character",
  );
  return result;
}
export function normalizedLines(value) {
  return text(value)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}
const safe = (fn) => (expected, got) => {
  try {
    return fn(expected, got);
  } catch {
    return false;
  }
};
export const lineChecker = safe(
  (expected, got) => normalizedLines(expected) === normalizedLines(got),
);
const tokens = (value) =>
  text(value)
    .split(/[ \t\r\n\v\f]+/)
    .filter(Boolean);
export const tokenChecker = safe((expected, got) => {
  const a = tokens(expected),
    b = tokens(got);
  return a.length === b.length && a.every((v, i) => v === b[i]);
});
export const yesNoChecker = safe((expected, got) => {
  const normalize = (v) =>
    tokens(v).map((t) => (/^(yes|no)$/i.test(t) ? t.toLowerCase() : t));
  const a = normalize(expected),
    b = normalize(got);
  return a.length === b.length && a.every((v, i) => v === b[i]);
});
export function checkerProfile(name) {
  assert(
    Object.hasOwn(CHECKER_PROFILES, name),
    "Unsupported checker: floats, special judges, interactive and multiple-valid-output tasks are not supported",
  );
  return CHECKER_PROFILES[name];
}
export function checkerFor(name) {
  checkerProfile(name);
  return {
    tokens: tokenChecker,
    "tokens-yes-no": yesNoChecker,
    lines: lineChecker,
  }[name];
}
export function checkerIdentity(name) {
  return digest(checkerProfile(name));
}
