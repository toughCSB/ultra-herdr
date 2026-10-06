import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { getTheme } from "./themes.mjs";

export function markdownPaths(platform = process.platform, environment = process.env, home = homedir()) {
  if (platform === "win32") {
    if (!environment.LOCALAPPDATA) throw new Error("LOCALAPPDATA is required for Markdown viewer settings");
    return {
      sidebar: win32.join(environment.LOCALAPPDATA, "herdr", "plugins", "herdr-sidebar", "state.json"),
      glow: win32.join(environment.LOCALAPPDATA, "glow", "Config", "glow.yml"),
    };
  }
  return {
    sidebar: posix.join(environment.XDG_STATE_HOME || posix.join(home, ".local/state"), "herdr/plugins/herdr-sidebar/state.json"),
    glow: platform === "darwin"
      ? posix.join(home, "Library/Preferences/glow/glow.yml")
      : posix.join(environment.XDG_CONFIG_HOME || posix.join(home, ".config"), "glow/glow.yml"),
  };
}

export function sidebarMarkdownTheme(source, name) {
  getTheme(name);
  const state = JSON.parse(source);
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Invalid sidebar state");
  const colors = name === "pink" ? "light" : "vscode";
  if (state.colors === colors) return source;
  return `${JSON.stringify({ ...state, colors }, null, 2)}\n`;
}

export function glowMarkdownTheme(source, name) {
  getTheme(name);
  const line = `style: "${name === "pink" ? "light" : "dark"}"`;
  if (/^style\s*:/m.test(source)) return source.replace(/^style\s*:.*$/m, line);
  return `${source}${source.endsWith("\n") || !source ? "" : "\n"}${line}\n`;
}

// The file-sidebar preview passes an explicit Glow style, so its own state
// must agree with the execution PC as well as the standalone Glow config.
export function syncMarkdownViewers(name, options = {}) {
  const paths = options.paths || markdownPaths();
  let changed = 0;
  for (const [path, transform] of [[paths.sidebar, sidebarMarkdownTheme], [paths.glow, glowMarkdownTheme]]) {
    if (!existsSync(path)) continue;
    const original = readFileSync(path, "utf8");
    const updated = transform(original, name);
    if (updated === original) continue;
    if (readFileSync(path, "utf8") !== original) throw new Error("Markdown viewer settings changed while applying theme");
    const temporary = `${path}.ultra-herdr-${process.pid}`;
    writeFileSync(temporary, updated);
    renameSync(temporary, path);
    changed++;
  }
  return changed;
}
