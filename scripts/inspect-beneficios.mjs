const html = await (await fetch("https://beneficios.galicia.ar/")).text();
const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) {
  console.log("no __NEXT_DATA__");
  process.exit(0);
}
const j = JSON.parse(m[1]);
const s = JSON.stringify(j);
console.log("nextDataKeys", Object.keys(j));
console.log("containsApiWord", s.includes("api"));
const idx = s.indexOf("api");
if (idx !== -1) console.log("apiSnippet", s.slice(Math.max(0, idx - 120), idx + 300));

const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((x) => x[1]);
console.log("scriptSrcCount", scriptSrcs.length);
console.log("scriptSrcSample", scriptSrcs.slice(0, 12));
console.log("scriptSrcAll");
for (const s of scriptSrcs) console.log(s);


