const url = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";

const html = await (
  await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" }
  })
).text();

const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
console.log("script count", srcs.length);
for (const s of srcs.slice(0, 40)) console.log(s);

const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
console.log("jsonLd blocks", jsonLd.length);
