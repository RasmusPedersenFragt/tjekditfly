// Kvalitetstjek af det byggede site. Kør: node scripts/test-pages.mjs   (fejler med exit 1 ved problemer)
//  - JSON-LD er gyldig JSON med Organization, WebSite med SearchAction og WebPage/FAQPage
//  - BreadcrumbList matcher den synlige brødkrumme
//  - FAQPage har mindst ét spørgsmål, og spørgsmålene findes i den synlige tekst
//  - præcis ét <h1>, og overskrifter springer ikke niveauer over
//  - canonical, title og meta description findes; ingen "undefined"/"NaN"; ingen uerstattede {{pladsholdere}}
//  - interne links peger på sider, der findes
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function* walk(dir) { for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) yield* walk(p); else if (e.name === 'index.html' || e.name === '404.html') yield p; } }
const errors = [];
let n = 0, withFaq = 0, withCrumb = 0;
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const links = new Set();
for await (const file of walk('public')) {
  n++;
  const html = await readFile(file, 'utf8');
  const rel = file.replace(/\\/g, '/').replace(/^public/, '');
  const fail = (m) => errors.push(`${rel}: ${m}`);
  const t = text(html);
  if (/undefined|NaN|\[object Object\]/.test(t)) fail('indeholder undefined/NaN/[object Object]');
  if (/\{\{[A-Z_a-z]+\}\}/.test(html)) fail('uerstattet pladsholder: ' + html.match(/\{\{[A-Z_a-z]+\}\}/)[0]);
  if (!/<link rel="canonical" href="https:\/\/tjekditfly\.dk\//.test(html)) fail('mangler canonical');
  if (!/<title>[^<]{10,}<\/title>/.test(html)) fail('mangler eller for kort title');
  const tl = html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
  if (tl.length > 70 && !rel.startsWith('/rute/') && !rel.startsWith('/flyselskab/') && !rel.startsWith('/lufthavn/')) fail(`title er ${tl.length} tegn`);
  if (!/<meta name="description" content="[^"]{30,}"/.test(html)) fail('mangler eller for kort description');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(`${h1} h1-elementer`);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { fail(`overskrift springer fra h${levels[i - 1]} til h${levels[i]}`); break; }
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) links.add(m[1]);
  const ldm = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ldm) { fail('mangler JSON-LD'); continue; }
  let ld;
  try { ld = JSON.parse(ldm[1]); } catch (e) { fail('JSON-LD er ikke gyldig JSON: ' + e.message); continue; }
  const graph = ld['@graph'];
  if (!Array.isArray(graph)) { fail('JSON-LD mangler @graph'); continue; }
  if (!graph.some((x) => x['@type'] === 'Organization')) fail('JSON-LD mangler Organization');
  const site = graph.find((x) => x['@type'] === 'WebSite');
  if (!site?.potentialAction?.target?.urlTemplate?.includes('{til}')) fail('WebSite mangler SearchAction');
  const page = graph.find((x) => x['@type'] === 'WebPage' || x['@type'] === 'FAQPage');
  if (!page) fail('JSON-LD mangler WebPage/FAQPage');
  else if (!/^\d{4}-\d{2}-\d{2}/.test(page.dateModified || '')) fail('dateModified mangler eller er ikke en dato');
  const crumb = graph.find((x) => x['@type'] === 'BreadcrumbList');
  if (crumb) {
    withCrumb++;
    const visible = html.match(/<p class="crumbs">([\s\S]*?)<\/p>/)?.[1];
    if (!visible) fail('BreadcrumbList uden synlig brødkrumme');
    else { const last = crumb.itemListElement.at(-1)?.name; if (last && !text(visible).includes(last.slice(0, 12))) fail(`BreadcrumbList "${last}" matcher ikke den synlige brødkrumme`); }
  }
  if (page?.['@type'] === 'FAQPage') {
    withFaq++;
    const qs = page.mainEntity || [];
    if (!qs.length) fail('FAQPage uden spørgsmål');
    for (const q of qs) if (!t.includes(q.name)) fail(`FAQ-spørgsmål ikke synligt: ${q.name}`);
  }
}
// Interne links
let broken = 0;
for (const l of links) {
  if (l.startsWith('/assets/') || l.startsWith('/data/')) continue;
  const target = l.endsWith('/') ? path.join('public', l, 'index.html') : path.join('public', l);
  try { await stat(target); } catch { broken++; if (broken <= 20) errors.push(`dødt internt link: ${l}`); }
}
console.log(`Testet ${n} sider: ${withCrumb} med BreadcrumbList, ${withFaq} FAQPage, ${links.size} interne linkmål. ${errors.length ? errors.length + ' fejl:' : 'Ingen fejl.'}`);
for (const e of errors.slice(0, 40)) console.log('  ' + e);
if (errors.length) process.exit(1);
