import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "./api";
import {
  checkSession,
  SESSION_CHECK_INTERVAL,
  sessionStatus,
  startSessionMonitor,
} from "./session";

/** Fake `fetch` that records calls and answers with `response`. */
function fakeFetch(response: (url: string) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const doFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response(url);
  }) as typeof fetch;
  return { calls, doFetch };
}

/** JSON response with status. */
function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

const SESSION = {
  userId: "u",
  deviceId: "d",
  identities: [{ provider: "passkey", createdAt: 1 }],
  devices: [],
  approved: true,
  contactEmail: null,
  accessNote: null,
};

describe("api", () => {
  it("sends token, protocol header and JSON body", async () => {
    const { calls, doFetch } = fakeFetch(() =>
      json({ results: [{ id: "a", seq: 1, updatedAt: 2 }] }),
    );
    const api = createApi({
      baseUrl: "https://pi.test/",
      getToken: () => "tok",
      fetch: doFetch,
    });
    const results = await api.push([
      { id: "a", deleted: false, schema: 23, ciphertext: "x", blobs: [] },
    ]);
    expect(results).toEqual([{ id: "a", seq: 1, updatedAt: 2 }]);
    const { url, init } = calls[0];
    expect(url).toBe("https://pi.test/api/v1/records/push");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["X-Protocol-Version"]).toBe("1");
    expect(JSON.parse(init.body as string).records).toHaveLength(1);
  });

  it("omits the token while signed out and accepts empty answers", async () => {
    const { calls, doFetch } = fakeFetch(
      () => new Response(null, { status: 204 }),
    );
    const api = createApi({
      baseUrl: "https://pi.test",
      getToken: () => null,
      fetch: doFetch,
    });
    await api.deleteKey("k/1");
    expect(calls[0].url).toBe("https://pi.test/api/v1/keys/k%2F1");
    expect(calls[0].init.method).toBe("DELETE");
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("turns server errors into ApiError with the server message", async () => {
    const { doFetch } = fakeFetch(() =>
      json({ error: "rate_limited", message: "Langsam." }, 429, {
        "Retry-After": "30",
      }),
    );
    const api = createApi({
      baseUrl: "",
      getToken: () => null,
      fetch: doFetch,
    });
    const error = await api.session().catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "rate_limited",
      status: 429,
      message: "Langsam.",
      retryAfter: 30,
    });
  });

  it("uses German fallback messages", async () => {
    const { doFetch } = fakeFetch(() => new Response("oops", { status: 502 }));
    const api = createApi({
      baseUrl: "",
      getToken: () => null,
      fetch: doFetch,
    });
    await expect(api.session()).rejects.toMatchObject({
      code: "server_error",
      message: "Der Server hat einen Fehler gemeldet.",
    });
  });

  it("reports network failures as offline", async () => {
    const api = createApi({
      baseUrl: "",
      getToken: () => null,
      fetch: (() => Promise.reject(new TypeError("fail"))) as typeof fetch,
    });
    await expect(api.pull(0)).rejects.toMatchObject({ code: "offline" });
  });

  it("returns blobs as bytes and builds the socket URL", async () => {
    const { calls, doFetch } = fakeFetch(
      () => new Response(new Uint8Array([1, 2, 3])),
    );
    const api = createApi({
      baseUrl: "https://pi.test",
      getToken: () => "t",
      fetch: doFetch,
    });
    expect(await api.getBlob("b")).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls[0].url).toBe("https://pi.test/api/v1/blobs/b");
    expect(api.socketUrl("a+b")).toBe("wss://pi.test/api/v1/ws?token=a%2Bb");
  });
});

describe("session check", () => {
  /** API client that answers every call with `response`. */
  const apiAnswering = (
    response: (url: string) => Response | Promise<Response>,
  ) =>
    createApi({
      baseUrl: "",
      getToken: () => "t",
      fetch: fakeFetch(response).doFetch,
    });

  it("maps a valid session and its key wraps to the account", async () => {
    const keys = [
      { id: "k", kind: "passkey", alg: "A256GCM", wrapped: "", createdAt: 1 },
    ];
    const check = await checkSession(
      apiAnswering((url) => json(url.endsWith("/keys") ? { keys } : SESSION)),
    );
    expect(sessionStatus(check)).toEqual({
      account: {
        userId: "u",
        deviceId: "d",
        identities: SESSION.identities,
        hasDataKey: true,
        hasRecoveryKey: false,
        hasPrfPasskey: true,
        signedInWith: null,
        approved: true,
        contactEmail: null,
        accessNote: null,
      },
      error: null,
    });
  });

  it("skips the keys of an account that waits for approval", async () => {
    const pending = { ...SESSION, approved: false, contactEmail: "a@b.de" };
    const check = await checkSession(
      apiAnswering((url) =>
        url.endsWith("/keys")
          ? json({ error: "not_approved" }, 403)
          : json(pending),
      ),
    );
    expect(sessionStatus(check)).toMatchObject({
      phase: "notApproved",
      account: { approved: false, contactEmail: "a@b.de", hasDataKey: false },
    });
  });

  it("maps HTTP 426 to upgradeRequired", async () => {
    const check = await checkSession(
      apiAnswering(() => json({ error: "upgrade_required" }, 426)),
    );
    expect(sessionStatus(check)).toMatchObject({ phase: "upgradeRequired" });
  });

  it("maps a revoked session to signedOut with a hint", async () => {
    const check = await checkSession(
      apiAnswering(() => json({ error: "session_revoked" }, 401)),
    );
    expect(check.state).toBe("revoked");
    expect(sessionStatus(check)).toMatchObject({
      phase: "signedOut",
      account: null,
      error: "Dieses Gerät wurde abgemeldet. Bitte neu anmelden.",
    });
  });

  it("keeps the account while offline", async () => {
    const check = await checkSession(
      apiAnswering(() => Promise.reject(new TypeError("down"))),
    );
    expect(sessionStatus(check)).toEqual({ phase: "offline" });
  });
});

describe("startSessionMonitor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks at start, by interval, online and when visible", async () => {
    vi.useFakeTimers();
    const window = new EventTarget();
    const document = Object.assign(new EventTarget(), {
      visibilityState: "hidden" as DocumentVisibilityState,
    });
    const check = vi.fn(async () => {});
    const stop = startSessionMonitor(check, { window, document });
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SESSION_CHECK_INTERVAL);
    expect(check).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(3);
    document.dispatchEvent(new Event("visibilitychange"));
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(4);
    stop();
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(SESSION_CHECK_INTERVAL);
    expect(check).toHaveBeenCalledTimes(4);
  });

  it("skips a check while one is running", async () => {
    let finish = () => {};
    const check = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const window = new EventTarget();
    const document = Object.assign(new EventTarget(), {
      visibilityState: "visible" as DocumentVisibilityState,
    });
    const stop = startSessionMonitor(check, { window, document });
    window.dispatchEvent(new Event("online"));
    expect(check).toHaveBeenCalledTimes(1);
    finish();
    stop();
  });
});
