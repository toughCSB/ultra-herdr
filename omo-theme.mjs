import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTheme } from "./themes.mjs";

const blue = JSON.parse(readFileSync(new URL("./omo-blue.json", import.meta.url), "utf8"));

export function omoTheme(name, themeName = "herdr-contrast") {
  getTheme(name);
  const theme = structuredClone(blue);
  theme.name = themeName;
  if (name === "pink") {
    Object.assign(theme.vars, {
      cyan: "#ff9bce", blue: "#ffacd8", accent: "#ff91ca",
      selectedBg: "#761342", userMsgBg: "#ffc6e3",
      toolPendingBg: "#64113f", toolSuccessBg: "#741047",
      toolErrorBg: "#601a37", customMsgBg: "#831b53",
    });
    Object.assign(theme.colors, {
      userMessageText: "#480d30", customMessageLabel: "#ffabd7",
      toolOutput: "#f4d5e6", mdLink: "#ffabd7",
      syntaxKeyword: "#f08bc4", syntaxVariable: "#ffd0e9",
      syntaxType: "#f5a4d0", thinkingLow: "#bc78a0", thinkingMedium: "#e69dc6",
    });
    Object.assign(theme.export, { cardBg: theme.vars.toolPendingBg, infoBg: theme.vars.customMsgBg });
  }
  if (name === "red") {
    Object.assign(theme.vars, {
      cyan: "#ff595e", blue: "#ff595e", accent: "#ff595e", text: "#fff0f3",
      selectedBg: "#c81d25", userMsgBg: "#fff0f3",
      toolPendingBg: "#26262b", toolSuccessBg: "#26262b",
      toolErrorBg: "#331015", customMsgBg: "#26262b",
    });
    Object.assign(theme.colors, {
      userMessageText: "#c81d25", customMessageLabel: "#ff595e",
      toolOutput: "#fff0f3", mdLink: "#ff595e",
      syntaxKeyword: "#ff595e", syntaxVariable: "#fff0f3",
      syntaxType: "#ff595e", thinkingLow: "#ff595e", thinkingMedium: "#fff0f3",
    });
    Object.assign(theme.export, {
      pageBg: "#0b0b0e", cardBg: theme.vars.toolPendingBg, infoBg: theme.vars.customMsgBg,
    });
  }
  return theme;
}

function saveJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (existsSync(path) && readFileSync(path, "utf8") === text) return;
  const temporary = `${path}.ultra-herdr-${process.pid}`;
  writeFileSync(temporary, text);
  renameSync(temporary, path);
}

export function syncOmoTheme(name, agentDir = join(homedir(), ".omo", "agent")) {
  getTheme(name);
  const settingsPath = join(agentDir, "settings.json");
  if (!existsSync(settingsPath)) return { applied: false, reason: "OMO settings not found" };
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const selected = ["herdr-contrast", "ultra-herdr"].includes(settings.theme)
    ? settings.theme : "ultra-herdr";
  const themeDir = join(agentDir, "themes");
  mkdirSync(themeDir, { recursive: true });
  saveJson(join(themeDir, `${selected}.json`), omoTheme(name, selected));
  const changedSelection = settings.theme !== selected;
  if (changedSelection) saveJson(settingsPath, { ...settings, theme: selected });
  return { applied: true, theme: selected, changedSelection };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(syncOmoTheme(process.argv[2])));
}
