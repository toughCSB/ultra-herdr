import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { getFontSize, getThemeName, validateFontSize, prepareTerminal, pluginSettingsPath, themeSettings, fontSettings } from "./font.mjs";
import { start, syncLabels } from "./labels.mjs";
import { providerTokenCell, workspaceProviderKeys } from "./providers.mjs";
import { getTheme } from "./themes.mjs";
import { prepareOmoTheme } from "./omo-theme.mjs";
import { prepareMarkdownViewers, markdownPaths } from "./markdown.mjs";
import { prepareSidebarTheme } from "./sidebar-theme.mjs";
import { activationError, commitFiles, fileChange } from "./files.mjs";
import { prepareCodexHudDetection } from "./detection.mjs";

function sidebar(theme) {
  const sidebarText = theme.sidebarText;
  const workingColor = theme.workingColor || theme.colors.yellow;
  const status = `{ token = "state_text", bold = true, dim = false, rules = [{ starts_with = "blocked", fg = "${theme.colors.red}" }, { starts_with = "working", fg = "${workingColor}" }, { starts_with = "done", fg = "${theme.colors.green}" }, { starts_with = "idle", fg = "${theme.colors.green}" }, { starts_with = "unknown", fg = "${theme.sidebarText ? theme.colors.overlay0 : "#b8cce0"}" }] }`;
  const activity = `{ token = "$ultra_activity", fg = "${workingColor}", bold = true }`;
  const providerCell = providerTokenCell("$skyline_provider", theme);
  const providerRows = [];
  for (let index = 0; index < workspaceProviderKeys.length; index += 2) {
    providerRows.push(`  [${workspaceProviderKeys.slice(index, index + 2).map(key => providerTokenCell(`$${key}`, theme)).join(", ")}],`);
  }
  return [
  "# >>> ultra-herdr sidebar",
  "[ui.sidebar.agents]",
  "row_gap = 0",
  "rows = [",
  `  [${activity}, { token = "$skyline_group_machine", bold = true, fg = "${sidebarText || theme.badge}", rules = [{ equals = "[SV]", fg = "${sidebarText || "#ffb3ff"}" }, { equals = "[Mac]", fg = "#b5c9ff" }] }, { token = "$skyline_group", bold = true, fg = "${sidebarText || "#ffffff"}" }, { token = "$skyline_identity", fg = "${sidebarText || theme.title}", bold = false }],`,
  `  [{ token = "$skyline_branch", fg = "${sidebarText || theme.badge}" }, "state_icon", ${status}, ${providerCell}],`,
  `  [{ token = "terminal_title_stripped", fg = "${sidebarText || theme.title}" }],`,
  `  [{ token = "$skyline_separator", fg = "${sidebarText || theme.separator}", bold = false, dim = false }],`,
  "]",
  "",
  "[ui.sidebar.spaces]",
  "row_gap = 0",
  `rows = [["state_icon", ${status}, ${activity}, { token = "workspace", bold = true, fg = "${sidebarText || "#ffffff"}" }, { token = "$ultra_session_count", fg = "${sidebarText || theme.title}" }],`,
  ...providerRows,
  `  ["branch", "git_status", { token = "$skyline_separator", fg = "${theme.separator}", bold = false, dim = false }]]`,
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
  const uiStart = lines.indexOf("[ui]");
  const uiEnd = lines.findIndex((line, index) => index > uiStart && /^\s*\[/.test(line));
  if (!lines.slice(uiStart + 1, uiEnd < 0 ? lines.length : uiEnd).some(line => /^\s*agent_panel_sort\s*=/.test(line))) {
    lines.splice(uiStart + 1, 0, 'agent_panel_sort = "priority"');
  }
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

export function applyPalette(name = getThemeName(), size = getFontSize(), options = {}) {
  getTheme(name);
  validateFontSize(size);
  const { platform = process.platform, environment = process.env, home = homedir(), run = execFileSync } = options;
  const configPath = options.configPath || herdrConfigPath(platform, environment, home);
  const settingsPath = options.settingsPath || pluginSettingsPath(platform, environment, home);
  const config = fileChange(configPath, source => {
    if (source === null) throw new Error(`Herdr config not found: ${configPath}`);
    return applyTheme(source.toString("utf8"), name);
  });
  const terminal = prepareTerminal(name, size, { ...options, platform, environment, home, run });
  const settings = fileChange(settingsPath, source => `${JSON.stringify(themeSettings(fontSettings(JSON.parse(source?.toString("utf8") || "{}"), size), name), null, 2)}\n`);
  const omo = prepareOmoTheme(name, options.agentDir || posix.join(home, ".omo", "agent"));
  const markdown = prepareMarkdownViewers(name, { paths: options.markdownPaths || markdownPaths(platform, environment, home) });
  commitFiles([config, terminal.change, settings, ...omo.changes, ...markdown, prepareSidebarTheme(name, configPath), prepareCodexHudDetection(configPath)], {
    io: options.io,
    validate(staged) {
      terminal.validate(staged);
      run(environment.HERDR_BIN_PATH || "herdr", ["config", "check"], {
        windowsHide: true, timeout: 20000,
        env: { ...environment, HERDR_CONFIG_PATH: staged.get(config.path) },
      });
    },
  });
  if (omo.result.changedSelection) console.log("OMO theme selected; existing built-in-theme sessions update on their next safe config reload.");
  const failed = [];
  const causes = [];
  for (const [stage, activate] of [
    ["terminal", () => terminal.activate()],
    ["reload-config", () => reloadLocalConfig(args => run(environment.HERDR_BIN_PATH || "herdr", args, { windowsHide: true, encoding: "utf8", timeout: 20000 }))],
  ]) {
    try { activate(); } catch (cause) { failed.push(stage); causes.push(cause); }
  }
  if (failed.length) throw activationError(failed, new AggregateError(causes));
  return { persisted: true };
}

export async function applyCurrentTheme(name = getThemeName(), size = getFontSize(), options = {}) {
  const failed = [];
  const causes = [];
  try { applyPalette(name, size, options); }
  catch (error) {
    if (!error.persisted) throw error;
    failed.push(...error.failed); causes.push(error);
  }
  for (const [stage, activate] of [
    ["metadata", async () => {
      const labels = await (options.syncLabels || syncLabels)();
      if (labels.failures.length) throw new Error(`Metadata sync failed: ${labels.failures.join(", ")}`);
    }],
    ["activity", () => (options.start || start)()],
  ]) {
    try { await activate(); } catch (cause) { failed.push(stage); causes.push(cause); }
  }
  if (failed.length) throw activationError(failed, new AggregateError(causes));
  return { persisted: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await applyCurrentTheme(process.argv[2] || getThemeName());
  console.log(`ultra-herdr: ${getThemeName()} applied.`);
}
