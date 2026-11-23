import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Folder of the Go module, relative to the repo root where Vitest runs. */
const SERVER_DIR = "server";
/** How long the server may take to answer the health check after a start. */
const START_TIMEOUT_MS = 15_000;

/** A free TCP port on localhost. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address == "object" && address
          ? resolve(address.port)
          : reject(new Error("no port")),
      );
    });
  });
}

/** Polls the health endpoint until the server answers. */
async function waitForHealth(baseUrl: string, log: () => string) {
  const end = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < end) {
    try {
      if ((await fetch(`${baseUrl}/api/v1/health`)).ok) return;
    } catch {
      // Not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${log()}`);
}

/** Waits until the process has exited. */
function exited(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    if (child.exitCode != null || child.signalCode != null) resolve();
    else child.once("exit", () => resolve());
  });
}

/**
 * Builds the Go server and runs it with `DEV_AUTH=1` and a temporary `DATA_DIR` on a free
 * port. `snapshot` and `restore` copy the data folder while the server is stopped, to test a
 * server restored from a backup.
 */
export async function startGoServer() {
  const root = mkdtempSync(join(tmpdir(), "notenfeder-e2e-"));
  const binary = join(root, "notenfeder-server");
  const dataDir = join(root, "data");
  execFileSync("go", ["build", "-o", binary, "./cmd/notenfeder-server"], {
    cwd: SERVER_DIR,
    stdio: "inherit",
  });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child: ChildProcess | null = null;
  let output = "";

  /** Starts the binary on the same port and data folder. */
  async function start() {
    output = "";
    child = spawn(binary, [], {
      env: {
        ...process.env,
        DEV_AUTH: "1",
        DATA_DIR: dataDir,
        LISTEN_ADDR: `127.0.0.1:${port}`,
        APP_ORIGINS: "http://localhost",
        RP_ID: "localhost",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr?.on("data", (chunk) => (output += String(chunk)));
    await waitForHealth(baseUrl, () => output);
  }

  /** Stops the binary and waits for its exit, so the SQLite file is closed. */
  async function stop() {
    if (!child) return;
    const running = child;
    child = null;
    running.kill("SIGTERM");
    await exited(running);
  }

  await start();
  return {
    baseUrl,
    /** Copies the data folder to `name` with a short stop of the server. */
    async snapshot(name: string) {
      await stop();
      cpSync(dataDir, join(root, name), { recursive: true });
      await start();
    },
    /** Replaces the data folder with the snapshot `name` and restarts the server. */
    async restore(name: string) {
      await stop();
      rmSync(dataDir, { recursive: true, force: true });
      cpSync(join(root, name), dataDir, { recursive: true });
      await start();
    },
    /** Stops the server and removes all its files. */
    async close() {
      await stop();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
