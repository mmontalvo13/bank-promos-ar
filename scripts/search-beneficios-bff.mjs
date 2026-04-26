const chunk = "https://beneficios.galicia.ar/_next/static/chunks/pages/index-eabae53754baee5a8c79.js";
const js = await (await fetch(chunk)).text();
console.log("len", js.length);

const low = js.toLowerCase();
const idx = low.indexOf("bff");
console.log("hasBffWord", idx !== -1);
if (idx !== -1) console.log("bffSnippet", js.slice(Math.max(0, idx - 120), idx + 300));
if (idx !== -1) console.log("bffSnippetLong", js.slice(Math.max(0, idx - 120), idx + 1200));

const strings = [];
const re = /\/bff\/[a-zA-Z0-9._\-\/]+/g;
let m;
while ((m = re.exec(js))) strings.push(m[0]);

const uniq = [...new Set(strings)];
console.log("bffPaths", uniq.slice(0, 200));

const bffStringLits = [...js.matchAll(/"\/bff[^"]*"/g)].map((x) => x[0].slice(1, -1));
console.log("bffStringLits", [...new Set(bffStringLits)].slice(0, 200));

const hints = [];
for (const key of ["promo", "benef", "discount", "campaign", "category", "store", "search"]) {
  if (js.toLowerCase().includes(key)) hints.push(key);
}
console.log("hints", hints);

const promoStrings = [...js.matchAll(/"[^"]{0,80}(promo|promoc|benef|descuent)[^"]{0,80}"/gi)]
  .map((x) => x[0].slice(1, -1))
  .slice(0, 80);
console.log("promoStringsSample", promoStrings);

// Print some surrounding snippets for likely endpoint names
for (const needle of ["promoc", "benefit", "discount", "campaign", "coupon", "search"]) {
  const p = low.indexOf(needle);
  if (p !== -1) {
    console.log("snippetFor", needle, js.slice(Math.max(0, p - 120), p + 260));
  }
}

const idxPers = low.indexOf("personalizacion_v1");
if (idxPers !== -1) {
  console.log("aroundPersonalizacion", js.slice(Math.max(0, idxPers - 400), idxPers + 400));
}

// Try to discover what "U" is (API base URL)
const idxU = js.lastIndexOf("U=", idxPers);
if (idxU !== -1) {
  console.log("aroundUequals", js.slice(Math.max(0, idxU - 200), idxU + 300));
}

