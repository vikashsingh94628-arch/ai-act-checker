// Deno smoke test: KV_PATH=":memory:" deno run --allow-env --allow-net test-deno.js
import { handle } from "./index.js";

function j(res) { return res.text().then(t => { try { return JSON.parse(t); } catch { return t; } }); }
const results = [];

// 1. health
let res = await handle(new Request("http://local.test/health"));
results.push(["health", res.status, await j(res)]);

// 2. scan plain site
res = await handle(new Request("http://local.test/scan?url=" + encodeURIComponent("https://example.com")));
const scan1 = await j(res);
results.push(["scan example.com", res.status, scan1.ok, scan1.report && scan1.report.verdict, scan1.report && scan1.report.checks.map(c => c.id + ":" + c.status)]);

// 3. report page
if (scan1.report) {
  res = await handle(new Request("http://local.test/r/" + scan1.report.id));
  const html = await res.text();
  results.push(["report page", res.status, html.includes("Article 50"), html.length]);
}

// 4. invalid + blocked
res = await handle(new Request("http://local.test/scan?url=notaurl.."));
results.push(["invalid url", res.status, (await j(res)).error]);
res = await handle(new Request("http://local.test/scan?url=http://127.0.0.1/x"));
results.push(["blocked url", res.status, (await j(res)).error]);

// 5. webhook wrong secret
res = await handle(new Request("http://local.test/tg/webhook", { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" }, body: "{}" }));
results.push(["webhook wrong secret", res.status]);

// 6. webhook /start (hi) - sendMessage fails silently with fake token
res = await handle(new Request("http://local.test/tg/webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "s" },
  body: JSON.stringify({ message: { chat: { id: 123 }, from: { language_code: "hi" }, text: "/start" } }),
}));
results.push(["webhook /start hi", res.status, await j(res)]);

// 7. webhook URL scan (same chat 11 more times to test rate limit)
let lastStatus = null;
for (let i = 0; i < 11; i++) {
  res = await handle(new Request("http://local.test/tg/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "s" },
    body: JSON.stringify({ message: { chat: { id: 123 }, from: { language_code: "en" }, text: "https://example.com" } }),
  }));
  lastStatus = res.status;
}
results.push(["webhook 11 scans (limit path)", lastStatus]);

for (const r of results) console.log(JSON.stringify(r));
