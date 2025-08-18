import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

// Run server directly from TypeScript source via tsx
const serverPath = path.join(__dirname, '..', 'src', 'index.ts');

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

test('server responds on / with expected message', async (t) => {
    const child = spawn('tsx', [serverPath], {
        env: { ...process.env, PORT: '4010', NODE_ENV: 'test' },
        stdio: 'inherit'
    });
    t.after(() => { child.kill(); });
    await wait(800);
    const body = await new Promise<string>((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: 4010, path: '/', method: 'GET' }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { assert.equal(res.statusCode, 200); resolve(data); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
    assert.match(body, /Excalidraw collaboration server is up/);
});
