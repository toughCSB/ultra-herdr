import { createConnection } from "node:net";

const source = "local.ultra-herdr.activity";
const frames = "\u280b\u2819\u2839\u2838\u283c\u2834\u2826\u2827\u2807\u280f";
const workingInterval = 225;
const idleInterval = 1_000;
const ttl = 2_000;
const requestTimeout = 750;
const tickTimeout = 1_000;
const maxResponseBytes = 8 * 1024 * 1024;

// Herdr 0.9.1 `api schema --json`, protocol 22: tokens are string|null,
// ttl_ms is supported on both metadata methods; null removes only that token.
function report(kind, id, value) {
  return {
    method: `${kind}.report_metadata`,
    params: {
      [`${kind}_id`]: id,
      source,
      tokens: { ultra_activity: value },
      ttl_ms: ttl,
    },
  };
}

function reportKey({ method, params }) {
  return `${method}:${params.pane_id ?? params.workspace_id}`;
}

function clearReport({ method, params }) {
  return { method, params: { ...params, tokens: { ultra_activity: null } } };
}

// Pure seam: a native session snapshot and a nonnegative integer frame index.
// Provider identity, display labels and aggregate workspace status are not state.
export function activityPlan(snapshot, frameIndex = 0) {
  const working = snapshot.agents.filter((agent) => agent.agent_status === "working");
  const panes = new Set(working.map((agent) => agent.pane_id));
  const workspaces = new Set(working.map((agent) => agent.workspace_id));
  const reports = [];
  const frame = frames[frameIndex % frames.length];
  for (const [kind, items, active] of [
    ["pane", snapshot.panes, panes],
    ["workspace", snapshot.workspaces, workspaces],
  ]) {
    for (const item of items) {
      const id = item[`${kind}_id`];
      if (active.has(id)) reports.push(report(kind, id, frame));
      else if (item.tokens?.ultra_activity) reports.push(report(kind, id, null));
    }
  }
  return { intervalMs: working.length ? workingInterval : idleInterval, reports };
}

// Native startup supplies HERDR_SOCKET_PATH; never guess a default session.
// Returns an idempotent async cleanup. onError receives Error and must not throw.
export function startActivity({
  socketPath = process.env.HERDR_SOCKET_PATH,
  onError = console.error,
} = {}) {
  if (typeof socketPath !== "string" || !socketPath.trim()) {
    throw new Error("HERDR_SOCKET_PATH is required for local activity");
  }
  // Auto Title docs/architecture/herdr-socket-api.md: on Windows the env
  // path names an identity file; the actual local pipe prefixes that full path.
  const path = process.platform === "win32" && !socketPath.startsWith("\\\\.\\pipe\\")
    ? `\\\\.\\pipe\\${socketPath}` : socketPath;
  const tracked = new Map();
  let requestId = 0;
  let frameIndex = 0;
  let stopped = false;
  let timer;
  let stopping;

  function request(method, params, deadline) {
    const remaining = Math.min(requestTimeout, deadline - Date.now());
    if (remaining <= 0) return Promise.reject(new Error("Activity tick deadline exceeded"));
    return new Promise((resolve, reject) => {
      const id = `ultra-activity-${++requestId}`;
      // One NDJSON request per connection: Herdr closes after its reply.
      const socket = createConnection({ path });
      let response = "";
      let bytes = 0;
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.destroy();
        if (error) reject(error);
        else resolve(result);
      };
      // Absolute, not socket inactivity: a trickling peer cannot extend a call.
      const timeout = setTimeout(() => finish(new Error(`${method} timed out`)), remaining);
      socket.setEncoding("utf8");
      socket.once("connect", () => socket.write(`${JSON.stringify({ id, method, params })}\n`));
      socket.on("error", (error) => finish(error));
      socket.once("close", () => finish(new Error(`${method}: incomplete response`)));
      socket.on("data", (chunk) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > maxResponseBytes) {
          finish(new Error(`${method}: response exceeds ${maxResponseBytes} bytes`));
          return;
        }
        response += chunk;
        const newline = response.indexOf("\n");
        if (newline < 0) return;
        try {
          const reply = JSON.parse(response.slice(0, newline));
          if (!reply || reply.id !== id) throw new Error(`${method}: mismatched response id`);
          if (reply.error) {
            const error = new Error(`${method}: ${reply.error.message}`);
            error.code = reply.error.code;
            throw error;
          }
          if (!Object.hasOwn(reply, "result")) throw new Error(`${method}: missing result`);
          finish(null, reply.result);
        } catch (error) {
          finish(error);
        }
      });
    });
  }

  async function publish(reports, deadline, clearing = false) {
    for (const item of reports) {
      if (stopped && !clearing) break;
      if (Date.now() >= deadline) {
        onError(new Error("Activity tick deadline exceeded"));
        break;
      }
      const key = reportKey(item);
      const removing = item.params.tokens.ultra_activity === null;
      // An unanswered write may still be applied. Include it in stop cleanup.
      if (!removing) tracked.set(key, item);
      try {
        await request(item.method, item.params, deadline);
      } catch (error) {
        if (error.code !== "pane_not_found" && error.code !== "workspace_not_found") onError(error);
      } finally {
        // A failed clear still has the original report's TTL as its safety net.
        if (removing) tracked.delete(key);
      }
    }
  }

  async function tick() {
    const started = Date.now();
    const deadline = started + tickTimeout;
    let intervalMs = idleInterval;
    try {
      const result = await request("session.snapshot", {}, deadline);
      if (stopped) return;
      const snapshot = result?.snapshot;
      if (!snapshot || !["agents", "panes", "workspaces"].every((key) => Array.isArray(snapshot[key]))) {
        throw new Error("Activity snapshot is missing agents, panes or workspaces");
      }
      const plan = activityPlan(snapshot, frameIndex);
      intervalMs = plan.intervalMs;
      frameIndex = (frameIndex + 1) % frames.length;
      const reports = new Map(plan.reports.map((item) => [reportKey(item), item]));
      for (const [key, item] of tracked) {
        if (!reports.has(key)) reports.set(key, clearReport(item));
      }
      // Clears precede animation so a busy session cannot delay a known exit.
      const ordered = [...reports.values()].sort((a, b) =>
        Number(a.params.tokens.ultra_activity !== null) - Number(b.params.tokens.ultra_activity !== null));
      await publish(ordered, deadline);
    } catch (error) {
      onError(error);
    } finally {
      if (!stopped) {
        timer = setTimeout(() => { running = tick(); }, Math.max(0, intervalMs - (Date.now() - started)));
      }
    }
  }

  let running = tick();
  return function stopActivity() {
    if (stopping) return stopping;
    stopped = true;
    clearTimeout(timer);
    stopping = (async () => {
      // Drain the bounded in-flight tick before clearing; never race a new frame.
      await running;
      await publish([...tracked.values()].map(clearReport), Date.now() + tickTimeout, true);
    })();
    return stopping;
  };
}
