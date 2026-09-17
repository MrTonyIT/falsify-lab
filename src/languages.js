// Public IDs are shared by the UI, API and sandbox. Never accept command strings.
export const languages = Object.freeze([
  { id: "python", name: "Python 3", editor: "python", file: "main.py" },
  { id: "cpp", name: "C++17", editor: "cpp", file: "main.cpp" },
  { id: "c", name: "C17", editor: "c", file: "main.c" },
  {
    id: "javascript",
    name: "JavaScript",
    editor: "javascript",
    file: "main.js",
  },
  {
    id: "typescript",
    name: "TypeScript",
    editor: "typescript",
    file: "main.ts",
  },
  { id: "java", name: "Java", editor: "java", file: "Main.java" },
  { id: "go", name: "Go", editor: "go", file: "main.go" },
  { id: "rust", name: "Rust", editor: "rust", file: "main.rs" },
  { id: "csharp", name: "C# (Mono)", editor: "csharp", file: "Main.cs" },
  { id: "ruby", name: "Ruby", editor: "ruby", file: "main.rb" },
  { id: "php", name: "PHP", editor: "php", file: "main.php" },
]);
export function languageFor(id = "python") {
  // Historical Codeforces corpus labels remain Python under the original protocol.
  if (/^(python|pypy)(\s|$)/i.test(id)) id = "python";
  const language = languages.find((l) => l.id === id);
  if (!language) throw new Error("Unsupported programming language");
  return language;
}
