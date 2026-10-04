import assert from "node:assert/strict";
import { test } from "node:test";
import { clientAsset, ghosttyClientConfig, activateMacClient } from "./client.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("a cached Mac launcher command resolves the newly activated companion", { skip: process.platform === "win32" }, () => {
  const base = mkdtempSync(join(tmpdir(), "ultra-client-"));
  try {
    for (const version of ["old", "new"]) {
      mkdirSync(join(base, version));
      writeFileSync(join(base, version, "herdr"), `console.log('${version}')`);
    }
    const cached = activateMacClient(base, join(base, "old"));
    assert.equal(execFileSync(process.execPath, [cached], { encoding: "utf8" }).trim(), "old");
    assert.equal(activateMacClient(base, join(base, "new")), cached);
    assert.equal(execFileSync(process.execPath, [cached], { encoding: "utf8" }).trim(), "new");
    assert.match(readFileSync(join(base, "old", "herdr"), "utf8"), /old/);
    assert.throws(() => activateMacClient(base, join(base, "missing")), /missing/);
    assert.equal(execFileSync(process.execPath, [cached], { encoding: "utf8" }).trim(), "new");
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("release selects the execution platform and rejects unsupported architectures", () => {
  assert.equal(clientAsset("darwin", "arm64").file, "herdr-client-darwin-arm64.tar.gz");
  assert.equal(clientAsset("win32", "x64").file, "herdr-client-win32-x64.zip");
  assert.throws(() => clientAsset("linux", "x64"), /does not support/);
});

test("client updates change only the launcher command and retain theme and font", () => {
  const source = "command = direct:/old/herdr\nfont-size = 13\nbackground = #fffafa\n";
  assert.equal(ghosttyClientConfig(source, "/new/herdr"),
    "command = direct:/new/herdr\nfont-size = 13\nbackground = #fffafa\n");
  assert.throws(() => ghosttyClientConfig("font-size = 13\n", "/new"), /no command/);
});
