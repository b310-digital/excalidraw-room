import test from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { io as Client, Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const serverPath = path.join(__dirname, '..', 'src', 'index.ts');
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function startServer(port: number): Promise<ChildProcess> {
  const child = spawn('tsx', [serverPath], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', DEBUG: '' },
    stdio: 'inherit'
  });
  await waitForHttpOk(port, '/', 40, 50);
  return child;
}

function waitForHttpOk(port: number, pathName: string, attempts: number, intervalMs: number) {
  return new Promise<void>((resolve, reject) => {
    let remaining = attempts;
    const attempt = () => {
      const req = http.request({ hostname: '127.0.0.1', port, path: pathName, method: 'GET' }, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    };
    const retry = () => {
      if (--remaining <= 0) reject(new Error('Server did not become ready in time'));
      else setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

function connectClient(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = Client(`http://localhost:${port}`, { transports: ['websocket'] });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function onceEvent<T = any>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (data: T) => { clearTimeout(to); resolve(data); };
    socket.once(event, handler);
  });
}

async function connectAndExpectInit(port: number, t: test.TestContext): Promise<Socket> {
  const client = await connectClient(port);
  t.after(() => client.disconnect());
  await onceEvent<void>(client, 'init-room');
  return client;
}

function assertUserList(actual: string[], expectedIds: string[], msg: string) {
  assert.equal(actual.length, expectedIds.length, `${msg} length`);
  const expectedSet = new Set(expectedIds);
  assert.ok(actual.every(id => expectedSet.has(id)), `${msg} contents`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const ROOM = 'api-contract-room';

test('init-room emitted on every connection', async (t) => {
  const port = 4060;
  const server = await startServer(port);
  t.after(() => server.kill());

  const c1 = await connectClient(port); t.after(() => c1.disconnect());
  const init1 = await onceEvent<void>(c1, 'init-room');
  assert.strictEqual(init1, undefined, 'first client init-room payload is undefined');

  const c2 = await connectClient(port); t.after(() => c2.disconnect());
  const init2 = await onceEvent<void>(c2, 'init-room');
  assert.strictEqual(init2, undefined, 'second client init-room payload is undefined');
});

test('room-user-change reflects full state immediately after join (no stale lists)', async (t) => {
  const port = 4061;
  const server = await startServer(port);
  t.after(() => server.kill());

  const c1 = await connectAndExpectInit(port, t);
  const list1Promise = onceEvent<string[]>(c1, 'room-user-change');
  c1.emit('join-room', ROOM);
  const list1 = await list1Promise;
  assertUserList(list1, [c1.id!], 'first join list');

  const c2 = await connectAndExpectInit(port, t);
  const c2ListPromise = onceEvent<string[]>(c2, 'room-user-change');
  const c1UpdatedPromise = onceEvent<string[]>(c1, 'room-user-change');
  c2.emit('join-room', ROOM);
  const [c2List, c1UpdatedList] = await Promise.all([c2ListPromise, c1UpdatedPromise]);
  assertUserList(c2List, [c1.id!, c2.id!], 'c2 first list');
  assertUserList(c1UpdatedList, [c1.id!, c2.id!], 'c1 updated list');
});
