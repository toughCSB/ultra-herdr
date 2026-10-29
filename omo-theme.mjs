import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTheme } from "./themes.mjs";
import { commitFiles, fileChange } from "./files.mjs";

const blue = JSON.parse(readFileSync(new URL("./omo-blue.json", import.meta.url), "utf8"));

export function omoTheme(name, themeName = "herdr-contrast") {
  const { userMessage, omo: overrides } = getTheme(name);
  const theme = structuredClone(blue);
  theme.name = themeName;
  if (overrides) {
    Object.assign(theme.vars, overrides.vars);
    Object.assign(theme.colors, overrides.colors);
    if (overrides.export) Object.assign(theme.export, overrides.export, {
      cardBg: theme.vars.toolPendingBg, infoBg: theme.vars.customMsgBg,
    });
  }
  theme.vars.userMsgBg = userMessage.background;
  theme.colors.userMessageText = userMessage.foreground;
  return theme;
}

export function prepareOmoTheme(name, agentDir = join(homedir(), ".omo", "agent")) {
  getTheme(name);
  const settingsPath = join(agentDir, "settings.json");
  if (!existsSync(settingsPath)) return { changes: [], result: { applied: false, reason: "OMO settings not found" } };
  let selected, changedSelection;
  const settingsChange = fileChange(settingsPath, source => {
    const settings = JSON.parse(source.toString("utf8"));
    selected = ["herdr-contrast", "ultra-herdr"].includes(settings.theme) ? settings.theme : "ultra-herdr";
    changedSelection = settings.theme !== selected;
    return changedSelection ? `${JSON.stringify({ ...settings, theme: selected }, null, 2)}\n` : source;
  });
  const changes = [fileChange(join(agentDir, "themes", `${selected}.json`), `${JSON.stringify(omoTheme(name, selected), null, 2)}\n`), settingsChange];
  return { changes, result: { applied: true, theme: selected, changedSelection } };
}

export function syncOmoTheme(name, agentDir) {
  const plan = prepareOmoTheme(name, agentDir);
  commitFiles(plan.changes);
  return plan.result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(syncOmoTheme(process.argv[2])));
}
