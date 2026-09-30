// Aflæser kompensationsselskabernes prissider og tjekker, at salærerne i src/data/providers.json
// stadig står der. Hver udbyder har et "check" med tekster, der skal findes på siden ("has"),
// og evt. et mønster, der ikke må findes ("not"), fx for udbydere, der i dag ikke oplyser en sats.
//
// Går alle igennem, sættes "checked" til dagens dato, så "aflæst den ..." på sitet er sand.
// Fejler én, røres datoen ikke: datoen gælder alle udbydere, så den må kun flyttes, når alle er bekræftet.
//
// Brug: node scripts/check-fees.mjs   (skriver rapport til fee-report.md og, i GitHub Actions,
// ok=true|false og changed=true|false til $GITHUB_OUTPUT)
import { readFile, writeFile, appendFile } from 'node:fs/promises';

const FILE = 'src/data/providers.json';
const raw = await readFile(FILE, 'utf8');
const data = JSON.parse(raw);
const TODAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date());

// Flyhjælp ligger bag CloudFront, der afviser alt, der ikke ligner en browser.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
};

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', euro: '€', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—' };
// Samme normalisering af sidetekst og søgetekst: små bogstaver, ét mellemrum, "30 %" = "30%".
const norm = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ')
  .replace(/(\d) %/g, '$1%')
  .toLowerCase();
const pageText = (html) => norm(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));

async function fetchText(url) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return pageText(await res.text());
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw last;
}

const results = [];
for (const p of data.providers) {
  const problems = [];
  if (!p.check?.has?.length) problems.push('Ingen "check" i providers.json');
  else {
    try {
      const text = await fetchText(p.priceUrl);
      for (const needle of p.check.has) if (!text.includes(norm(needle))) problems.push(`Mangler: "${needle}"`);
      if (p.check.not) {
        const m = text.match(new RegExp(p.check.not, 'i'));
        if (m) problems.push(`Ny tekst, der ligner en sats: "${m[0]}"`);
      }
    } catch (e) {
      problems.push(`Kunne ikke hente siden: ${e.message}`);
    }
  }
  results.push({ p, problems });
  console.log(`${problems.length ? 'FEJL' : 'OK  '} ${p.name}${problems.map((x) => `\n     ${x}`).join('')}`);
}

const ok = results.every((r) => r.problems.length === 0);
let changed = false;
if (ok && data.checked !== TODAY) {
  // Ret kun datoen i teksten, så filens håndformatering bevares.
  await writeFile(FILE, raw.replace(/"checked": "\d{4}-\d{2}-\d{2}"/, `"checked": "${TODAY}"`));
  changed = true;
}

const report = [
  ok ? `Alle ${results.length} prissider bekræftet ${TODAY}.${changed ? ` "checked" flyttet fra ${data.checked} til ${TODAY}.` : ''}`
    : `Salærerne kunne ikke bekræftes ${TODAY}. "checked" står stadig på ${data.checked}, så sitet viser den dato, indtil tallene er tjekket.`,
  '',
  '| Udbyder | Side | Resultat |',
  '|---|---|---|',
  ...results.map(({ p, problems }) => `| ${p.name} | ${p.priceUrl} | ${problems.length ? problems.join('<br>').replace(/\|/g, '\\|') : 'OK'} |`),
  '',
  ok ? '' : 'Gå siderne igennem. Har en udbyder ændret salær, så ret tallene og teksten i `src/data/providers.json`. Har de kun ændret formuleringen, så ret `check.has` / `check.not`. Kør derefter workflowet "Tjek salærer" igen.',
].join('\n');

await writeFile('fee-report.md', report + '\n');
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `ok=${ok}\nchanged=${changed}\n`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n');
console.log(`\n${ok ? 'Alle bekræftet' : 'Ikke alle bekræftet'}. checked: ${changed ? `${data.checked} -> ${TODAY}` : data.checked}`);
