const url = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";

const html = await (
  await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" }
  })
).text();

console.log("len", html.length);

const hits = new Set();
for (const m of html.matchAll(/https?:\/\/[^"'\\s>]+/g)) hits.add(m[0]);
const arr = [...hits]
  .filter((u) => /json|api|graphql|benef|promo/i.test(u))
  .slice(0, 200);
console.log("interestingUrls", arr.length);
for (const u of arr) console.log(u);

console.log("has __NEXT_DATA__", html.includes("__NEXT_DATA__"));
console.log("has next/static", html.includes("/_next/static"));
