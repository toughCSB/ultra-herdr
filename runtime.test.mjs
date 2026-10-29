import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
function commands(section, platform) {
  return readFileSync(join(root, "herdr-plugin.toml"), "utf8")
    .split(`[[${section}]]`).slice(1).map(block => block.split("[[")[0])
    .filter(block => !block.includes("platforms =") || JSON.parse(block.match(/platforms = (\[[^\n]+\])/)[1]).includes(platform))
    .map(block => JSON.parse(block.match(/command = (\[[^\n]+\])/)[1]));
}

test("Mac startup and install find Node with a GUI-only PATH", { skip: process.platform !== "darwin" }, () => {
  const home = mkdtempSync(join(tmpdir(), "ultra runtime "));
  try {
    const bin = join(home, ".local/bin");
    mkdirSync(bin, { recursive: true });
    symlinkSync(process.execPath, join(bin, "node"));
    const probe = join(home, "probe.mjs");
    writeFileSync(probe, "console.log(JSON.stringify({args:process.argv.slice(2),socket:process.env.HERDR_SOCKET_PATH,bin:process.env.HERDR_BIN_PATH}))");
    for (const section of ["startup", "build"]) {
      const entries = commands(section, "macos");
      assert.equal(entries.length, 1);
      const command = entries[0];
      const scriptIndex = command.findIndex(arg => arg.endsWith(".mjs"));
      assert.ok(scriptIndex > 0);
      const invocation = [...command.slice(0, scriptIndex), probe, "한글 spaced argument", "a;b"];
      const output = execFileSync(invocation[0], invocation.slice(1), {
        cwd: root,
        env: { HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HERDR_SOCKET_PATH: "/tmp/existing socket", HERDR_BIN_PATH: "/tmp/existing herdr" },
        encoding: "utf8",
      });
      assert.deepEqual(JSON.parse(output), { args: ["한글 spaced argument", "a;b"], socket: "/tmp/existing socket", bin: "/tmp/existing herdr" });
    }
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("Windows startup and install keep their native Node commands", () => {
  assert.deepEqual(commands("startup", "windows"), [["node", "labels.mjs", "start"]]);
  assert.deepEqual(commands("build", "windows"), [["node", "client.mjs"]]);
});
