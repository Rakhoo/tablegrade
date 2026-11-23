/**
 * WebSocket to the server (protocol.md 7): pings every 30 seconds and reconnects with backoff
 * from 1 to 60 seconds. Messages only tell the client to act; data comes by pull.
 */

/** Messages from the server. */
export type SocketMessage =
  | { type: "hello"; latestSeq: number }
  | { type: "changed"; latestSeq: number; deviceId: string }
  | { type: "revoked" }
  | { type: "link"; linkId: string };

/** The part of `WebSocket` the client uses; tests pass a fake. */
export type SocketLike = Pick<
  WebSocket,
  "onopen" | "onmessage" | "onclose" | "send" | "close"
>;

/** Ping interval of the client. */
const PING_INTERVAL = 30_000;
/** First wait before reconnecting. */
const BACKOFF_MIN = 1_000;
/** Longest wait before reconnecting. */
const BACKOFF_MAX = 60_000;

/** Parses a server message; unknown or broken messages give `null`. */
function parse(data: unknown): SocketMessage | null {
  if (typeof data != "string") return null;
  try {
    const message = JSON.parse(data) as { type?: unknown };
    return typeof message.type == "string" ? (message as SocketMessage) : null;
  } catch {
    return null;
  }
}

/**
 * Keeps a socket open to `url()` until the returned function is called. `url` gives `null`
 * while there is no session; then no connection is tried until the next backoff step.
 */
export function openSocket(
  url: () => string | null,
  onMessage: (message: SocketMessage) => void,
  create: (url: string) => SocketLike = (target) => new WebSocket(target),
): () => void {
  let socket: SocketLike | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let backoff = BACKOFF_MIN;
  let stopped = false;

  /** Waits, then connects again; the wait doubles up to the maximum. */
  const reconnect = () => {
    clearInterval(ping);
    socket = null;
    if (stopped) return;
    retry = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, BACKOFF_MAX);
  };

  /** Opens the socket and wires its events. */
  function connect() {
    const target = url();
    if (!target) return reconnect();
    const current = create(target);
    socket = current;
    current.onopen = () => {
      backoff = BACKOFF_MIN;
      ping = setInterval(
        () => current.send(JSON.stringify({ type: "ping" })),
        PING_INTERVAL,
      );
    };
    current.onmessage = (event) => {
      const message = parse(event.data);
      if (message) onMessage(message);
    };
    current.onclose = reconnect;
  }

  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(ping);
    if (socket) socket.onclose = null;
    socket?.close();
  };
}
