// Local smoke test: run the worker's fetch handler in plain node with a Map-backed KV shim.
import worker from "./index.js";

const store = new Map();
const kv = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
};
const env = {
  CHECKER: kv,
  WORKER_ORIGIN: "http://local.test",
  BOT_USERNAME: "TestBot",
  BOT_TOKEN: "TEST",
  WEBHOOK_SECRET: "s3cret",
};

function j(res) { return res.text().then(t => { try { return JSON.parse(t); } catch { return t; } }); }

const results = [];

// 1. health
let res = await worker.fetch(new Request("http://local.test/health"), env);
results.push(["health", res.status, await j(res)]);

// 2. scan a plain site (expect NEEDS REVIEW - no chat, no labels)
res = await worker.fetch(new Request("http://local.test/scan?url=" + encodeURIComponent("https://example.com")), env);
const scan1 = await j(res);
results.push(["scan example.com", res.status, scan1.ok, scan1.report && scan1.report.verdict, scan1.report && scan1.report.checks.map(c => c.id + ":" + c.status)]);

// 3. report page renders
if (scan1.report) {
  res = await worker.fetch(new Request("http://local.test/r/" + scan1.report.id), env);
  const html = await res.text();
  results.push(["report page", res.status, html.includes("Article 50"), html.length]);
}

// 4. invalid + blocked urls
res = await worker.fetch(new Request("http://local.test/scan?url=notaurl.."), env);
results.push(["invalid url", res.status, await j(res)]);
res = await worker.fetch(new Request("http://local.test/scan?url=http://127.0.0.1/x"), env);
results.push(["blocked url", res.status, await j(res)]);

// 5. telegram webhook: wrong secret rejected
res = await worker.fetch(new Request("http://local.test/tg/webhook", { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" }, body: "{}" }), env);
results.push(["webhook wrong secret", res.status]);

// 6. telegram webhook: /start welcome (sendMessage will fail silently with fake token)
res = await worker.fetch(new Request("http://local.test/tg/webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "s3cret" },
  body: JSON.stringify({ message: { chat: { id: 123 }, from: { language_code: "hi" }, text: "/start" } }),
}), env);
results.push(["webhook /start hi", res.status, await j(res)]);

// 7. webhook with a URL (rate limit + scan path)
res = await worker.fetch(new Request("http://local.test/tg/webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "s3cret" },
  body: JSON.stringify({ message: { chat: { id: 123 }, from: { language_code: "en" }, text: "check https://example.com please" } }),
}), env);
results.push(["webhook scan", res.status, await j(res)]);

for (const r of results) console.log(JSON.stringify(r));
