import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileChange } from "./files.mjs";

const bundled = readFileSync(new URL("./integrations/codex/detection.toml", import.meta.url), "utf8");
const rules = bundled.slice(bundled.indexOf("# The custom Codex HUD"), bundled.indexOf('[[rules]]\nid = "osc_title_blocked"'));
const ids = ["hud_waiting", "hud_working", "hud_ready"];

// Detection manifests reload with config. Existing Windows servers can use the
// new HUD footer rules while their live PTYs and agent processes stay in place.
export function prepareCodexHudDetection(configPath) {
  return fileChange(join(dirname(configPath), "agent-detection", "codex.toml"), source => {
    if (source === null) return bundled;
    const current = source.toString("utf8");
    const present = ids.filter(id => new RegExp(`^\\s*id\\s*=\\s*["']${id}["']\\s*(?:#.*)?$`, "m").test(current));
    if (present.length === ids.length) return source;
    if (present.length) throw new Error("Existing Codex detector has partial HUD rules; preserved for manual merge");
    const engine = /^min_engine_version\s*=\s*(\d+)/m.exec(current);
    const compatible = engine ? current.replace(engine[0], `min_engine_version = ${Math.max(3, Number(engine[1]))}`)
      : `min_engine_version = 3\n${current}`;
    return `${compatible}\n# >>> ultra-herdr Codex HUD\n${rules}# <<< ultra-herdr Codex HUD\n`;
  });
}
