import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

const { default: worker } = await import("../dist/server/index.js");
const env = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function backend(t, handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const previous = process.env.BACKEND_URL;
  process.env.BACKEND_URL = `http://127.0.0.1:${server.address().port}/`;
  t.after(() => {
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
    server.closeAllConnections();
    server.close();
  });
}

for (const route of ["applications", "metrics"]) {
  test(`${route} proxy uses the configured backend and returns fresh data`, async (t) => {
    let receivedPath;
    const data = route === "applications" ? [{ name: "gitops-dashboard" }] : { scrape_healthy: true };
    await backend(t, (req, res) => {
      receivedPath = req.url;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    });
    const response = await worker.fetch(new Request(`http://localhost/api/${route}`), env, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), data);
    assert.equal(receivedPath, `/api/${route}`);
  });

  test(`${route} proxy handles a backend failure`, async (t) => {
    await backend(t, (_req, res) => { res.writeHead(503); res.end("Unavailable"); });
    const response = await worker.fetch(new Request(`http://localhost/api/${route}`), env, ctx);
    assert.equal(response.status, route === "applications" ? 502 : 503);
  });

  test(`${route} proxy handles connection errors`, async (t) => {
    await backend(t, (req) => req.socket.destroy());
    const response = await worker.fetch(new Request(`http://localhost/api/${route}`), env, ctx);
    assert.equal(response.status, route === "applications" ? 502 : 503);
    assert.doesNotMatch(await response.text(), /socket|ECONNRESET/);
  });
}
