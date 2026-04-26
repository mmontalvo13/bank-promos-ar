const base = "https://www.bbva.com.ar";

const pageUrl = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";
const html = await (await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0" } })).text();

const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.startsWith("/beneficios/_next/static/chunks/"));

const needleRe = /(\/beneficios\/[^"'\\s]{3,200}\.(?:json|txt))|(\/api\/[^"'\\s]{3,200})|(https?:\/\/[^"'\\s]{3,200})/g;

const found = new Set();

for (const src of srcs) {
  const url = src.startsWith("http") ? src : `${base}${src}`;
  const js = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  let m;
  while ((m = needleRe.exec(js))) {
    const hit = m[0];
    if (hit.includes("googletagmanager")) continue;
    if (hit.includes("akam")) continue;
    found.add(hit);
  }
}

console.log("hits", found.size);
for (const h of [...found].slice(0, 200)) console.log(h);
