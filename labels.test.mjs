import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { controlPath, projectGroups, syncLabels as publishLabels } from "./labels.mjs";

const syncLabels = (options) => publishLabels({
  localMachineLabel: "Local", ...options,
});

test("Windows named pipe is stable per state directory and does not use socket files", () => {
  assert.match(controlPath("win32", "C:\\Users\\SV\\state"), /^\\\\\.\\pipe\\ultra-herdr-[a-f0-9]{24}$/);
  assert.equal(controlPath("win32", "C:\\Users\\SV\\state"), controlPath("win32", "c:\\users\\sv\\state"));
  assert.notEqual(controlPath("win32", "C:\\Users\\SV\\state"), controlPath("win32", "C:\\Users\\Other\\state"));
  assert.equal(controlPath("darwin", "/tmp/skyline"), "/tmp/skyline/labels.sock");
});

test("Windows syncs its SV badge locally without remote machine writes", async () => {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    if (args[0] !== "api") throw new Error("Windows must not manage remote metadata");
    return JSON.stringify({ result: { snapshot: {
      panes: [{ pane_id: "p1", tokens: { skyline_machine: "[SV]" } }],
      agents: [], workspaces: [],
    } } });
  };
  assert.deepEqual(await syncLabels({ run, platform: "win32", localMachineLabel: "SV" }), { updated: 0, failures: [] });
  assert.deepEqual(calls, [["api", "snapshot"]]);
  assert.equal((await syncLabels({ run: async (args) => args[0] === "api"
    ? JSON.stringify({ result: { snapshot: { panes: [{ pane_id: "p1", tokens: {} }], workspaces: [] } } })
    : "", platform: "win32", localMachineLabel: "Custom" })).updated, 1);
});

const exec = promisify(execFile);
const script = fileURLToPath(new URL("./labels.mjs", import.meta.url));

test("sync touches only local panes and preserves unrelated metadata", async () => {
  const calls = [];
  const responses = new Map([
    ["api snapshot", JSON.stringify({ result: { snapshot: { panes: [
      { pane_id: "w1:p1", tokens: { other: "keep" } },
      { pane_id: "w1:p2", tokens: { skyline_machine: "[Local]", other: "keep" } },
    ] } } })],
  ]);
  const run = async (args) => {
    calls.push(args);
    return responses.get(args.join(" ")) ?? "";
  };
  const result = await syncLabels({ run });
  assert.deepEqual(result, { updated: 1, failures: [] });
  assert.deepEqual(calls.filter((args) => args.includes("report-metadata")), [
    ["pane", "report-metadata", "w1:p1", "--source", "local.ultra-herdr", "--token", "skyline_machine=[Local]"],
  ]);
  assert.ok(calls.every((args) => !args.includes("--machine") && args[0] !== "machine"));
});

test("rename writes once, then a matching snapshot does nothing", async () => {
  let label = "New Name";
  let token = "[Old Name]";
  const writes = [];
  const run = async (args) => {
    if (args.includes("report-metadata")) {
      writes.push(args);
      token = args.at(-1).slice("skyline_machine=".length);
      return "";
    }
    if (args[0] === "api") {
      return JSON.stringify({ result: { snapshot: { panes: [{ pane_id: "p1", tokens: { skyline_machine: token } }] } } });
    }
    return JSON.stringify({ result: { snapshot: { panes: [] } } });
  };
  assert.equal((await syncLabels({ run, localMachineLabel: label })).updated, 1);
  assert.equal((await syncLabels({ run, localMachineLabel: label })).updated, 0);
  assert.equal(writes.length, 1);
  assert.equal(token, "[New Name]");
});

test("one local pane failure does not prevent another local pane from syncing", async () => {
  const failures = [];
  const writes = [];
  const run = async (args) => {
    if (args.includes("report-metadata")) {
      if (args[2] === "p1") throw new Error("rejected metadata");
      writes.push(args);
      return "";
    }
    return JSON.stringify({ result: { snapshot: { panes: [{ pane_id: "p1", tokens: {} }, { pane_id: "p2", tokens: {} }] } } });
  };
  const result = await syncLabels({ run, onError: (message) => failures.push(message) });
  assert.equal(result.updated, 1);
  assert.deepEqual(result.failures, ["local pane p1"]);
  assert.match(failures[0], /rejected metadata/);
  assert.equal(writes.length, 1);
});

test("provider changes and exit update only owned tokens without repeating unchanged writes", async () => {
  const pane = { pane_id: "w1:p1", tokens: { skyline_machine: "[Local]", other: "keep" } };
  let agents = [{ pane_id: pane.pane_id, agent: "pi" }];
  const writes = [];
  const run = async (args) => {
    if (args[0] === "machine") return "[]";
    if (args[0] === "api") return JSON.stringify({ result: { snapshot: { panes: [pane], agents } } });
    writes.push(args);
    const index = args.indexOf("--token");
    if (index >= 0) pane.tokens.skyline_provider = args[index + 1].slice("skyline_provider=".length);
    if (args.includes("--clear-token")) delete pane.tokens.skyline_provider;
    return "";
  };
  assert.equal((await syncLabels({ run })).updated, 1);
  assert.equal(pane.tokens.skyline_provider, "\ue1a9 Pi");
  assert.equal((await syncLabels({ run })).updated, 0);
  agents = [{ pane_id: pane.pane_id, agent: "codex" }];
  assert.equal((await syncLabels({ run })).updated, 1);
  assert.equal(pane.tokens.skyline_provider, "\ue1a1 Codex");
  agents = [];
  assert.equal((await syncLabels({ run })).updated, 1);
  assert.equal(pane.tokens.skyline_provider, undefined);
  assert.equal(pane.tokens.other, "keep");
  assert.ok(writes.every(args => !args.some(value => value.startsWith("skyline_machine="))));
});

test("sessions share one project heading and the next session inherits it after closing", () => {
  const snapshot = {
    workspaces: [{ workspace_id: "w1", label: "Project" }, { workspace_id: "w2", label: "Project" }],
    agents: [
      { pane_id: "w1:p1", workspace_id: "w1" },
      { pane_id: "w1:p2", workspace_id: "w1" },
      { pane_id: "w2:p1", workspace_id: "w2" },
    ],
  };
  const groups = projectGroups(snapshot, "SV");
  assert.deepEqual(groups.get("w1:p1"), { skyline_group_machine: "[SV]", skyline_group: "Project", skyline_branch: "├─", skyline_separator: "┄  ┄  ┄  ┄  ┄  ┄" });
  assert.deepEqual(groups.get("w1:p2"), { skyline_group_machine: "", skyline_group: "", skyline_branch: "└─", skyline_separator: "──────────────────────" });
  assert.equal(groups.get("w2:p1").skyline_group, "Project");
  snapshot.agents.shift();
  assert.equal(projectGroups(snapshot, "SV").get("w1:p2").skyline_group, "Project");
  assert.equal(projectGroups(snapshot, "Local").get("w1:p2").skyline_group_machine, "[Local]");
  assert.equal(projectGroups(snapshot, "SV").get("w1:p2").skyline_separator, "──────────────────────");
});

test("workspace dividers are published once without replacing unrelated metadata", async () => {
  const workspace = { workspace_id: "w1", tokens: { other: "keep" } };
  const writes = [];
  const run = async (args) => {
    if (args[0] === "machine") return "[]";
    if (args[0] === "api") return JSON.stringify({ result: { snapshot: { panes: [], agents: [], workspaces: [workspace] } } });
    writes.push(args);
    workspace.tokens.skyline_separator = args.at(-1).slice("skyline_separator=".length);
    return "";
  };
  assert.equal((await syncLabels({ run })).updated, 1);
  assert.equal((await syncLabels({ run })).updated, 0);
  assert.equal(writes[0][0], "workspace");
  assert.equal(workspace.tokens.other, "keep");
});

test("workspace provider tokens follow agent changes and clear stale brands", async () => {
  const workspace = { workspace_id: "w1", label: "Project", tokens: { other: "keep" } };
  let agents = [{ agent: "claude", workspace_id: "w1", pane_id: "p1" }, { agent: "pi", workspace_id: "w1", pane_id: "p2" }];
  const run = async (args) => {
    if (args[0] === "machine") return "[]";
    if (args[0] === "api") return JSON.stringify({ result: { snapshot: { panes: [], agents, workspaces: [workspace] } } });
    assert.equal(args[0], "workspace");
    for (let i = 5; i < args.length; i += 2) {
      const [key, value] = args[i + 1].split("=");
      if (args[i] === "--token") workspace.tokens[key] = value;
      else delete workspace.tokens[key];
    }
    return "";
  };
  assert.equal((await syncLabels({ run })).updated, 1);
  assert.equal(workspace.tokens.ultra_provider_1, "\ue1a0 Claude");
  assert.equal(workspace.tokens.ultra_provider_2, "\ue1a9 Pi");
  assert.equal((await syncLabels({ run })).updated, 0);
  agents = [];
  assert.equal((await syncLabels({ run })).updated, 1);
  assert.equal(workspace.tokens.ultra_provider_1, undefined);
  assert.equal(workspace.tokens.ultra_provider_2, undefined);
  assert.equal(workspace.tokens.other, "keep");
});
test("start is singleton and stop uses its control socket", async () => {
  const directory = mkdtempSync(join(tmpdir(), "skyline-"));
  const state = join(directory, "state");
  // The control protocol must work even if metadata sync fails. Never let this
  // lifecycle test invoke the user's real Herdr server on either OS.
  const environment = { ...process.env, HERDR_PLUGIN_STATE_DIR: state, HERDR_BIN_PATH: process.execPath };
  const cli = (command) => exec(process.execPath, [script, command], { env: environment, timeout: 5_000 });
  const status = () => new Promise((resolve, reject) => {
    const socket = createConnection(controlPath(process.platform, state));
    let response = "";
    socket.setTimeout(3_000, () => socket.destroy(new Error("Status response timed out")));
    socket.on("error", reject);
    socket.on("data", (chunk) => { response += chunk; });
    socket.on("end", () => resolve(response.trim()));
    socket.on("connect", () => socket.write("ultra-herdr-labels-v1 status\n"));
  });
  try {
    await cli("start");
    assert.equal(await status(), "ultra-herdr-labels-v1 ready");
    await cli("start");
    assert.equal(await status(), "ultra-herdr-labels-v1 ready");
    await cli("stop");
    await assert.rejects(status(), (error) => ["ENOENT", "ECONNREFUSED"].includes(error.code));
    await cli("stop");
  } finally {
    await cli("stop");
    rmSync(directory, { recursive: true, force: true });
  }
});
