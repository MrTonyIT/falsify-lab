import { t } from "./i18n";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import "monaco-editor/languages/definitions/go/register.js";
import "monaco-editor/languages/definitions/rust/register.js";
import "monaco-editor/languages/definitions/csharp/register.js";
import "monaco-editor/languages/definitions/ruby/register.js";
import "monaco-editor/languages/definitions/php/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
(self as any).MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
monaco.editor.defineTheme("falsify", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "BB9AF7" },
    { token: "string", foreground: "9AC8A5" },
    { token: "number", foreground: "E9BB86" },
    { token: "comment", foreground: "626779", fontStyle: "italic" },
  ],
  colors: {
    "editor.background": "#111217",
    "editor.foreground": "#CCD0DF",
    "editorLineNumber.foreground": "#454959",
    "editorLineNumber.activeForeground": "#BBB1E2",
    "editor.lineHighlightBackground": "#181922",
    "editor.selectionBackground": "#7660bc40",
    "editorCursor.foreground": "#AC95FF",
    "editorWidget.background": "#181922",
  },
});
export default function CodeEditor({
  language = "python",
  value,
  onChange,
  height = 280,
  readOnly = false,
}: {
  language?: string;
  value: string;
  onChange?: (v: string) => void;
  height?: number;
  readOnly?: boolean;
}) {
  return (
    <Editor
      height={height}
      language={language}
      theme="falsify"
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      loading={
        <div className="editor-loading">{t("Preparing code editor…")}</div>
      }
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 23,
        fontFamily: '"JetBrains Mono", monospace',
        padding: { top: 18, bottom: 18 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: "on",
        overviewRulerLanes: 0,
        renderLineHighlight: "line",
        folding: true,
        scrollbar: { verticalScrollbarSize: 5, horizontalScrollbarSize: 5 },
        ariaLabel: t("Source code editor"),
      }}
    />
  );
}
