import { execFile } from "node:child_process";
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, lstatSync, mkdirSync, unlinkSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { homedir } from "node:os";
import { join, posix } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { getLocalMachineLabel } from "./font.mjs";
import { providerLabel, workspaceProviders } from "./providers.mjs";

const exec = promisify(execFile);
const source = "local.ultra-herdr";
const protocol = "ultra-herdr-labels-v1";
const interval = 15_000;
export const projectSeparator = "─".repeat(22);

export function projectGroups(snapshot, machine) {
  const groups = new Map();
  const result = new Map();
  for (const agent of snapshot.agents || []) {
    if (!agent.workspace_id) continue;
    if (!groups.has(agent.workspace_id)) groups.set(agent.workspace_id, []);
    groups.get(agent.workspace_id).push(agent);
  }
  for (const [workspace, agents] of groups) {
    const project = snapshot.workspaces.find((item) => item.workspace_id === workspace).label;
    agents.forEach((agent, index) => result.set(agent.pane_id, {
      skyline_group_machine: index === 0 ? `[${machine}]` : "",
      skyline_group: index === 0 ? project : "",
      skyline_branch: index === agents.length - 1 ? "└─" : "├─",
      skyline_separator: index === agents.length - 1 ? projectSeparator : "  ┄".repeat(6).trimStart(),
    }));
  }
  return result;
}

function stateDirectory() {
  return process.env.HERDR_PLUGIN_STATE_DIR || join(
    homedir(), ".local/state/herdr/plugins", source,
  );
}

export function controlPath(platform = process.platform, directory = stateDirectory()) {
  return platform === "win32"
    ? `\\\\.\\pipe\\ultra-herdr-${createHash("sha256").update(directory.toLowerCase()).digest("hex").slice(0, 24)}`
    : posix.join(directory, "labels.sock");
}

async function runCommand(args) {
  const { stdout } = await exec(process.env.HERDR_BIN_PATH || "herdr", args, { timeout: 20_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  return stdout;
}

// run receives the exact Herdr argv and may be replaced without launching Herdr.
export async function syncLabels({
  run = runCommand, onError = console.error,
  localMachineLabel = getLocalMachineLabel(),
} = {}) {
  const failures = [];
  const failed = (endpoint, error) => {
    failures.push(endpoint);
    onError(`${endpoint}: ${error instanceof Error ? error.message : error}`);
  };
  let updated = 0;
  for (const endpoint of [{ label: localMachineLabel, args: [] }]) {
    const name = endpoint.args.length ? `machine ${endpoint.args[1]}` : "local";
    try {
      const snapshot = JSON.parse(await run([...endpoint.args, "api", "snapshot"])).result.snapshot;
      const agents = new Map((snapshot.agents || []).map((agent) => [agent.pane_id, agent]));
      const groups = projectGroups(snapshot, endpoint.label);
      for (const pane of snapshot.panes) {
        const badge = `[${endpoint.label}]`;
        const provider = providerLabel(agents.get(pane.pane_id));
        const changes = [];
        const wanted = {
          skyline_machine: badge,
          skyline_provider: provider,
          skyline_group_machine: "",
          skyline_group: "",
          skyline_branch: "",
          skyline_separator: "",
          ...groups.get(pane.pane_id),
        };
        for (const [token, value] of Object.entries(wanted)) {
          if ((pane.tokens?.[token] || "") !== value) {
            changes.push(value ? "--token" : "--clear-token", value ? `${token}=${value}` : token);
          }
        }
        if (!changes.length) continue;
        try {
          await run([
            ...endpoint.args, "pane", "report-metadata", pane.pane_id,
            "--source", source, ...changes,
          ]);
          updated++;
        } catch (error) {
          failed(`${name} pane ${pane.pane_id}`, error);
        }
      }
      for (const workspace of snapshot.workspaces || []) {
        const wanted = {
          skyline_separator: projectSeparator,
          ...workspaceProviders((snapshot.agents || []).filter((agent) => agent.workspace_id === workspace.workspace_id)),
        };
        const changes = [];
        for (const [token, value] of Object.entries(wanted)) {
          if ((workspace.tokens?.[token] || "") !== value) {
            changes.push(value ? "--token" : "--clear-token", value ? `${token}=${value}` : token);
          }
        }
        if (!changes.length) continue;
        try {
          await run([
            ...endpoint.args, "workspace", "report-metadata", workspace.workspace_id,
            "--source", source, ...changes,
          ]);
          updated++;
        } catch (error) {
          failed(`${name} workspace ${workspace.workspace_id}`, error);
        }
      }
    } catch (error) {
      failed(name, error);
    }
  }
  return { updated, failures };
}

function control(path, action) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path);
    let response = "";
    socket.setTimeout(1_000);
    socket.on("connect", () => socket.write(`${protocol} ${action}\n`));
    socket.on("data", (chunk) => {
      response += chunk;
      if (!response.includes("\n")) return;
      socket.end();
      resolve(response.trim() === `${protocol} ${action === "stop" ? "stopping" : "ready"}`);
    });
    socket.on("timeout", () => socket.destroy(new Error("Control socket timed out")));
    socket.on("error", reject);
    socket.on("end", () => {
      if (!response.includes("\n")) reject(new Error("Incomplete control response"));
    });
  });
}

async function daemon() {
  const path = controlPath();
  const windows = process.platform === "win32";
  mkdirSync(stateDirectory(), { recursive: true });
  const log = (message) => appendFileSync(join(stateDirectory(), "labels.log"), `${new Date().toISOString()} ${message}\n`);
  const server = createServer((socket) => {
    socket.setTimeout(1_000, () => socket.destroy());
    socket.once("data", (chunk) => {
      const action = chunk.toString().trim();
      if (action === `${protocol} status`) socket.end(`${protocol} ready\n`);
      else if (action === `${protocol} stop`) {
        socket.end(`${protocol} stopping\n`);
        clearInterval(timer);
        server.close(() => {
          if (!windows) {
            try {
              const current = lstatSync(path);
              if (current.ino === owned.ino && current.dev === owned.dev) unlinkSync(path);
            } catch (error) {
              if (error.code !== "ENOENT") log(`socket cleanup: ${error.message}`);
            }
          }
        });
      } else socket.end("unknown command\n");
    });
  });
  let owned;
  for (;;) {
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(path, () => {
          server.off("error", reject);
          resolve();
        });
      });
      if (!windows) owned = lstatSync(path);
      break;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      try {
        if (await control(path, "status")) {
          process.send?.("ready");
          process.disconnect?.();
          return;
        }
        throw new Error("Socket is owned by an unknown service");
      } catch (probeError) {
        if (probeError.code !== "ECONNREFUSED" && probeError.code !== "ENOENT") throw probeError;
        if (windows) throw new Error("Named pipe is owned by an unresponsive service");
        let stale;
        try {
          stale = lstatSync(path);
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        if (!stale.isSocket()) throw new Error("Control path is not a socket");
        const current = lstatSync(path);
        if (current.dev !== stale.dev || current.ino !== stale.ino) continue;
        unlinkSync(path);
      }
    }
  }
  const sync = async () => {
    if (sync.active) return;
    sync.active = true;
    try {
      await syncLabels({ onError: log });
    } catch (error) {
      log(`sync: ${error.message}`);
    } finally {
      sync.active = false;
    }
  };
  const timer = setInterval(sync, interval);
  process.send?.("ready");
  process.disconnect?.();
  void sync();
}

export async function start() {
  const path = controlPath();
  try {
    if (await control(path, "status")) return;
    throw new Error("Control path is owned by an unknown service");
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ECONNREFUSED") throw error;
  }
  mkdirSync(stateDirectory(), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ["__daemon"], {
      detached: true, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    const timeout = setTimeout(() => finish(new Error("Daemon startup timed out")), 5_000);
    const finish = (error) => {
      clearTimeout(timeout);
      child.off("message", ready);
      child.off("error", finish);
      child.off("exit", exited);
      if (child.connected) child.disconnect();
      child.unref();
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const exited = (code) => finish(new Error(`Daemon exited during startup (${code})`));
    child.once("message", ready);
    child.once("error", finish);
    child.once("exit", exited);
  });
}

export async function stop() {
  try {
    if (!(await control(controlPath(), "stop"))) throw new Error("Control path is owned by an unknown service");
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ECONNREFUSED") throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === "__daemon") {
    daemon().catch((error) => {
      appendFileSync(join(stateDirectory(), "labels.log"), `${new Date().toISOString()} daemon: ${error.message}\n`);
      process.exitCode = 1;
    });
  } else if (command === "start") {
    start().catch((error) => { console.error(error); process.exitCode = 1; });
  } else if (command === "stop") {
    stop().catch((error) => { console.error(error); process.exitCode = 1; });
  } else if (command === "sync") {
    syncLabels().then(({ failures }) => { if (failures.length) process.exitCode = 1; })
      .catch((error) => { console.error(error); process.exitCode = 1; });
  } else {
    console.error("Usage: node labels.mjs start|sync|stop");
    process.exitCode = 1;
  }
}
