import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [
  spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "watch", "server/main.ts", "--dev"], {
    cwd: root,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    cwd: root,
    stdio: "inherit",
  }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
}

for (const child of children) {
  child.on("error", error => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", code => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
