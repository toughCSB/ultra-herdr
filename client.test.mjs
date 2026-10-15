import assert from "node:assert/strict";
import { test } from "node:test";
import { clientAsset, ghosttyClientConfig, activateMacClient } from "./client.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

test("installer follows baseVersion across rebases and preserves the old installation", { skip: process.platform !== "darwin" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ultra-rebase-"));
  try {
    const fixture = join(dir, "module"), packageDir = join(dir, "package");
    mkdirSync(fixture); mkdirSync(packageDir);
    writeFileSync(join(packageDir, "herdr"), "test companion executable\n");
    const archive = join(dir, "client.tar.gz");
    execFileSync("tar", ["-czf", archive, "-C", packageDir, "herdr"]);
    const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
    writeFileSync(join(fixture, "client.mjs"), readFileSync(new URL("./client.mjs", import.meta.url)));
    for (const name of ["font.mjs", "windows-launcher.mjs"]) {
      symlinkSync(fileURLToPath(new URL(name, import.meta.url)), join(fixture, name));
    }
    const launcher = join(dir, ".local/share/herdr-launcher");
    mkdirSync(launcher, { recursive: true });
    writeFileSync(join(launcher, "herdr.ghostty"), "command = direct:/old/herdr\nfont-size = 13\n");
    for (const baseVersion of ["0.9.1", "0.9.5"]) {
      writeFileSync(join(fixture, "client-release.json"), JSON.stringify({
        baseVersion, version: "3.0.23", assets: {
          [`${process.platform}-${process.arch}`]: { file: "client.tar.gz", sha256 },
        },
      }));
      const script = `
        import assert from 'node:assert/strict';
        import { readFileSync } from 'node:fs';
        import { installClient } from './client.mjs';
        globalThis.fetch = async url => {
          assert.equal(url, 'https://github.com/toughCSB/ultra-herdr/releases/download/v3.0.23/client.tar.gz');
          return new Response(readFileSync(${JSON.stringify(archive)}));
        };
        const binary = await installClient();
        assert.equal(binary, ${JSON.stringify(join(dir, ".local/share/ultra-herdr-client", `${baseVersion}-ultra-3.0.23`, "herdr"))});
        globalThis.fetch = () => { throw new Error('cached client was downloaded again'); };
        assert.equal(await installClient(), binary);
      `;
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        cwd: fixture, env: { ...process.env, HOME: dir },
      });
    }
    assert.equal(readFileSync(join(dir, ".local/share/ultra-herdr-client/0.9.1-ultra-3.0.23/herdr"), "utf8"), "test companion executable\n");
    assert.match(readFileSync(join(launcher, "herdr.ghostty"), "utf8"), /font-size = 13/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

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
