import { useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import vi from "./locales/vi.json";
import translations from "./locales/international.js";

export const locales = [
  ["en", "English"],
  ["vi", "Tiếng Việt"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["zh", "中文"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["ru", "Русский"],
] as const;
const supported = (value: string) => locales.some(([id]) => id === value);
function initialLocale() {
  try {
    const saved = localStorage.getItem("falsify.locale");
    if (saved && supported(saved)) return saved;
  } catch {}
  return (
    navigator.languages?.map((l) => l.split("-")[0]).find(supported) ?? "en"
  );
}
let locale = initialLocale();
const listeners = new Set<() => void>();
const dictionaries: Record<string, Record<string, string>> = {
  vi,
  ...translations,
};
function updateDocument() {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}
updateDocument();
export function setLocale(next: string) {
  if (!supported(next)) return;
  locale = next;
  try {
    localStorage.setItem("falsify.locale", next);
  } catch {}
  updateDocument();
  listeners.forEach((fn) => fn());
}
export function useLocale() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => locale,
  );
}
export function t<T>(value: T): T {
  if (typeof value !== "string") return value;
  const key = value.replace(/\s+/g, " ").trim();
  const translated = dictionaries[locale]?.[key];
  return (translated ? value.replace(value.trim(), translated) : value) as T;
}
export function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
export function LanguageSelector() {
  useLocale();
  return (
    <label
      className="locale-picker"
      title={t("Missing translations use English.")}
    >
      <Languages size={16} />
      <select
        aria-label={t("Interface language")}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
      >
        {locales.map(([id, name]) => (
          <option key={id} value={id} lang={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
