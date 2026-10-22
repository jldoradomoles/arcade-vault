// Hook PostToolUse (Write|Edit): pasa Prettier y ESLint por el archivo creado o editado.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString() || "{}");

const file = input.tool_response?.filePath ?? input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (!file || !existsSync(file)) process.exit(0);

// Solo archivos dentro del proyecto, ignorando dependencias y artefactos.
const rel = path.relative(root, file);
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
if (/^(node_modules|\.next|\.git)([\\/]|$)/.test(rel)) process.exit(0);

const run = (bin, args) =>
  spawnSync(process.execPath, [path.join(root, "node_modules", bin), ...args], {
    cwd: root,
    encoding: "utf8",
  });

const messages = [];

// Prettier: cualquier tipo de archivo que soporte (ignora los desconocidos).
const prettier = run("prettier/bin/prettier.cjs", [
  "--write",
  "--ignore-unknown",
  file,
]);
if (prettier.status !== 0) {
  messages.push(
    `Prettier falló en ${rel}:\n${prettier.stderr || prettier.stdout}`,
  );
}

// ESLint: solo archivos JS/TS.
if (/\.(m|c)?(j|t)sx?$/.test(file)) {
  const eslint = run("eslint/bin/eslint.js", ["--fix", file]);
  if (eslint.status !== 0) {
    messages.push(
      `ESLint reporta problemas en ${rel}:\n${eslint.stdout || eslint.stderr}`,
    );
  }
}

// Exit 2 devuelve los problemas a Claude para que los corrija.
if (messages.length) {
  console.error(messages.join("\n"));
  process.exit(2);
}
