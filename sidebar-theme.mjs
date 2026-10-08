import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getTheme } from "./themes.mjs";

function tint(background, foreground) {
  const channel = (hex, index) => parseInt(hex.slice(index, index + 2), 16);
  return "#" + [1, 3, 5].map(index => Math.round(
    channel(background, index) * 0.88 + channel(foreground, index) * 0.12,
  ).toString(16).padStart(2, "0")).join("");
}

export function sidebarTheme(name) {
  const theme = getTheme(name);
  return {
    version: 1,
    sidebar_background: theme.colors.sidebar_bg,
    states: Object.fromEntries(Object.entries(theme.sidebarStates).map(([status, paint]) => [status, {
      ...paint,
      row_background: ["idle", "unknown"].includes(status)
        ? theme.colors.sidebar_bg : tint(theme.colors.sidebar_bg, paint.foreground),
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
