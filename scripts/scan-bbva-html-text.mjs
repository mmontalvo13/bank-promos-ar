const pageUrl = process.argv[2] ?? "https://www.bbva.com.ar/beneficios/beneficios.html";

const html = await (await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0" } })).text();

const needles = ["reinteg", "promo", "benef", "descuento", "cuota", "visa", "master", "amex", "qr", "nfc"];

for (const n of needles) {
  const idx = html.toLowerCase().indexOf(n);
  console.log(n, idx);
  if (idx !== -1) console.log(html.slice(Math.max(0, idx - 80), idx + 200).replace(/\s+/g, " "));
}
