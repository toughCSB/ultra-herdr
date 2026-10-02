import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { getTheme } from "./themes.mjs";

const configRoot = process.platform === "win32"
  ? process.env.APPDATA
  : process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
if (process.platform === "win32" && !configRoot) throw new Error("APPDATA is required for ultra-herdr settings");
const settingsDirectory = process.env.HERDR_PLUGIN_CONFIG_DIR || join(configRoot, "herdr/plugins/config/local.ultra-herdr");
const settingsPath = join(settingsDirectory, "settings.json");
const launcher = join(homedir(), ".local/share/herdr-launcher/herdr.ghostty");

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
    const { colors } = getTheme(name);
    Object.assign(profile, {
      background: colors.panel_bg,
      foreground: name === "pink" ? colors.text : "#d4d4d4",
      cursorColor: name === "pink" ? colors.text : "#d4d4d4",
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
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  mkdirSync(settingsDirectory, { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(themeSettings(settings, name), null, 2)}\n`);
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

export function setFontSize(size) {
  validateFontSize(size);
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (process.platform === "win32") {
    const path = terminalSettingsPath();
    const original = readFileSync(path, "utf8");
    const updated = terminalFontConfig(original, size, getThemeName());
    if (updated !== original) writeFileSync(path, updated);
    mkdirSync(settingsDirectory, { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(fontSettings(settings, size), null, 2)}\n`);
    return size; // Windows Terminal reloads settings; existing panes may need reopening.
  }
  const config = readFileSync(launcher, "utf8");
  const themeName = getThemeName();
  const theme = getTheme(themeName);
  let updated = fontConfig(config, size);
  for (const [key, value] of Object.entries({
    background: theme.colors.panel_bg,
    foreground: themeName === "pink" ? theme.colors.text : "#d4d4d4",
    "cursor-color": themeName === "pink" ? theme.colors.text : "#d4d4d4",
    "selection-background": theme.colors.selection_bg,
  })) {
    updated = new RegExp(`^\\s*${key}\\s*=`, "m").test(updated)
      ? updated.replace(new RegExp(`^[ \\t]*${key}\\s*=.*$`, "gm"), `${key} = ${value}`)
      : `${updated.trimEnd()}\n${key} = ${value}\n`;
  }
  writeFileSync(launcher, updated);
  try {
    execFileSync("ghostty", ["+validate-config", `--config-file=${launcher}`], { timeout: 10000 });
  } catch (error) {
    writeFileSync(launcher, config);
    throw error;
  }
  mkdirSync(settingsDirectory, { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(fontSettings(settings, size), null, 2)}\n`);
  // The launcher names its surface Herdr; never resize unrelated Ghostty windows.
  const result = execFileSync("osascript", ["-e", `
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
  return size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Herdr font size: ${setFontSize(getFontSize())} pt`);
}
