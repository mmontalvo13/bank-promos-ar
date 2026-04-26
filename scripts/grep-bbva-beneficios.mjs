const base = "https://www.bbva.com.ar";

const pageUrl = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";
const html = await (await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0" } })).text();

const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((s) => s.startsWith("/beneficios/_next/static/chunks/"));

const hits = [];

for (const src of srcs) {
  const url = `${base}${src}`;
  const js = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  const idx = js.toLowerCase().indexOf("beneficio");
  if (idx !== -1) {
    hits.push({ url, idx, snippet: js.slice(Math.max(0, idx - 120), idx + 220) });
  }
}

console.log("filesWithBeneficio", hits.length);
for (const h of hits.slice(0, 8)) {
  console.log("\n", h.url);
  console.log(h.snippet.replace(/\s+/g, " "));
}
