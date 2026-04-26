const url = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";

const html = await (
  await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" }
  })
).text();

const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) {
  console.log("no __NEXT_DATA__");
  process.exit(0);
}

const j = JSON.parse(m[1]);
console.log("next keys", Object.keys(j));

const pp = j.props?.pageProps;
console.log("pageProps keys", pp ? Object.keys(pp) : null);

// Try to find likely promo arrays in pageProps
function walk(obj, path = "") {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    if (obj.length && typeof obj[0] === "object") {
      const keys = Object.keys(obj[0]);
      const score =
        keys.filter((k) => /promo|benef|desc|reinteg|marca|comercio|titulo|nombre/i.test(k)).length;
      if (score >= 2) console.log("candidate array", path, "len", obj.length, "keys", keys.slice(0, 25));
    }
    return;
  }

  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    walk(v, p);
  }
}

walk(pp, "props.pageProps");
