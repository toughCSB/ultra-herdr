import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTheme } from "./themes.mjs";

const blue = JSON.parse(readFileSync(new URL("./omo-blue.json", import.meta.url), "utf8"));

export function omoTheme(name, themeName = "herdr-contrast") {
  const { userMessage } = getTheme(name);
  const theme = structuredClone(blue);
  theme.name = themeName;
  if (name === "pink") {
    Object.assign(theme.vars, {
      cyan: "#9b235f", blue: "#a32463", accent: "#a32463",
      green: "#9b235f", red: "#b42318", yellow: "#d65a00",
      text: "#30252b", gray: "#705d67", dimGray: "#806b76", darkGray: "#9e8793",
      selectedBg: "#febab9",
      toolPendingBg: "#ffedf3", toolSuccessBg: "#f7e9f0",
      toolErrorBg: "#ffe6e6", customMsgBg: "#fbd8e7",
    });
    Object.assign(theme.colors, {
      customMessageLabel: "#9b235f",
      toolOutput: "#60404f", mdHeading: "#8b2755", mdLink: "#9b235f",
      syntaxKeyword: "#9b235f", syntaxVariable: "#60404f",
      syntaxFunction: "#7b4a00", syntaxString: "#8c3d29", syntaxNumber: "#9b235f",
      syntaxComment: "#9e587b", toolDiffAdded: "#168a45",
      syntaxType: "#7b2d77", syntaxOperator: "#30252b", syntaxPunctuation: "#30252b",
      thinkingLow: "#806b76", thinkingMedium: "#9b235f",
    });
    Object.assign(theme.export, {
      pageBg: "#fffafa", cardBg: theme.vars.toolPendingBg, infoBg: theme.vars.customMsgBg,
    });
  }
  if (name === "red") {
    Object.assign(theme.vars, {
      cyan: "#ff595e", blue: "#ff595e", accent: "#ff595e", text: "#fff0f3",
      selectedBg: "#c81d25",
      toolPendingBg: "#26262b", toolSuccessBg: "#26262b",
      toolErrorBg: "#331015", customMsgBg: "#26262b",
    });
    Object.assign(theme.colors, {
      customMessageLabel: "#ff595e",
      toolOutput: "#fff0f3", mdLink: "#ff595e",
      syntaxKeyword: "#ff595e", syntaxVariable: "#fff0f3",
      syntaxType: "#ff595e", thinkingLow: "#ff595e", thinkingMedium: "#fff0f3",
    });
    Object.assign(theme.export, {
      pageBg: "#0b0b0e", cardBg: theme.vars.toolPendingBg, infoBg: theme.vars.customMsgBg,
    });
  }
  theme.vars.userMsgBg = userMessage.background;
  theme.colors.userMessageText = userMessage.foreground;
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
