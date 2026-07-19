/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outDir = path.join(root, "public", "social", "launch-posts");
fs.mkdirSync(outDir, { recursive: true });

const W = 1080;
const H = 1350;
const green = "#137a3d";
const orange = "#e07b1a";
const cream = "#fff8ee";
const text = "#101827";
const muted = "#667085";
const logoPath = path.join(root, "public", "icons", "icon-1024.png");
const homePath =
  "C:\\Users\\pietr\\.codex\\codex-remote-attachments\\019ef8dd-92db-7662-be2b-c4dbe56b9e83\\6E2015BD-09B3-4388-8ED7-4E732EDD118D\\2-Foto-2.jpg";

function esc(s) {
  return String(s).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

function tspanLines(lines, x, y, size, weight, color, lh = 1.12, anchor = "start") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lh}">${esc(line)}</tspan>`)
    .join("")}</text>`;
}

function wordmark(x, y, size = 58, anchor = "start") {
  const fantaWidth = size * 2.48;
  const start = anchor === "middle" ? x - (fantaWidth + size * 2.08) / 2 : x;
  return `
    <text x="${start}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="900" fill="${green}">Fanta</text>
    <text x="${start + fantaWidth}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="900" fill="${orange}">Chat</text>`;
}

async function dataUri(file) {
  const b = await fs.promises.readFile(file);
  const ext = path.extname(file).slice(1).toLowerCase().replace("jpg", "jpeg");
  return `data:image/${ext};base64,${b.toString("base64")}`;
}

async function renderSvg(name, svg) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, name));
}

function problemCard(x, y, n, title, sub, color) {
  return `<g filter="url(#soft)">
    <rect x="${x}" y="${y}" width="908" height="126" rx="32" fill="#ffffff" stroke="#e7ece7"/>
    <circle cx="${x + 70}" cy="${y + 63}" r="34" fill="${color}" opacity=".12"/>
    <text x="${x + 70}" y="${y + 74}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" fill="${color}">${n}</text>
    <text x="${x + 130}" y="${y + 56}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="${text}">${title}</text>
    <text x="${x + 130}" y="${y + 96}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="${muted}">${sub}</text>
  </g>`;
}

async function post1() {
  const logo = await dataUri(logoPath);
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#1c9b52" stop-opacity=".58"/><stop offset=".48" stop-color="#06351f" stop-opacity=".92"/><stop offset="1" stop-color="#010704"/></radialGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#24d264"/><stop offset="1" stop-color="${orange}"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
      <filter id="shadow"><feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="#000" flood-opacity=".36"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g1)"/>
    <circle cx="210" cy="230" r="210" fill="${orange}" opacity=".12" filter="url(#blur)"/>
    <circle cx="850" cy="1120" r="260" fill="#22c55e" opacity=".16" filter="url(#blur)"/>
    <path d="M80 1090 C340 980 575 1220 1000 1060" fill="none" stroke="${orange}" stroke-width="6" opacity=".45"/>
    <path d="M90 1130 C370 1010 600 1245 1005 1100" fill="none" stroke="#24d264" stroke-width="6" opacity=".42"/>
    <rect x="310" y="270" width="460" height="460" rx="118" fill="rgba(255,255,255,.06)" stroke="url(#edge)" stroke-width="2"/>
    <clipPath id="logoClip"><rect x="370" y="330" width="340" height="340" rx="72"/></clipPath>
    <image href="${logo}" x="370" y="330" width="340" height="340" filter="url(#shadow)" clip-path="url(#logoClip)"/>
    <text x="380" y="825" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="900" fill="#42e878">Fanta</text>
    <text x="565" y="825" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="900" fill="#ff8a26">Chat</text>
    ${tspanLines(["Il fanta sta per avere", "una nuova casa."], 540, 945, 70, 900, "#ffffff", 1.08, "middle")}
    <text x="540" y="1115" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="700" fill="rgba(255,255,255,.72)">Campionato, coppe, chat e statistiche.</text>
    <rect x="420" y="1200" width="240" height="48" rx="24" fill="rgba(224,123,26,.18)" stroke="${orange}" stroke-width="2"/>
    <text x="540" y="1232" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#ffb86c">IN ARRIVO</text>
  </svg>`;
  await renderSvg("post-01-teaser.png", svg);
}

async function post2() {
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf2"/><stop offset="1" stop-color="#eef5ee"/></linearGradient>
      <filter id="soft"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#101827" flood-opacity=".10"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="930" cy="105" r="210" fill="${orange}" opacity=".13"/>
    <circle cx="70" cy="1210" r="250" fill="#22c55e" opacity=".13"/>
    ${wordmark(86, 118, 54)}
    <text x="86" y="214" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="${orange}">IL PROBLEMA</text>
    ${tspanLines(["Il fanta è ancora", "sparso ovunque."], 86, 315, 74, 900, text, 1.08)}
    ${problemCard(86, 520, "01", "Formazione", "in un'app diversa", green)}
    ${problemCard(86, 690, "02", "Chat", "su WhatsApp", orange)}
    ${problemCard(86, 860, "03", "Coppe", "gestite a mano", green)}
    ${problemCard(86, 1030, "04", "Statistiche", "da cercare altrove", orange)}
    <text x="86" y="1240" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="${muted}">Forse il fanta meritava qualcosa di più ordinato.</text>
  </svg>`;
  await renderSvg("post-02-problema.png", svg);
}

async function post3() {
  const home = await dataUri(homePath);
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3b24"/><stop offset=".58" stop-color="#16733e"/><stop offset="1" stop-color="${orange}"/></linearGradient>
      <filter id="phoneShadow"><feDropShadow dx="0" dy="36" stdDeviation="34" flood-color="#001a0d" flood-opacity=".34"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="${cream}"/>
    <rect x="0" y="0" width="${W}" height="500" fill="url(#bg)"/>
    <path d="M0 455 C260 520 525 395 1080 470 L1080 0 L0 0 Z" fill="rgba(255,255,255,.08)"/>
    ${wordmark(86, 120, 54)}
    ${tspanLines(["Una lega.", "Più competizioni.", "Una sola app."], 86, 236, 70, 900, "#ffffff", 1.06)}
    <text x="86" y="475" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="rgba(255,255,255,.78)">Chat, classifica, rosa e dati nello stesso posto.</text>
    <g filter="url(#phoneShadow)">
      <rect x="324" y="540" width="432" height="632" rx="56" fill="#0d1218"/>
      <rect x="344" y="564" width="392" height="584" rx="40" fill="#ffffff"/>
      <clipPath id="phoneClip"><rect x="344" y="564" width="392" height="584" rx="40"/></clipPath>
      <image href="${home}" x="344" y="564" width="392" height="682" preserveAspectRatio="xMidYMin slice" clip-path="url(#phoneClip)"/>
    </g>
    <rect x="320" y="1204" width="440" height="58" rx="29" fill="#e8f8ee" stroke="#b7efc8"/>
    <text x="540" y="1242" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" fill="${green}">BETA IN ARRIVO</text>
    <text x="540" y="1302" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900" fill="${text}">Il fanta non finisce al campionato.</text>
  </svg>`;
  await renderSvg("post-03-soluzione.png", svg);
}

(async () => {
  await post1();
  await post2();
  await post3();
})();
