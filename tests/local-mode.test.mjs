import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  envFile: false,
  root,
  define: { "import.meta.env.VITE_ENABLE_DEMO": JSON.stringify("false") },
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(() => vite.close());

test("local login does not expose or prefill demo credentials", async () => {
  const { QualityApp } = await vite.ssrLoadModule("/app/quality-app.tsx");
  const html = renderToStaticMarkup(React.createElement(QualityApp));
  assert.match(html, /Ingresar al sistema/);
  assert.doesNotMatch(html, /Calidad2026!|Credenciales de demostración/);
});

test("connected administration renders before server data arrives", async () => {
  const { RolesPage, UsersAdminPage, SuppliersCarriersPage } = await vite.ssrLoadModule("/app/feature-pages.tsx");
  for (const Page of [RolesPage, UsersAdminPage, SuppliersCarriersPage]) {
    const html = renderToStaticMarkup(React.createElement(Page, { connected: true }));
    assert.match(html, /PostgreSQL conectado/);
    assert.doesNotMatch(html, /Ana Salazar|José Paredes|Calidad2026!/);
  }
});

test("an unavailable API fails with a connection error", async context => {
  const { apiRequest } = await vite.ssrLoadModule("/app/api-client.ts");
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(apiRequest("/api/records"), /No se pudo conectar con el servidor/);
});

test("a frontend HTML response cannot impersonate a working API", async context => {
  const { apiRequest } = await vite.ssrLoadModule("/app/api-client.ts");
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("<html>Login</html>", { headers: { "content-type": "text/html" } });
  await assert.rejects(apiRequest("/api/records"), /La API no está disponible/);
});

test("server validation errors remain readable", async context => {
  const { apiRequest } = await vite.ssrLoadModule("/app/api-client.ts");
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ detail: [{ msg: "El dato es obligatorio" }] }, { status: 422 });
  await assert.rejects(apiRequest("/api/records"), /El dato es obligatorio/);
});
