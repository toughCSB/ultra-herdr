import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { activityPlan, startActivity } from "./activity.mjs";

const source = "local.ultra-herdr.activity";
const working = () => ({
  agents: [{ pane_id: "w1:p1", workspace_id: "w1", agent: "codex", agent_status: "working" }],
  panes: [{ pane_id: "w1:p1", workspace_id: "w1", tokens: { other: "keep" } }],
  workspaces: [{ workspace_id: "w1", agent_status: "blocked", tokens: { provider: "keep" } }],
});
const expectedReport = (kind, id, value) => ({
  method: `${kind}.report_metadata`,
  params: { [`${kind}_id`]: id, source, tokens: { ultra_activity: value }, ttl_ms: 2_000 },
});
const waitFor = (emitter, event) => once(emitter, event, { signal: AbortSignal.timeout(3_000) });

async function fixture(t) {
  const connect = t.mock.method(Socket.prototype, "connect");
  const directory = mkdtempSync(join(tmpdir(), "ua-"));
  const path = process.platform === "win32"
    ? `\\\\.\\pipe\\ultra-activity-test-${randomUUID()}` : join(directory, "herdr.sock");
  const server = createServer();
  const events = new EventEmitter();
  const sockets = new Set();
  const requests = [];
  const stops = [];
  const errors = [];
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    // Oversize-response tests intentionally let the client close mid-write.
    socket.on("error", (error) => {
      if (error.code !== "EPIPE" && error.code !== "ECONNRESET") events.emit("error", error);
    });
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const request = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
      const entry = { request, socket };
      requests.push(request);
      events.emit("request", entry);
    });
  });
  t.after(async () => {
    t.mock.timers.reset();
    const stopping = stops.map((stop) => stop());
    const closed = waitFor(server, "close");
    server.close();
    for (const socket of sockets) socket.destroy();
    await Promise.all([...stopping, closed]);
    rmSync(directory, { recursive: true, force: true });
  });
  const listening = waitFor(server, "listening");
  server.listen(path);
  await listening;
  return {
    path, events, requests, errors,
    connections: () => connect.mock.callCount(),
    next: async () => (await waitFor(events, "request"))[0],
    error: async () => (await waitFor(events, "reported"))[0],
    start(options = {}) {
      const stop = startActivity({
        socketPath: path,
        onError(error) { errors.push(error); events.emit("reported", error); },
        ...options,
      });
      stops.push(stop);
      return stop;
    },
    reply({ request, socket }, result = {}) {
      socket.end(`${JSON.stringify({ id: request.id, result })}\n`);
    },
    snapshot(entry, snapshot) {
      this.reply(entry, { type: "session_snapshot", snapshot });
    },
  };
}

function clock(t) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const events = new EventEmitter();
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    events.emit(`scheduled:${delay}`);
    return timer;
  });
  return {
    tick: (milliseconds) => t.mock.timers.tick(milliseconds),
    scheduled: (milliseconds) => waitFor(events, `scheduled:${milliseconds}`),
  };
}

function assertRequest(entry, expected) {
  assert.equal(typeof entry.request.id, "string");
  const { id, ...request } = entry.request;
  assert.deepEqual(request, expected);
}

test("only actual working agents animate, independently of provider and display metadata", () => {
  const snapshot = working();
  snapshot.agents.push(
    { pane_id: "w1:p2", workspace_id: "w1", agent: "pi", agent_status: "working" },
    ...["idle", "done", "blocked", "unknown", "Working", "working task"].map((status, index) => ({
      pane_id: `p${index}`, workspace_id: "w2", agent_status: status, state_labels: { [status]: "Working" },
    })),
  );
  snapshot.panes.push(
    { pane_id: "w1:p2" },
    ...snapshot.agents.slice(2).map((agent) => ({
      pane_id: agent.pane_id, tokens: { ultra_activity: "stale", skyline_provider: "keep" },
    })),
    { pane_id: "shell", agent_status: "working", tokens: {} },
  );
  snapshot.workspaces.push({ workspace_id: "w2", agent_status: "working", tokens: { ultra_activity: "stale" } });
  const before = structuredClone(snapshot);
  const plan = activityPlan(snapshot);
  assert.equal(plan.intervalMs, 225);
  assert.deepEqual(plan.reports, [
    expectedReport("pane", "w1:p1", "\u280b"),
    expectedReport("pane", "w1:p2", "\u280b"),
    ...snapshot.agents.slice(2).map((agent) => expectedReport("pane", agent.pane_id, null)),
    expectedReport("workspace", "w1", "\u280b"),
    expectedReport("workspace", "w2", null),
  ]);
  assert.deepEqual(snapshot, before);
});

test("frames are deterministic single-cell braille and refresh TTL through a full cycle", () => {
  const snapshot = working();
  const frames = Array.from({ length: 10 }, (_, index) => activityPlan(snapshot, index).reports[0].params.tokens.ultra_activity);
  assert.equal(new Set(frames).size, 10);
  for (const frame of frames) {
    assert.equal([...frame].length, 1);
    assert.match(frame, /^[\u2800-\u28ff]$/);
  }
  assert.deepEqual(activityPlan(snapshot, 10), activityPlan(snapshot, 0));
  snapshot.panes[0].tokens.ultra_activity = frames[0];
  assert.equal(activityPlan(snapshot, 0).reports[0].params.ttl_ms, 2_000);
  assert.equal(activityPlan(snapshot, 0).reports[0].params.tokens.ultra_activity, frames[0]);
});

test("idle snapshots clear leftover activity without changing native icons or other tokens", () => {
  const snapshot = working();
  snapshot.agents = [];
  snapshot.panes[0].tokens.ultra_activity = "old";
  snapshot.workspaces[0].tokens.ultra_activity = "old";
  assert.deepEqual(activityPlan(snapshot), {
    intervalMs: 1_000,
    reports: [expectedReport("pane", "w1:p1", null), expectedReport("workspace", "w1", null)],
  });
  delete snapshot.panes[0].tokens.ultra_activity;
  delete snapshot.workspaces[0].tokens.ultra_activity;
  assert.deepEqual(activityPlan(snapshot), { intervalMs: 1_000, reports: [] });
});

test("missing native socket path fails without guessing a session", () => {
  assert.throws(() => startActivity({ socketPath: "" }), /HERDR_SOCKET_PATH/);
  assert.throws(() => startActivity({ socketPath: "  " }), /HERDR_SOCKET_PATH/);
  assert.throws(() => startActivity({ socketPath: null }), /HERDR_SOCKET_PATH/);
});

test("real IPC animates at 225 ms, clears transitions, then polls idle at 1 s", { timeout: 5_000 }, async (t) => {
  const peer = await fixture(t);
  const time = clock(t);
  const first = peer.next();
  const stop = peer.start();
  let entry = await first;
  assertRequest(entry, { method: "session.snapshot", params: {} });
  for (let frame = 0; frame < 2; frame++) {
    const pane = peer.next();
    peer.snapshot(entry, working());
    const paneEntry = await pane;
    assertRequest(paneEntry, expectedReport("pane", "w1:p1", frame ? "\u2819" : "\u280b"));
    const workspace = peer.next();
    peer.reply(paneEntry);
    const workspaceEntry = await workspace;
    assertRequest(workspaceEntry, expectedReport("workspace", "w1", frame ? "\u2819" : "\u280b"));
    const scheduled = time.scheduled(225);
    peer.reply(workspaceEntry);
    await scheduled;
    const next = peer.next();
    const count = peer.connections();
    time.tick(224);
    assert.equal(peer.connections(), count);
    time.tick(1);
    entry = await next;
    assertRequest(entry, { method: "session.snapshot", params: {} });
  }
  const done = working();
  done.agents[0].agent_status = "done";
  // These tokens can be absent even after a sent report (expiry or lost reply).
  const paneClear = peer.next();
  peer.snapshot(entry, done);
  const paneEntry = await paneClear;
  assertRequest(paneEntry, expectedReport("pane", "w1:p1", null));
  const workspaceClear = peer.next();
  peer.reply(paneEntry);
  const workspaceEntry = await workspaceClear;
  assertRequest(workspaceEntry, expectedReport("workspace", "w1", null));
  const idleScheduled = time.scheduled(1_000);
  peer.reply(workspaceEntry);
  await idleScheduled;
  const idle = peer.next();
  const count = peer.connections();
  time.tick(999);
  assert.equal(peer.connections(), count);
  time.tick(1);
  const idleEntry = await idle;
  const stopped = stop();
  peer.snapshot(idleEntry, working());
  await stopped;
  assert.equal(stop(), stopped);
  time.tick(10_000);
  assert.equal(peer.connections(), count + 1);
  assert.deepEqual(peer.errors, []);
  assert.equal(new Set(peer.requests.map((request) => request.id)).size, peer.requests.length);
});

test("stop drains the in-flight report, clears even failed writes, and is idempotent", { timeout: 5_000 }, async (t) => {
  const peer = await fixture(t);
  clock(t);
  const first = peer.next();
  const stop = peer.start();
  const snapshot = await first;
  const pane = peer.next();
  peer.snapshot(snapshot, working());
  const paneEntry = await pane;
  const failure = peer.error();
  const workspace = peer.next();
  paneEntry.socket.end(`${JSON.stringify({ id: paneEntry.request.id, error: { code: "rejected", message: "test rejection" } })}\n`);
  assert.equal((await failure).code, "rejected");
  const workspaceEntry = await workspace;
  const paneClear = peer.next();
  const stopped = stop();
  assert.equal(stop(), stopped);
  assert.equal(peer.requests.length, 3);
  peer.reply(workspaceEntry);
  const paneClearEntry = await paneClear;
  assertRequest(paneClearEntry, expectedReport("pane", "w1:p1", null));
  const workspaceClear = peer.next();
  peer.reply(paneClearEntry);
  const workspaceClearEntry = await workspaceClear;
  assertRequest(workspaceClearEntry, expectedReport("workspace", "w1", null));
  peer.reply(workspaceClearEntry);
  await stopped;
  assert.equal(peer.errors.length, 1);
});

test("a slow snapshot cannot overlap ticks or extend the absolute socket deadline", { timeout: 5_000 }, async (t) => {
  const peer = await fixture(t);
  const time = clock(t);
  const first = peer.next();
  const stop = peer.start();
  const entry = await first;
  const failure = peer.error();
  const closed = waitFor(entry.socket, "close");
  const scheduled = time.scheduled(250);
  time.tick(225);
  assert.equal(peer.connections(), 1);
  await new Promise((resolve, reject) => entry.socket.write("{", (error) => error ? reject(error) : resolve()));
  time.tick(524);
  assert.equal(peer.errors.length, 0);
  assert.equal(peer.connections(), 1);
  time.tick(1);
  assert.match((await failure).message, /session\.snapshot timed out/);
  await Promise.all([closed, scheduled]);
  await stop();
  time.tick(10_000);
  assert.equal(peer.connections(), 1);
});

test("stop and its clear operations remain bounded when the server never answers", { timeout: 5_000 }, async (t) => {
  const peer = await fixture(t);
  const time = clock(t);
  const first = peer.next();
  const stop = peer.start();
  const snapshot = await first;
  const pane = peer.next();
  peer.snapshot(snapshot, working());
  const paneEntry = await pane;
  const closed = waitFor(paneEntry.socket, "close");
  const failure = peer.error();
  const clear = peer.next();
  const stopped = stop();
  time.tick(750);
  assert.match((await failure).message, /pane\.report_metadata timed out/);
  const clearEntry = await clear;
  assertRequest(clearEntry, expectedReport("pane", "w1:p1", null));
  const clearClosed = waitFor(clearEntry.socket, "close");
  const clearFailure = peer.error();
  time.tick(750);
  assert.match((await clearFailure).message, /pane\.report_metadata timed out/);
  await Promise.all([stopped, closed, clearClosed]);
  assert.equal(peer.requests.length, 3);
  assert.equal(Date.now(), 1_500);
});

for (const [name, respond, expected] of [
  ["malformed JSON", ({ socket }) => socket.end("not-json\n"), /JSON|Unexpected/],
  ["uncorrelated reply", ({ socket }) => socket.end('{"id":"wrong","result":{}}\n'), /mismatched response id/],
  ["missing result", ({ socket, request }) => socket.end(`${JSON.stringify({ id: request.id })}\n`), /missing result/],
  ["early EOF", ({ socket }) => socket.end('{"id":'), /incomplete response/],
  ["invalid snapshot", (entry, peer) => peer.reply(entry, { snapshot: {} }), /missing agents, panes or workspaces/],
  ["oversize reply", ({ socket }) => socket.end("x".repeat(8 * 1024 * 1024 + 1)), /response exceeds/],
]) {
  test(`${name} reports an error without publishing metadata`, { timeout: 5_000 }, async (t) => {
    const peer = await fixture(t);
    const time = clock(t);
    const first = peer.next();
    const stop = peer.start();
    const entry = await first;
    const failure = peer.error();
    const scheduled = time.scheduled(1_000);
    respond(entry, peer);
    assert.match((await failure).message, expected);
    await scheduled;
    await stop();
    assert.equal(peer.requests.length, 1);
  });
}

test("native environment path is used and failed connections stop cleanly", { timeout: 5_000 }, async (t) => {
  const peer = await fixture(t);
  const time = clock(t);
  const previous = process.env.HERDR_SOCKET_PATH;
  const first = peer.next();
  let stop;
  try {
    process.env.HERDR_SOCKET_PATH = peer.path;
    stop = peer.start({ socketPath: undefined });
  } finally {
    if (previous === undefined) delete process.env.HERDR_SOCKET_PATH;
    else process.env.HERDR_SOCKET_PATH = previous;
  }
  const entry = await first;
  const idle = time.scheduled(1_000);
  peer.snapshot(entry, { agents: [], panes: [], workspaces: [] });
  await idle;
  await stop();
  const failure = peer.error();
  const scheduled = time.scheduled(1_000);
  const missing = peer.start({ socketPath: `${peer.path}-missing` });
  assert.ok(["ENOENT", "ECONNREFUSED"].includes((await failure).code));
  await scheduled;
  await missing();
});
