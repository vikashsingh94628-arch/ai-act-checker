// Node smoke test: node test-node.mjs
globalThis.__memKV = new Map();
process.env.BOT_TOKEN = "T"; process.env.WEBHOOK_SECRET = "s"; process.env.WORKER_ORIGIN = "http://local.test";
const { handle } = await import("./index.js");
function j(res){return res.text().then(t=>{try{return JSON.parse(t)}catch{return t}})}
const results = [];
let res = await handle(new Request("http://local.test/health"));
results.push(["health", res.status, (await j(res)).ok]);
res = await handle(new Request("http://local.test/scan?url=" + encodeURIComponent("https://example.com")));
const s1 = await j(res);
results.push(["scan", res.status, s1.ok, s1.report && s1.report.verdict]);
if (s1.report) {
  res = await handle(new Request("http://local.test/r/" + s1.report.id));
  results.push(["report page", res.status, (await res.text()).includes("Article 50")]);
}
res = await handle(new Request("http://local.test/scan?url=notaurl.."));
results.push(["invalid", res.status, (await j(res)).error]);
res = await handle(new Request("http://local.test/scan?url=http://127.0.0.1/x"));
results.push(["blocked", res.status, (await j(res)).error]);
res = await handle(new Request("http://local.test/tg/webhook", {method:"POST",headers:{"content-type":"application/json","x-telegram-bot-api-secret-token":"wrong"},body:"{}"}));
results.push(["webhook wrong secret", res.status]);
res = await handle(new Request("http://local.test/tg/webhook", {method:"POST",headers:{"content-type":"application/json","x-telegram-bot-api-secret-token":"s"},body:JSON.stringify({message:{chat:{id:1},from:{language_code:"hi"},text:"/start"}})}));
results.push(["webhook /start", res.status]);
let last;
for (let i=0;i<11;i++){ last = await handle(new Request("http://local.test/tg/webhook", {method:"POST",headers:{"content-type":"application/json","x-telegram-bot-api-secret-token":"s"},body:JSON.stringify({message:{chat:{id:1},from:{language_code:"en"},text:"https://example.com"}})})); }
results.push(["rate limit path", last.status]);
for (const r of results) console.log(JSON.stringify(r));
