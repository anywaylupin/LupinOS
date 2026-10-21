// Draws a 1200x630 preview image for every shareable route into public/og. Run it after
// changing titles or projects: pnpm --filter @lupinos/site og
// The images are committed, so the deploy build needs no fonts or image tools.
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { owner, projects } from "../src/content/owner.ts";
import { apps } from "../src/os/apps.ts";

const routes = [
  { slug: "home", title: "LupinOS", sub: `${owner.name}, ${owner.role}. The portfolio is an operating system.` },
  { slug: "plain", title: `${owner.name}`, sub: `${owner.role}. Projects, resume and contact.` },
  ...Object.values(apps)
    .filter((a) => !a.hidden)
    .map((a) => ({ slug: a.id, title: a.name, sub: a.description })),
  ...["projects", "desktop", "home"].map((f) => ({ slug: `files-${f}`, title: f[0].toUpperCase() + f.slice(1), sub: `The ${f} folder in LupinOS.` })),
  ...projects.map((p) => ({ slug: `files-projects-${p.slug}`, title: p.title, sub: p.summary })),
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Breaks a line of text into lines of at most `max` characters, on spaces. */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else line += ` ${word}`;
  }
  return [...lines, line.trim()].slice(0, 3);
}

const svg = (title: string, sub: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c4605a"/><stop offset="0.45" stop-color="#9a3a48"/><stop offset="0.8" stop-color="#4e2441"/><stop offset="1" stop-color="#2a1b2e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.6"><stop offset="0" stop-color="#e8956f"/><stop offset="1" stop-color="#e8956f" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="#fff" stroke-opacity="0.06"/></pattern>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb0a0"/><stop offset="0.3" stop-color="#ffb0a0" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#wall)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <circle cx="960" cy="210" r="170" fill="none" stroke="#fff" stroke-opacity="0.22"/>
  <circle cx="960" cy="210" r="230" fill="none" stroke="#fff" stroke-opacity="0.09"/>
  <path d="M720 630 L1010 0 L1060 0 L770 630 Z" fill="#fff" fill-opacity="0.06"/>
  <path d="M110 120 h880 l26 26 v360 h-880 l-26 -26 z" fill="#fbf2f0" fill-opacity="0.9"/>
  <path d="M110 120 h880 l26 26 v360 h-880 l-26 -26 z" fill="none" stroke="url(#edge)" stroke-width="3"/>
  <rect x="150" y="160" width="46" height="24" rx="5" fill="#c24a3c"/>
  <text x="173" y="178" text-anchor="middle" font-family="Consolas, monospace" font-size="15" font-weight="700" fill="#fff">01</text>
  <text x="212" y="178" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#6b5a5e">${esc(title.toUpperCase())}</text>
  <g transform="translate(150 230) scale(2.2)"><path d="M9 11h9v26H9z M9 28h30v9H9z" fill="#1d1d1f"/><path d="M30 11h9v9h-9z" fill="#c24a3c"/></g>
  <text x="270" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="700" fill="#1d1d1f">${esc(title)}</text>
  ${wrap(sub, 52)
    .map((l, i) => `<text x="270" y="${352 + i * 36}" font-family="Segoe UI, Arial, sans-serif" font-size="27" fill="#5a4a4e">${esc(l)}</text>`)
    .join("\n  ")}
  <text x="150" y="470" font-family="Consolas, monospace" font-size="18" fill="#c24a3c">lupinos · ${esc(owner.name.toLowerCase())}</text>
  <path d="M955 470 l8 -12 M968 470 l8 -12 M981 470 l8 -12" stroke="#c24a3c" stroke-width="3"/>
</svg>`;

mkdirSync(new URL("../public/og/", import.meta.url), { recursive: true });
for (const r of routes) {
  const png = new Resvg(svg(r.title, r.sub), { fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(new URL(`../public/og/${r.slug}.png`, import.meta.url), png);
  console.log(`og/${r.slug}.png  ${Math.round(png.length / 1024)} KB`);
}
