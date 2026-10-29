import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { getTheme } from "./themes.mjs";
import { activationError, commitFiles, fileChange } from "./files.mjs";

const configRoot = process.platform === "win32"
  ? process.env.APPDATA
  : process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
if (process.platform === "win32" && !configRoot) throw new Error("APPDATA is required for ultra-herdr settings");
const settingsDirectory = process.env.HERDR_PLUGIN_CONFIG_DIR || join(configRoot, "herdr/plugins/config/local.ultra-herdr");
const settingsPath = join(settingsDirectory, "settings.json");

export function terminalSettingsPath(environment = process.env) {
  if (!environment.LOCALAPPDATA) throw new Error("LOCALAPPDATA is required for Windows Terminal settings");
  return win32.join(environment.LOCALAPPDATA, "Packages", "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json");
}

// Windows Terminal accepts JSON with comments and trailing commas.
export function terminalJson(source) {
  let clean = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      clean += char;
      if (char === "\\") clean += source[++i];
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      clean += char;
    } else if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      clean += "\n";
    } else if (char === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i++;
    } else {
      clean += char;
    }
  }
  let normalized = "";
  quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      normalized += char;
      if (char === "\\") normalized += clean[++i];
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      normalized += char;
    } else if (char !== "," || !/^[}\]]/.test(clean.slice(i + 1).trimStart())) {
      normalized += char;
    }
  }
  return JSON.parse(normalized);
}

export function terminalFontConfig(source, size, name) {
  validateFontSize(size);
  const settings = terminalJson(source);
  if (!Array.isArray(settings.profiles?.list)) throw new Error("Windows Terminal settings require profiles.list");
  let profile = settings.profiles.list.find((item) => item.name === "Herdr");
  if (!profile) {
    profile = {
      name: "Herdr", commandline: "herdr", background: "#000000",
      font: { face: "Jetendard, Herdr Agent Icons Max" },
    };
    settings.profiles.list.push(profile);
  }
  profile.font = { ...profile.font, size };
  if (name !== undefined) {
    const { colors, terminalForeground } = getTheme(name);
    Object.assign(profile, {
      background: colors.panel_bg,
      foreground: terminalForeground,
      cursorColor: terminalForeground,
      selectionBackground: colors.selection_bg,
    });
  }
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function validateFontSize(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 8 || value > 36) {
    throw new Error("Font size must be a number between 8 and 36 pt.");
  }
  return value;
}

export function getFontSize() {
  try {
    return validateFontSize(JSON.parse(readFileSync(settingsPath, "utf8")).fontSize);
  } catch (error) {
    if (error.code === "ENOENT") return 14;
    throw error;
  }
}

export function getThemeName() {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const name = settings.theme ?? "blue";
  getTheme(name);
  return name;
}

export function themeSettings(settings, name) {
  getTheme(name);
  return { ...settings, theme: name };
}

export function setThemeName(name) {
  getTheme(name);
  commitFiles([fileChange(settingsPath, source => `${JSON.stringify(themeSettings(JSON.parse(source?.toString("utf8") || "{}"), name), null, 2)}\n`)]);
  return name;
}

export function getLocalMachineLabel() {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return localMachineLabel(settings);
}

export function localMachineLabel(settings, fallback = hostname()) {
  const label = settings.localMachineLabel;
  if (label === undefined) return fallback;
  if (typeof label !== "string" || !label.trim() || /[\[\]\r\n]/.test(label)) {
    throw new Error("localMachineLabel must be a nonempty label without brackets or newlines");
  }
  return label.trim();
}

export function fontConfig(config, size) {
  validateFontSize(size);
  const line = `font-size = ${size}`;
  return /^\s*font-size\s*=/m.test(config)
    ? config.replace(/^[ \t]*font-size\s*=.*$/gm, line)
    : `${config.trimEnd()}\n${line}\n`;
}

export function fontSettings(settings, size) {
  return { ...settings, fontSize: validateFontSize(size) };
}

export function pluginSettingsPath(platform = process.platform, environment = process.env, home = homedir()) {
  if (environment.HERDR_PLUGIN_CONFIG_DIR) return join(environment.HERDR_PLUGIN_CONFIG_DIR, "settings.json");
  const root = platform === "win32" ? environment.APPDATA : environment.XDG_CONFIG_HOME || join(home, ".config");
  if (!root) throw new Error("APPDATA is required for ultra-herdr settings");
  return join(root, "herdr/plugins/config/local.ultra-herdr/settings.json");
}

export function ghosttyFontConfig(config, size, name) {
  const theme = getTheme(name);
  let updated = fontConfig(config, size);
  for (const [key, value] of Object.entries({
    background: theme.colors.panel_bg,
    foreground: theme.terminalForeground,
    "cursor-color": theme.terminalForeground,
    "selection-background": theme.colors.selection_bg,
  })) {
    updated = new RegExp(`^\\s*${key}\\s*=`, "m").test(updated)
      ? updated.replace(new RegExp(`^[ \\t]*${key}\\s*=.*$`, "gm"), `${key} = ${value}`)
      : `${updated.trimEnd()}\n${key} = ${value}\n`;
  }
  return updated;
}

export function prepareTerminal(name, size, {
  platform = process.platform, environment = process.env, home = homedir(),
  run = execFileSync, terminalPath,
} = {}) {
  validateFontSize(size);
  getTheme(name);
  const path = terminalPath || (platform === "win32" ? terminalSettingsPath(environment) : join(home, ".local/share/herdr-launcher/herdr.ghostty"));
  const change = fileChange(path, source => {
    if (source === null) throw new Error(`Terminal config not found: ${path}`);
    return platform === "win32" ? terminalFontConfig(source.toString("utf8"), size, name) : ghosttyFontConfig(source.toString("utf8"), size, name);
  });
  return {
    change,
    validate(staged) {
      if (platform !== "win32") run("ghostty", ["+validate-config", `--config-file=${staged.get(change.path)}`], { timeout: 10000 });
    },
    activate() {
      if (platform === "win32") return;
      // Never reload or resize unrelated Ghostty windows.
      const result = run("osascript", ["-e", `
        tell application "Ghostty"
          set appliedCount to 0
          repeat with pane in terminals
            if name of pane is "Herdr" then
              if not (perform action "reload_config" on pane) then error "Could not reload Herdr terminal colors"
              if perform action "set_font_size:${size}" on pane then set appliedCount to appliedCount + 1
            end if
          end repeat
          return appliedCount
        end tell
      `], { encoding: "utf8", timeout: 15000 }).trim();
      if (result === "0") throw new Error("Saved font size, but no open Herdr Ghostty window was found.");
    },
  };
}

export function setFontSize(size) {
  const terminal = prepareTerminal(getThemeName(), size);
  const settings = fileChange(settingsPath, source => `${JSON.stringify(fontSettings(JSON.parse(source?.toString("utf8") || "{}"), size), null, 2)}\n`);
  commitFiles([terminal.change, settings], { validate: terminal.validate });
  try { terminal.activate(); }
  catch (cause) { throw activationError(["terminal"], cause); }
  return size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Herdr font size: ${setFontSize(getFontSize())} pt`);
}
