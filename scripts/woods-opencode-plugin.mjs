// Woods Island bridge 2. Compatible with opencode 1.x and 2.
import { spawn } from "node:child_process";

const node = __WOODS_NODE__;
const bridge = __WOODS_BRIDGE__;
const dataDirectory = __WOODS_DATA_DIR__;
const previous = new Map();
const lastText = new Map();
function remember(session, text) {
  lastText.set(session, text.slice(0, 180));
  if (lastText.size > 512) lastText.delete(lastText.keys().next().value);
}

function send(event, session, cwd, message = "") {
  if (!session) return;
  if (event !== "permission.asked" && previous.get(session) === event) return;
  previous.set(session, event);
  try {
    const payload = { sessionID: session, directory: cwd || "", message };
    const child = spawn(
      node,
      [
        bridge,
        "--provider",
        "opencode",
        "--event",
        event,
        "--data-dir",
        dataDirectory,
        JSON.stringify(payload),
      ],
      { stdio: "ignore", windowsHide: true, detached: true },
    );
    child.on("error", () => {});
    child.unref();
  } catch {
    /* A notification must never break the agent session. */
  }
  if (event === "session.deleted") {
    previous.delete(session);
    lastText.delete(session);
  }
  if (previous.size > 512) {
    const oldest = previous.keys().next().value;
    previous.delete(oldest);
    lastText.delete(oldest);
  }
}

function take(type, data, cwd) {
  if (!data || typeof data !== "object") return;
  const session = data.sessionID || data.part?.sessionID || data.info?.id;
  switch (type) {
    case "session.status":
      if (data.status?.type === "busy")
        send("session.execution.started", session, cwd);
      else if (data.status?.type === "idle")
        send("session.idle", session, cwd, lastText.get(session));
      break;
    case "session.idle":
    case "session.execution.succeeded":
      send("session.idle", session, cwd, lastText.get(session));
      break;
    case "session.execution.started":
    case "permission.replied":
      send("session.execution.started", session, cwd);
      break;
    case "permission.asked": {
      const action = data.action || data.permission || data.type || "";
      const resources = []
        .concat(data.resources || data.patterns || data.pattern || [])
        .filter((value) => typeof value === "string")
        .join(", ");
      send(
        type,
        session,
        cwd,
        (typeof data.message === "string" && data.message) ||
          (resources ? `${action}: ${resources}` : action),
      );
      break;
    }
    case "session.error":
    case "session.execution.failed":
      send(
        "session.error",
        session,
        cwd,
        data.error?.message || data.error?.data?.message || "",
      );
      break;
    case "session.deleted":
      send(type, session, cwd);
      break;
    case "session.text.ended":
      if (session && typeof data.text === "string" && data.text.trim())
        remember(session, data.text);
      break;
    case "message.part.updated":
      if (
        session &&
        data.part?.type === "text" &&
        typeof data.part.text === "string" &&
        data.part.text.trim()
      )
        remember(session, data.part.text);
      break;
  }
}

export default {
  id: "woods-island",
  server: async (input) => ({
    event: async ({ event }) => {
      try {
        take(event.type, event.properties, input?.directory);
      } catch {}
    },
  }),
  setup: async (context) => {
    const controller = new AbortController();
    (async () => {
      try {
        for await (const event of context.event.subscribe({
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break;
          try {
            take(event.type, event.data, context.location?.directory);
          } catch {}
        }
      } catch {}
    })();
    return () => controller.abort();
  },
};
