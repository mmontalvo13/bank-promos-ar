const base = "https://www.bbva.com.ar";

const pageUrl = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";
const html = await (await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0" } })).text();

const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((s) => s.startsWith("/beneficios/_next/static/chunks/"));

const jsonStrings = new Set();

for (const src of srcs) {
  const url = `${base}${src}`;
  const js = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  for (const m of js.matchAll(/"([^"]+\.json)"/g)) jsonStrings.add(m[1]);
  for (const m of js.matchAll(/'([^']+\.json)'/g)) jsonStrings.add(m[1]);
}

console.log("jsonStrings", jsonStrings.size);
for (const s of [...jsonStrings].slice(0, 200)) console.log(s);
