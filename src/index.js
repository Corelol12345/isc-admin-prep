// ISC Prep: static site + small progress-sync API backed by D1.
const KEY_RE = /^[a-z0-9]{20,64}$/;
const MAX_BYTES = 2_000_000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function handleApi(request, env, url) {
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname !== "/api/state") return json({ error: "not_found" }, 404);

  const key = (request.headers.get("x-sync-key") || "").toLowerCase();
  if (!KEY_RE.test(key)) return json({ error: "invalid_key" }, 400);

  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT data, updated_at FROM profiles WHERE key = ?1").bind(key).first();
    if (!row) return json({ data: null, updated: 0 });
    return json({ data: JSON.parse(row.data), updated: row.updated_at });
  }

  if (request.method === "PUT") {
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: "too_large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    if (!body || typeof body.data !== "object" || body.data === null || !body.data.exams) return json({ error: "bad_body" }, 400);
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO profiles (key, data, updated_at, created_at) VALUES (?1, ?2, ?3, ?3) " +
      "ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
    ).bind(key, JSON.stringify(body.data), now).run();
    return json({ ok: true, updated: now });
  }

  return json({ error: "method_not_allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env, url); }
      catch (e) { return json({ error: "server_error" }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
