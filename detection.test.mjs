import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { prepareCodexHudDetection } from "./detection.mjs";
import { commitFiles } from "./files.mjs";

test("HUD rules reach existing servers without replacing custom detector rules", () => {
  const root = mkdtempSync(join(tmpdir(), "ultra-detection-"));
  try {
    const config = join(root, "config.toml"), path = join(root, "agent-detection/codex.toml");
    commitFiles([prepareCodexHudDetection(config)]);
    assert.match(readFileSync(path, "utf8"), /id = "hud_working"/);
    assert.equal(commitFiles([prepareCodexHudDetection(config)]).changed, 0);
    const custom = 'id = "codex"\nversion = "2026.10.11.1"\nmin_engine_version = 3\n[[rules]]\nid = "my_custom_rule"\nstate = "idle"\ncontains = ["custom prompt"]\n';
    writeFileSync(path, custom);
    commitFiles([prepareCodexHudDetection(config)]);
    assert.ok(readFileSync(path, "utf8").startsWith(custom));
    assert.match(readFileSync(path, "utf8"), /id = "hud_waiting"/);
    writeFileSync(path, custom.replace("my_custom_rule", "hud_working"));
    assert.throws(() => prepareCodexHudDetection(config), /partial HUD/);
    assert.equal(readFileSync(path, "utf8"), custom.replace("my_custom_rule", "hud_working"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
