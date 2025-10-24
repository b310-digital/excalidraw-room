import test from "node:test";
import assert from "node:assert";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Socket } from "socket.io-client";
import { io as Client } from "socket.io-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, "..", "src", "index.ts");

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function startServer(port: number): Promise<ChildProcess> {
  const child = spawn("tsx", [serverPath], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", DEBUG: "" },
    stdio: "inherit",
  });
  await waitForHttpOk(port, "/", 40, 50);
  return child;
}

export function waitForHttpOk(
  port: number,
  pathName: string,
  attempts: number,
  intervalMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    let remaining = attempts;
    const attempt = () => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: pathName, method: "GET" },
        (res) => {
          if (res.statusCode === 200) {
            res.resume();
            resolve();
          } else {
            res.resume();
            retry();
          }
        },
      );
      req.on("error", retry);
      req.end();
    };
    const retry = () => {
      if (--remaining <= 0)
        reject(new Error("Server did not become ready in time"));
      else setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

export function connectClient(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = Client(`http://localhost:${port}`, {
      transports: ["websocket"],
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

export function onceEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (data: T) => {
      clearTimeout(to);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

export async function connectAndExpectInit(
  port: number,
  t: test.TestContext,
): Promise<Socket> {
  const client = await connectClient(port);
  t.after(() => client.disconnect());
  await onceEvent<void>(client, "init-room");
  return client;
}

export function assertUserList(
  actual: string[],
  expectedIds: string[],
  msg: string,
) {
  assert.equal(actual.length, expectedIds.length, `${msg} length`);
  const expectedSet = new Set(expectedIds);
  assert.ok(
    actual.every((id) => expectedSet.has(id)),
    `${msg} contents`,
  );
}
