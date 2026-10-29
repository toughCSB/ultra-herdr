// Record real lifecycle transitions, never output volume or selection changes.
const source = "local.ultra-herdr.sessions";
export function createSessionTracker({ request, now = Date.now, onError = () => {} }) {
  const observed = new Map();
  let nextTick = 0;
  return {
    async update(snapshot, deadline) {
      const time = now();
      if (time < nextTick) return;
      nextTick = time + 1000;
      const live = new Set(snapshot.agents.map(a => a.pane_id));
      for (const id of observed.keys()) if (!live.has(id)) observed.delete(id);
      for (const agent of snapshot.agents) {
        const previous = observed.get(agent.pane_id);
        const changed = previous?.seq !== agent.state_change_seq || previous?.status !== agent.agent_status;
        if (changed && (agent.agent_status === "working" || previous?.status === "working")) {
          try {
            await request("pane.report_metadata", { pane_id: agent.pane_id, source,
              tokens: { ultra_last_work_ms: String(time) } }, deadline);
          } catch (error) { onError(error); continue; }
        }
        observed.set(agent.pane_id, { seq: agent.state_change_seq, status: agent.agent_status });
      }
    },
  };
}
