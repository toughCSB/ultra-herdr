import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getTheme } from "./themes.mjs";

export function sidebarTheme(name) {
  const theme = getTheme(name);
  return {
    version: 2,
    sidebar_background: theme.colors.sidebar_bg,
    states: Object.fromEntries(Object.entries(theme.sidebarStates).map(([status, paint]) => [status, {
      ...paint,
      icon_foreground: status === "unknown" ? theme.colors.overlay0 : paint.foreground,
      row_background: paint.row_background || theme.colors.sidebar_bg,
    }])),
  };
}

export function syncSidebarTheme(name, configPath) {
  const path = join(dirname(configPath), "plugins", "config", "local.ultra-herdr", "sidebar-status.json");
  const original = existsSync(path) ? readFileSync(path, "utf8") : null;
  const updated = `${JSON.stringify(sidebarTheme(name), null, 2)}\n`;
  if (original === updated) return false;
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") !== original) throw new Error("Sidebar theme changed while applying settings");
  const temporary = `${path}.ultra-herdr-${process.pid}`;
  writeFileSync(temporary, updated);
  renameSync(temporary, path);
  return true;
}
