// ISC Prep: static site + small progress-sync API backed by D1.
const KEY_RE = /^[a-z0-9]{20,64}$/;
const MAX_BYTES = 2_000_000;
const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function handleApi(request, env, url) {
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/team" && request.method === "GET") return handleTeam(request, env, url);
  if (url.pathname === "/api/report" && request.method === "POST") return handleReport(request, env);
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

async function handleTeam(request, env, url) {
  const exam = url.searchParams.get("exam") === "engineer" ? "engineer" : "admin";
  const code = (url.searchParams.get("code") || "").toUpperCase();
  if (!CODE_RE.test(code)) return json({ error: "invalid_code" }, 400);
  const myKey = (request.headers.get("x-sync-key") || "").toLowerCase();
  const { results } = await env.DB.prepare("SELECT key, data FROM profiles").all();
  const weekAgo = Date.now() - 7 * 864e5;
  const members = [];
  const domains = {};
  for (const row of results || []) {
    let d;
    try { d = JSON.parse(row.data); } catch { continue; }
    const team = d && d.team;
    if (!team || !team.share || !team.name || String(team.code || "").toUpperCase() !== code) continue;
    const ex = (d.exams || {})[exam] || {};
    const atts = Array.isArray(ex.attempts) ? ex.attempts : [];
    for (const a of atts) for (const k of Object.keys(a.dom || {})) {
      domains[k] = domains[k] || { n: 0, ok: 0 };
      domains[k].n += a.dom[k].n || 0; domains[k].ok += a.dom[k].ok || 0;
    }
    const scores = atts.map(a => a.score);
    const fulls = atts.filter(a => a.mode === "full");
    members.push({
      name: String(team.name).slice(0, 40),
      me: row.key === myKey,
      attempts: atts.length,
      full: fulls.length,
      avgFull: fulls.length ? Math.round(fulls.reduce((s, a) => s + a.score, 0) / fulls.length) : null,
      best: scores.length ? Math.max(...scores) : null,
      last: scores.length ? scores[scores.length - 1] : null,
      week: atts.filter(a => a.t > weekAgo).reduce((s, a) => s + (a.answered || 0), 0),
      lastActive: atts.length ? atts[atts.length - 1].t : null,
    });
  }
  return json({ exam, code, members, domains });
}

const REASONS = new Set(["wrong_answer", "unclear", "typo", "outdated", "other"]);
async function handleReport(request, env) {
  const text = await request.text();
  if (text.length > 8000) return json({ error: "too_large" }, 413);
  let b;
  try { b = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
  const exam = b.exam === "engineer" ? "engineer" : b.exam === "admin" ? "admin" : null;
  const qid = Number.isInteger(b.qid) ? b.qid : -1;
  if (!exam || qid < 0 || !REASONS.has(b.reason) || typeof b.question !== "string") return json({ error: "bad_body" }, 400);
  const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
  await env.DB.prepare("INSERT INTO reports (exam, qid, question, reason, comment, shown, lang, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
    .bind(exam, qid, clip(b.question, 600), b.reason, clip(b.comment, 1000), clip(b.shown, 2000), clip(b.lang, 5), Date.now()).run();
  return json({ ok: true });
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
