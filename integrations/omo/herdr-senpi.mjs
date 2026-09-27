// Adapted from Senpi; see ../../third-party/SENPI_LICENSE.
import { readdirSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { debuglog } from "node:util";
const builtins = new URL("../core/extensions/builtin/", pathToFileURL(process.argv[1]));
const { isTerminalMonitorStateEvent, isWakeSourceStateEvent, TERMINAL_MONITOR_STATE_EVENT, WAKE_SOURCE_STATE_EVENT } = await import(new URL("monitor-state-event.js", builtins).href);
const { HerdrClient } = await import(new URL("herdr/herdr-client.js", builtins).href);
const { initialHerdrState, isHerdrBlockedEvent, reduceHerdrState, selectHerdrReport } = await import(new URL("herdr/herdr-state.js", builtins).href);
export default function herdrExtension(pi) {
    createHerdrExtension({
        now: Date.now,
        connect: createConnection,
    })(pi);
}
/** Read host-owned discovery state only after all extensions have loaded. */
export function createHerdrExtension(deps) {
    return (pi) => {
        const debug = deps.debug ?? debuglog("senpi:herdr");
        let client;
        let bound;
        let state = initialHerdrState();
        let stopped = false;
        let lastReport;
        let title;
        let poll;
        const subscriptions = [];
        const pending = new Set();
        const owns = (ctx) => !stopped && bound === ctx.sessionManager;
        const sessionRef = () => {
            const path = bound?.getSessionFile();
            return path ? { agent_session_path: path } : { agent_session_id: bound?.getSessionId() };
        };
        function send(method, params) {
            if (!client)
                return Promise.resolve(false);
            const work = client.send(method, params).then(() => true, (error) => {
                debug(error instanceof Error ? error.message : "Herdr transport failed");
                return false;
            });
            pending.add(work);
            void work.then(() => pending.delete(work));
            return work;
        }
        async function publish() {
            if (!bound || stopped)
                return;
            const report = selectHerdrReport(state);
            const key = JSON.stringify(report);
            if (lastReport === key)
                return;
            lastReport = key;
            if (!(await send("pane.report_agent", { agent: "omo", ...report, ...sessionRef() })) && lastReport === key) {
                lastReport = undefined;
            }
        }
        async function reportTitle(ctx) {
            const next = ctx.sessionManager.getSessionName() ?? "";
            if (title === next)
                return;
            title = next;
            if (!(await send("pane.report_metadata", { title: next, display_agent: next })) && title === next)
                title = undefined;
        }
        function refreshChildren(ctx) {
            state = reduceHerdrState(state, { type: "children", count: countRunningChildTasks(ctx, debug) });
        }
        pi.on("session_start", async (_event, ctx) => {
            if (stopped || bound || ctx.mode !== "tui")
                return;
            const socketPath = process.env.HERDR_SOCKET_PATH;
            const paneId = process.env.HERDR_PANE_ID;
            if (process.env.HERDR_ENV !== "1" || !socketPath || !paneId)
                return;
            bound = ctx.sessionManager;
            client = new HerdrClient(socketPath, paneId, deps);
            state = reduceHerdrState(state, { type: "turn", active: !ctx.isIdle() });
            refreshChildren(ctx);
            subscriptions.push(pi.events.on("herdr:blocked", (data) => {
                if (stopped || !isHerdrBlockedEvent(data))
                    return;
                state = reduceHerdrState(state, { type: "blocked", ...data });
                return publish();
            }));
            subscriptions.push(pi.events.on(TERMINAL_MONITOR_STATE_EVENT, (data) => {
                if (stopped || !isTerminalMonitorStateEvent(data))
                    return;
                state = reduceHerdrState(state, { type: "monitors", count: data.activeCount });
                return publish();
            }));
            subscriptions.push(pi.events.on(WAKE_SOURCE_STATE_EVENT, (data) => {
                if (stopped || !isWakeSourceStateEvent(data))
                    return;
                state = reduceHerdrState(state, { type: "wake-source", source: data.source, count: data.activeCount });
                return publish();
            }));
            poll = setInterval(() => {
                refreshChildren(ctx);
                void publish();
            }, 4000);
            poll.unref();
            await Promise.all([
                reportTitle(ctx),
                send("pane.report_agent_session", { agent: "omo", ...sessionRef(), session_start_source: _event.reason }),
                publish(),
            ]);
        });
        pi.on("session_info_changed", (_event, ctx) => {
            if (owns(ctx))
                return reportTitle(ctx);
        });
        pi.on("agent_start", (_event, ctx) => {
            if (!owns(ctx))
                return;
            state = reduceHerdrState(state, { type: "turn", active: true });
            return publish();
        });
        pi.on("agent_settled", (_event, ctx) => {
            if (!owns(ctx))
                return;
            state = reduceHerdrState(state, { type: "turn", active: !ctx.isIdle() });
            refreshChildren(ctx);
            return publish();
        });
        pi.on("session_shutdown", async (event, ctx) => {
            if (!owns(ctx))
                return;
            stopped = true;
            if (poll)
                clearInterval(poll);
            for (const unsubscribe of subscriptions)
                unsubscribe();
            // Drain before the host builds the successor runtime, or releases the pane.
            await Promise.all(pending);
            if (event.reason === "quit")
                await send("pane.release_agent", { agent: "omo" });
        });
    };
}
function countRunningChildTasks(ctx, debug) {
    const directory = join(ctx.cwd, ".omo", "senpi-task", "tasks");
    let entries;
    try {
        entries = readdirSync(directory);
    }
    catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
            debug("Herdr child-task directory unavailable");
        return 0;
    }
    let count = 0;
    for (const file of entries) {
        if (!file.endsWith(".json"))
            continue;
        try {
            const record = JSON.parse(readFileSync(join(directory, file), "utf8"));
            if (typeof record !== "object" ||
                record === null ||
                !("status" in record) ||
                (record.status !== "running" && record.status !== "pending"))
                continue;
            const sessionId = ctx.sessionManager.getSessionId();
            if (("root_session_id" in record && record.root_session_id === sessionId) ||
                ("parent_session_id" in record && record.parent_session_id === sessionId))
                count++;
        }
        catch {
            // Task records are an external, concurrently-written boundary. Retry on the next poll.
            debug("Herdr ignored an unreadable or partial child-task record");
        }
    }
    return count;
}
