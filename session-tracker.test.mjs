import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionTracker } from "./session-tracker.mjs";

test("output and idle polls do not refresh recency; finishing real work does", async () => {
  const requests = []; let current = 1000;
  const tracker = createSessionTracker({ request: async (method, params) => { requests.push({ method, params }); return {}; }, now: () => current });
  const agent = { pane_id: "p1", agent: "claude", agent_status: "idle", state_change_seq: 1, tokens: {} };
  const snap = { panes: [], agents: [agent] };
  await tracker.update(snap, Infinity);
  current += 1100; agent.revision = 20; await tracker.update(snap, Infinity);
  assert.equal(requests.length, 0);
  current += 1100; agent.agent_status = "working"; agent.state_change_seq++; await tracker.update(snap, Infinity);
  current += 1100; agent.agent_status = "idle"; agent.state_change_seq++; await tracker.update(snap, Infinity);
  assert.deepEqual(requests.map(r => r.params.tokens.ultra_last_work_ms), ["3200", "4300"]);
});
