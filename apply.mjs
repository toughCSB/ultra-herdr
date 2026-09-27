import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { getFontSize, setFontSize, getThemeName, setThemeName, validateFontSize } from "./font.mjs";
import { start, syncLabels } from "./labels.mjs";
import { providerCell, providerTokenCell, workspaceProviderKeys } from "./providers.mjs";
import { getTheme } from "./themes.mjs";
import { syncOmoTheme } from "./omo-theme.mjs";

const status = '{ token = "state_text", bold = true, dim = false, rules = [{ starts_with = "blocked", fg = "#ff3030" }, { starts_with = "working", fg = "#ffff00" }, { starts_with = "done", fg = "#00ff66" }, { starts_with = "idle", fg = "#00ff66" }, { starts_with = "unknown", fg = "#b8cce0" }] }';
function sidebar(theme) {
  const providerRows = [];
  for (let index = 0; index < workspaceProviderKeys.length; index += 2) {
    providerRows.push(`  [${workspaceProviderKeys.slice(index, index + 2).map(key => providerTokenCell(`$${key}`)).join(", ")}],`);
  }
  return [
  "# >>> ultra-herdr sidebar",
  "[ui.sidebar.agents]",
  "row_gap = 0",
  "rows = [",
  `  [{ token = "$skyline_group_machine", bold = true, fg = "${theme.badge}", rules = [{ equals = "[SV]", fg = "#ffb3ff" }, { equals = "[Mac]", fg = "#b5c9ff" }] }, { token = "$skyline_group", bold = true, fg = "#ffffff" }],`,
  `  [{ token = "$skyline_branch", fg = "${theme.badge}" }, ${providerCell}, "state_icon", ${status}],`,
  `  [{ token = "terminal_title_stripped", fg = "${theme.title}" }],`,
  `  [{ token = "$skyline_separator", fg = "${theme.separator}", bold = false, dim = false }],`,
  "]",
  "",
  "[ui.sidebar.spaces]",
  "row_gap = 0",
  'rows = [["state_icon", { token = "workspace", bold = true, fg = "#ffffff" }],',
  ...providerRows,
  `  [${status}, "branch", "git_status"],`,
  `  [{ token = "$skyline_separator", fg = "${theme.separator}", bold = false, dim = false }]]`,
  "# <<< ultra-herdr sidebar",
].join("\n");
}

export function herdrConfigPath(platform = process.platform, environment = process.env, home = homedir()) {
  if (environment.HERDR_CONFIG_PATH) return environment.HERDR_CONFIG_PATH;
  if (platform === "win32") {
    if (!environment.APPDATA) throw new Error("APPDATA is required to locate Herdr config on Windows");
    return win32.join(environment.APPDATA, "herdr", "config.toml");
  }
  return posix.join(environment.XDG_CONFIG_HOME || posix.join(home, ".config"), "herdr", "config.toml");
}

function replaceKeys(lines, section, values, addMissing = false) {
  const start = lines.indexOf(`[${section}]`);
  if (start < 0) throw new Error(`Missing [${section}] in Herdr config`);
  const end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
  let limit = end < 0 ? lines.length : end;
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex(
      (line, position) => position > start && position < limit && new RegExp(`^\\s*${key}\\s*=`).test(line),
    );
    if (index < 0) {
      if (!addMissing) throw new Error(`Missing ${section}.${key} in Herdr config`);
      const marker = lines.findIndex(
        (line, position) => position > start && position < limit && /^# (?:<<<|>>>)/.test(line),
      );
      lines.splice(marker < 0 ? limit : marker, 0, `${key} = ${value}`);
      limit++;
    } else {
      lines[index] = `${key} = ${value}`;
    }
  }
}

export function applyTheme(config, name = "blue") {
  const theme = getTheme(name);
  const lines = config.replace(/\r\n/g, "\n").split("\n");
  if (!lines.includes("[ui]")) lines.push("", "[ui]");
  replaceKeys(lines, "ui", { agent_panel_sort: '"spaces"' }, true);
  replaceKeys(lines, "theme", { name: '"tokyo-night"', auto_switch: "false" });
  replaceKeys(
    lines,
    "theme.custom",
    Object.fromEntries(Object.entries(theme.colors).map(([key, value]) => [key, `"${value}"`])),
    true,
  );
  const result = lines.join("\n").replace(/^(# (?:>>>|<<<)) skyline-blue theme$/gm, "$1 ultra-herdr theme");
  const block = /^# >>> (?:herdr-radar sidebar block|skyline-blue sidebar|ultra-herdr sidebar)\n[\s\S]*?^# <<< (?:herdr-radar sidebar block|skyline-blue sidebar|ultra-herdr sidebar)/m;
  return block.test(result) ? result.replace(block, () => sidebar(theme)) : result;
}

export function reloadLocalConfig(run = (args) => execFileSync(
  process.env.HERDR_BIN_PATH || "herdr", args,
  { windowsHide: true, encoding: "utf8", timeout: 20_000 },
)) {
  run(["server", "reload-config"]);
}

export function applyPalette(name = getThemeName()) {
  const configPath = herdrConfigPath();
  const original = readFileSync(configPath, "utf8");
  const updated = applyTheme(original, name);
  if (updated !== original) {
    if (readFileSync(configPath, "utf8") !== original) throw new Error("Herdr config changed while applying theme");
    const temporary = `${configPath}.ultra-herdr-${process.pid}`;
    writeFileSync(temporary, updated);
    renameSync(temporary, configPath);
    try {
      execFileSync(process.env.HERDR_BIN_PATH || "herdr", ["config", "check"], { windowsHide: true });
    } catch (error) {
      writeFileSync(temporary, original);
      renameSync(temporary, configPath);
      throw error;
    }
  }
  setThemeName(name);
  const content = syncOmoTheme(name);
  if (content.changedSelection) console.log("OMO theme selected; existing built-in-theme sessions update on their next safe config reload.");
  reloadLocalConfig();
}

export async function applyCurrentTheme(name = getThemeName(), size = getFontSize()) {
  getTheme(name);
  validateFontSize(size);
  applyPalette(name);
  setFontSize(size);
  const labels = await syncLabels();
  await start();
  if (labels.failures.length) throw new Error(`Metadata sync failed: ${labels.failures.join(", ")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await applyCurrentTheme(process.argv[2] || getThemeName());
  console.log(`ultra-herdr: ${getThemeName()} applied.`);
}
