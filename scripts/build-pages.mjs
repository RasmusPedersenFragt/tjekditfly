// Genererer alle HTML-sider i public/ ud fra src/template.html:
//   - faste sider fra src/pages/*.html (med pladsholdere som {{FAQ}})
//   - /situation/<x>/                 fem situationer
//   - /flyselskab/<selskab>/          én pr. selskab, plus /flyselskab/<selskab>/<situation>/ for fire situationer
//   - /lufthavn/<by>/                 de fire danske afgangslufthavne med alle ruter
//   - /rute/<fra>-<til>/              én pr. rute i src/data/airports.json med afstand og beløb regnet ved build
//   - sitemap.xml og llms.txt
// Kør: STYLE_V=... APP_V=... node scripts/build-pages.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { haversineKm, compensationFor, dkk, EUR_DKK } from '../src/lib/eu261.mjs';

const SITE = 'https://tjekditfly.dk';
const STYLE_V = process.env.STYLE_V || 'dev';
const APP_V = process.env.APP_V || 'dev';
const TODAY = new Date().toISOString().slice(0, 10);
const RULES_DATE = 'september 2026';

const template = await readFile('src/template.html', 'utf8');
const { airports, routes } = JSON.parse(await readFile('src/data/airports.json', 'utf8'));
const airlines = JSON.parse(await readFile('src/data/airlines.json', 'utf8'));
const providersFile = JSON.parse(await readFile('src/data/providers.json', 'utf8'));
const affiliates = JSON.parse(await readFile('src/data/affiliates.json', 'utf8'));
const site = JSON.parse(await readFile('src/data/site.json', 'utf8'));
if (!site.address || !site.owner || !site.email) console.warn('ADVARSEL: src/data/site.json mangler owner, address eller email (e-handelslovens § 7).');
const identityHtml = () => `${esc(site.name)} udgives af ${esc(site.owner)}${site.cvr ? ', CVR-nr. ' + esc(site.cvr) : ''}${site.address ? ', ' + esc(site.address) : ''}. E-mail: <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>.`;
const A = Object.fromEntries(airports.map((a) => [a.iata, a]));

// ---------- hjælpere ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slug = (s) => String(s).toLowerCase().replace(/æ|ä/g, 'ae').replace(/ø|ö/g, 'oe').replace(/å/g, 'aa').replace(/ü/g, 'ue').replace(/[éèê]/g, 'e').replace(/[áà]/g, 'a').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aSlug = (a) => (a.dk ? slug(a.city) : slug(a.name));
const fmt = (n) => Math.round(n).toLocaleString('da-DK');
const eurKr = (eur) => `${eur} € (cirka ${fmt(dkk(eur))} kr)`;
const gitDate = (file) => { try { return execSync(`git log -1 --format=%cI -- "${file}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().slice(0, 10) || TODAY; } catch { return TODAY; } };

const NAV = [['/beregn/', 'Beregn dit krav'], ['/flyselskab/', 'Flyselskaber'], ['/lufthavn/', 'Lufthavne'], ['/klag-selv/', 'Klag selv'], ['/sammenlign/', 'Få hjælp'], ['/om/', 'Om']];
const nav = (current) => NAV.map(([href, label]) => `<a href="${href}"${current === href || (href !== '/' && current.startsWith(href) && href !== '/om/') ? ' aria-current="page"' : ''}>${label}</a>`).join('');
const pages = [];
const ORG_ID = SITE + '/#organization', SITE_ID = SITE + '/#website';

function buildJsonLd({ p, title, description, dateModified, breadcrumb, faq, extra }) {
  const graph = [
    { '@type': 'Organization', '@id': ORG_ID, name: 'Tjek dit fly', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/favicon.svg' }, founder: { '@type': 'Person', name: 'Rasmus Pedersen' }, email: 'kontakt@tjekditfly.dk', areaServed: 'DK', knowsAbout: ['EU-forordning 261/2004', 'flykompensation', 'passagerrettigheder'] },
    { '@type': 'WebSite', '@id': SITE_ID, name: 'Tjek dit fly', url: SITE + '/', inLanguage: 'da', publisher: { '@id': ORG_ID },
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: SITE + '/beregn/?fra={fra}&til={til}' }, 'query-input': ['required name=fra', 'required name=til'] } },
  ];
  const page = { '@type': faq?.length ? 'FAQPage' : 'WebPage', '@id': SITE + p + '#webpage', url: SITE + p, name: title, description, inLanguage: 'da', isPartOf: { '@id': SITE_ID }, publisher: { '@id': ORG_ID }, dateModified: dateModified || TODAY, about: { '@type': 'Legislation', name: 'Forordning (EF) nr. 261/2004', legislationIdentifier: '32004R0261', url: 'https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:32004R0261' } };
  if (breadcrumb?.length) {
    page.breadcrumb = { '@id': SITE + p + '#breadcrumb' };
    graph.push({ '@type': 'BreadcrumbList', '@id': SITE + p + '#breadcrumb', itemListElement: breadcrumb.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + href })) });
  }
  if (faq?.length) page.mainEntity = faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } }));
  graph.push(page);
  for (const e of extra || []) graph.push(e);
  return { '@context': 'https://schema.org', '@graph': graph };
}

async function emit({ path: p, title, description, body, file, dateModified, breadcrumb, faq, extra }) {
  const out = file || path.join('public', p.replace(/^\//, ''), 'index.html');
  await mkdir(path.dirname(out), { recursive: true });
  const ld = buildJsonLd({ p, title, description, dateModified, breadcrumb, faq, extra });
  const crumbs = breadcrumb?.length ? `<p class="crumbs">${breadcrumb.map(([n, h], i) => (i === breadcrumb.length - 1 ? `<span aria-current="page">${esc(n)}</span>` : `<a href="${h}">${esc(n)}</a>`)).join(' › ')}</p>` : '';
  const html = template
    .replaceAll('{{canonical}}', SITE + p).replaceAll('{{title}}', esc(title)).replaceAll('{{description}}', esc(description))
    .replaceAll('{{site}}', SITE).replaceAll('{{path}}', p).replaceAll('{{styleV}}', STYLE_V).replaceAll('{{rulesDate}}', RULES_DATE).replace('{{identity}}', identityHtml())
    .replace('{{jsonld}}', JSON.stringify(ld).replace(/<\//g, '<\\/')).replace('{{nav}}', nav(p))
    .replace('{{body}}', crumbs + body.replaceAll('/assets/app.js"', `/assets/app.js?v=${APP_V}"`));
  await writeFile(out, html);
  if (!file) pages.push({ path: p, lastmod: dateModified || TODAY });
}

const faqHtml = (faq) => faq.map(({ q, a }) => `<details><summary>${esc(q)}</summary><div><p>${a}</p></div></details>`).join('\n');

/** Tilbudsboksen til Flyhjælp. Link og mærkning styres af src/data/affiliates.json. */
const FH = affiliates.flyhjaelp;
const FHP = providersFile.providers.find((p) => p.slug === 'flyhjaelp');
const FH_FEE = `${FHP.fee} %`;
const FH_CHECKED = new Date(providersFile.checked).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
const fhRel = FH.affiliate ? 'nofollow sponsored noopener' : 'noopener';
const fhNote = FH.affiliate ? `Annoncelink: vi får betaling, når du opretter en sag. <a href="/annoncelinks/">Sådan tjener siden penge</a>.` : `Almindeligt link. Vi har ingen aftale med Flyhjælp endnu; <a href="/annoncelinks/">læs mere</a>.`;
const fhFeeNote = `Salær aflæst på flyhjaelp.dk den ${FH_CHECKED}.`;
function ctaBox({ h, p, btn = 'Start din sag hos Flyhjælp' } = {}) {
  return `<aside class="cta"><div><h2>${esc(h || 'Vil du have hjælp til at kræve pengene?')}</h2><p>${p || `Flyhjælp er et dansk selskab, der tager sagen mod flyselskabet for dig. De tager ${FH_FEE} af kompensationen inkl. moms, og kun hvis du får pengene. Får du ingen kompensation, koster det ikke noget. Det tager et par minutter at oprette sagen.`} <span class="small muted">${fhFeeNote}</span></p></div><div class="cta-actions"><span class="mark">${fhNote}</span><a class="btn big" href="${esc(FH.url)}" target="_blank" rel="${fhRel}">${esc(btn)}</a><a class="btn secondary" href="/klag-selv/">Eller klag selv, gratis</a></div></aside>`;
}
const ctaJson = JSON.stringify({ h: 'Vil du have hjælp til at kræve pengene?', p: `Flyhjælp er et dansk selskab, der tager sagen mod flyselskabet for dig. De tager ${FH_FEE} af kompensationen inkl. moms, og kun hvis du får pengene. Får du ingen kompensation, koster det ikke noget. ${fhFeeNote}`, url: FH.url, rel: fhRel, btn: 'Start din sag hos Flyhjælp', note: fhNote });

// ---------- fælles FAQ ----------
const FAQ_GENERAL = [
  { q: 'Hvor meget kan jeg få i kompensation for et forsinket fly?', a: '250 € på ruter op til 1.500 km, 400 € på ruter fra 1.500 til 3.500 km og 600 € på ruter over 3.500 km uden for EU. Det svarer til cirka 1.865, 2.985 og 4.475 kr pr. person. Beløbet er uafhængigt af billetprisen.' },
  { q: 'Hvor forsinket skal flyet være, før jeg har krav på kompensation?', a: 'Mindst 3 timer ved ankomsten til din endelige destination. Det er ankomsten, der tæller, ikke afgangen. Ved skift måles forsinkelsen ved den sidste lufthavn på billetten.' },
  { q: 'Gælder reglerne også for lavprisselskaber som Ryanair og Wizz Air?', a: 'Ja. EU-forordning 261/2004 gælder for alle selskaber, der flyver fra en EU-lufthavn, og beløbet er det samme uanset billetprisen. En billet til 199 kr giver samme kompensation som en til 3.000 kr.' },
  { q: 'Gælder reglerne på en pakkerejse eller charterrejse?', a: 'Ja. Kompensationen for selve flyvningen gælder også charterfly og fly, der er en del af en pakkerejse. Kravet rettes mod flyselskabet, fx Sunclass eller Jet Time, ikke mod rejsebureauet. Rejsebureauet hæfter til gengæld for resten af pakkerejsen efter pakkerejseloven.' },
  { q: 'Hvor lang tid tilbage kan jeg søge kompensation?', a: 'I Danmark forældes kravet efter 3 år. Du kan altså søge for rejser, der ligger op til 3 år tilbage, hvis du kan dokumentere dem med booking og flynummer.' },
  { q: 'Skal jeg betale for at få kompensationen?', a: 'Nej, ikke hvis du klager selv. Det er gratis at skrive til flyselskabet og at klage til Trafikstyrelsen. Bruger du et kompensationsselskab, tager de typisk 30 % af beløbet, og kun hvis de vinder sagen.' },
  { q: 'Hvad hvis flyselskabet siger, det var vejret?', a: 'Vejr, der reelt umuliggør flyvningen, er som regel en usædvanlig omstændighed. Men selskabet skal både dokumentere vejret ved netop din flyvning og vise, at det ikke kunne have undgået forsinkelsen, fx ved at ombooke dig hurtigere. Bed om begge dele skriftligt. Du har uanset ret til forplejning, ombookning eller refusion.' },
];
const FAQ_RULES = [
  { q: 'Hvad er EU-forordning 261/2004?', a: 'Det er EU-reglerne om flypassagerers rettigheder ved forsinkelse, aflysning og nægtet boarding. Forordningen gælder direkte i alle EU-lande samt Norge, Island og Schweiz, og den giver ret til kompensation på 250, 400 eller 600 €, forplejning, ombookning og refusion.' },
  { q: 'Tæller afgangen eller ankomsten?', a: 'Ankomsten til din endelige destination. EU-Domstolen fastslog i Sturgeon-sagen (2009), at en forsinkelse på mindst 3 timer ved ankomsten giver samme ret til kompensation som en aflysning. Ankomst er, når flyets dør åbnes.' },
  { q: 'Hvad er en usædvanlig omstændighed?', a: 'En begivenhed, der ikke er en del af flyselskabets normale drift, og som selskabet ikke kunne have undgået med rimelige forholdsregler. Vejr, flyvelederstrejke, fugle, lukket luftrum og sikkerhedsrisici er eksempler. Tekniske fejl, manglende besætning og strejke blandt selskabets eget personale er ikke.' },
  { q: 'Er strejke en usædvanlig omstændighed?', a: 'Det afhænger af, hvem der strejker. Strejker flyselskabets eget personale, piloter eller kabinepersonale, er det ifølge EU-Domstolen (Airhelp mod SAS, 2021) en del af selskabets normale drift, og du har krav på kompensation. Strejker flyveledere, lufthavnspersonale eller sikkerhedskontrollen, er det som regel uden for selskabets kontrol, og kompensationen bortfalder, hvis selskabet også kan vise, at det ikke kunne have undgået forsinkelsen.' },
  { q: 'Hvad hvis jeg missede mit videre fly på grund af forsinkelsen?', a: 'Er begge fly på samme billet, måles forsinkelsen ved din endelige destination. Nåede du frem 3 timer eller mere for sent, har du krav på kompensation ud fra hele rutens længde, også hvis det første fly kun var 40 minutter forsinket (Folkerts-sagen, 2013). Er flyene købt separat, er de to adskilte rejser.' },
  { q: 'Hvad hvis selskabet gav mig en voucher eller mad i lufthavnen?', a: 'Forplejning og vouchers til mad er en rettighed, du har ved siden af kompensationen, ikke i stedet for. Tilbyder selskabet en rejsevoucher i stedet for kontanter, må du sige nej og kræve pengene. Vouchers kræver dit skriftlige samtykke.' },
  { q: 'Hvad hvis jeg ikke bor i Danmark, men fløj fra Danmark?', a: 'Reglerne gælder for flyvningen, ikke for passagerens bopæl. Alle, der flyver fra en EU-lufthavn, er dækket, og klagemyndigheden er i det land, flyet afgik fra.' },
];
const FAQ_SELF = [
  { q: 'Hvor lang tid går der, før flyselskabet svarer?', a: 'De fleste svarer inden for 2 til 6 uger. Nogle lavprisselskaber svarer først efter flere rykkere. Får du intet svar efter 6 uger, kan du klage til Trafikstyrelsen med henvisning til, at selskabet ikke har svaret.' },
  { q: 'Hvad koster det at klage til Trafikstyrelsen?', a: 'Det er gratis. Trafikstyrelsen er den danske myndighed for fly, der afgår fra Danmark eller lander i Danmark fra et land uden for EU med et EU-selskab. De træffer afgørelse i sagen, og de fleste selskaber følger den. Afgik flyet fra et andet EU-land, er det landets myndighed, du skal bruge.' },
  { q: 'Skal jeg have advokat for at gå i retten?', a: 'Nej. Krav op til 100.000 kr behandles efter den forenklede proces ved byretten (retsplejelovens kapitel 39), hvor retten hjælper med at forberede sagen, og du kan møde uden advokat. Retsafgiften er 750 kr, som modparten som udgangspunkt skal betale, hvis du vinder.' },
  { q: 'Kan jeg klage på vegne af hele familien?', a: 'Ja, hvis I rejste på samme booking. Skriv alle passagerer i samme mail. Børn med egen billet har krav på fuldt beløb. Spædbørn uden eget sæde har ikke krav på kompensation.' },
  { q: 'Hvad hvis jeg har smidt boardingkortet ud?', a: 'Bookingbekræftelsen og bookingnummeret er nok. Flyselskabet har selv passagerlisten og ved, at du var med. Forsinkelsen kan dokumenteres via offentlige flydata, hvis selskabet bestrider den.' },
];
const FAQ_COMPARE = [
  { q: 'Hvad betyder no cure, no pay?', a: 'At du kun betaler, hvis selskabet får kompensationen hjem. Får du ingen penge, skylder du ikke noget. Læs dog vilkårene: hos nogle selskaber skal du betale salæret, hvis flyselskabet betaler direkte til dig, efter du har oprettet sagen.' },
  { q: 'Hvorfor er salæret højere ved retssag?', a: 'Fordi selskabet betaler retsafgift og advokat og bærer risikoen for at tabe. De fleste lægger 10 til 15 procentpoint oveni. Flyret oplyser på sin side, at salæret er det samme ved retssag.' },
  { q: 'Kan jeg skifte selskab midt i sagen?', a: 'Som regel ikke uden at betale. Når du har overdraget kravet eller givet fuldmagt, har selskabet ret til salæret, hvis sagen vindes, også hvis du selv får pengene. Vælg derfor ét selskab, og spørg til opsigelse, før du skriver under.' },
  { q: 'Er det bedre at klage selv?', a: 'Hvis du har tid, og flyselskabet er dansk eller skandinavisk, ja. Det er gratis, og mange sager løses ved første eller anden mail. Er selskabet udenlandsk, har det afvist én gang, eller skal sagen i retten, er 30 % ofte givet godt ud.' },
];

// ---------- forsiden og faste sider ----------
const dkAirports = airports.filter((a) => a.dk && routes[a.iata]);
const destOptions = (from) => {
  const list = airports.filter((a) => a.iata !== from);
  const grp = (label, items) => (items.length ? `<optgroup label="${label}">${items.map((a) => `<option value="${a.iata}">${esc(a.name)}${a.dk ? '' : ', ' + esc(a.country)}</option>`).join('')}</optgroup>` : '');
  return grp('Danmark', list.filter((a) => a.dk)) + grp('Udlandet', list.filter((a) => !a.dk));
};
const STATIC = [
  ['index', '/', 'Forsinket eller aflyst fly? Tjek dit krav | Tjek dit fly', 'Gratis beregner: se om du har krav på 250, 400 eller 600 € for forsinket, aflyst eller overbooket fly, og hvordan du får pengene. Reglerne forklaret på dansk.', { faq: FAQ_GENERAL }],
  ['beregn', '/beregn/', 'Beregn din flykompensation: rute, forsinkelse og årsag | Tjek dit fly', 'Vælg rute og det, der skete. Beregneren viser beløbet efter EU-forordning 261/2004 og de undtagelser, flyselskabet kan bruge. Kører i din browser, intet gemmes.'],
  ['regler', '/regler/', 'Reglerne for flykompensation (EU261) forklaret på dansk | Tjek dit fly', 'Hvornår har du krav på 250, 400 eller 600 €? Forsinkelse, aflysning, nægtet boarding, usædvanlige omstændigheder og forældelse, med EU-Domstolens afgørelser.', { faq: FAQ_RULES }],
  ['klag-selv', '/klag-selv/', 'Klag selv over forsinket eller aflyst fly: skabelon | Tjek dit fly', 'Sådan kræver du kompensation hos flyselskabet uden salær. Skabelon på dansk og engelsk, klage til Trafikstyrelsen og den forenklede proces ved byretten.', { faq: FAQ_SELF }],
  ['sammenlign', '/sammenlign/', 'Sammenlign 8 selskaber, der henter flykompensation | Tjek dit fly', 'Otte selskaber, der henter flykompensation mod salær. Sammenlignet på salær, salær ved retssag og hvad du får udbetalt. Gebyrer tjekket ' + providersFile.checked + '.', { faq: FAQ_COMPARE }],
  ['om', '/om/', 'Om Tjek dit fly og Rasmus Pedersen', 'Hvem står bag Tjek dit fly, hvor oplysningerne kommer fra, og hvordan siden arbejder.'],
  ['annoncelinks', '/annoncelinks/', 'Sådan tjener Tjek dit fly penge: annoncelinks og hvad de betyder', 'Tjek dit fly skal finansieres af annoncelinks. Her kan du læse præcis hvordan, hvilke aftaler der findes lige nu, og hvad det betyder for indholdet.'],
  ['privatliv', '/privatliv/', 'Privatlivspolitik | Tjek dit fly', 'Hvilke data Tjek dit fly behandler, og hvilke der ikke behandles. Ingen sporingscookies, beregneren kører i din browser.'],
  ['kontakt', '/kontakt/', 'Kontakt Tjek dit fly', 'Skriv til Tjek dit fly med rettelser, forslag eller spørgsmål til siden.'],
];
const providerTable = () => {
  const ps = [...providersFile.providers].sort((x, y) => ((x.fee ?? 99) - (y.fee ?? 99)) || ((x.feeCourt ?? 99) - (y.feeCourt ?? 99)) || x.name.localeCompare(y.name, 'da'));
  const pct = (v) => (v == null ? '<span class="muted">Ikke oplyst</span>' : `${v} %`);
  return `<div class="table-wrap"><table>
<thead><tr><th>Selskab</th><th class="num">Salær</th><th class="num">Ved retssag</th><th>Sådan oplyses det</th><th>Bemærkning</th><th>Kilde</th></tr></thead>
<tbody>${ps.map((p) => `<tr><td><strong>${esc(p.name)}</strong><br><span class="muted small">${esc(p.based)}</span></td><td class="num">${pct(p.fee)}</td><td class="num">${pct(p.feeCourt)}</td><td>${esc(p.feeNote)}</td><td>${p.extras ? `${esc(p.extras)}${p.extrasUrl ? ` <a href="${esc(p.extrasUrl)}" rel="noopener" target="_blank">Kilde</a>.` : ''}` : '<span class="muted">–</span>'}</td><td><a href="${esc(p.priceUrl)}" target="_blank" rel="noopener">${esc(p.source)}</a><br><span class="small muted">aflæst ${FH_CHECKED}</span>${p.slug === 'flyhjaelp' ? `<br><span class="small">${FH.affiliate ? 'Annoncelink' : 'Ingen betalt aftale'}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
};
const affiliateStatus = () => FH.affiliate
  ? `<p>Siden har én annonceaftale: <strong>Flyhjælp</strong>, via ${esc(FH.network)}, siden ${esc(FH.since)}. Knapperne "Start din sag hos Flyhjælp" er annoncelinks. Opretter du en sag hos Flyhjælp efter at have klikket, får vi et fast beløb, når sagen er oprettet og underskrevet. Alle andre links på siden, også til de øvrige kompensationsselskaber i sammenligningen, er almindelige links uden provision.</p>`
  : `<p>Pr. ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })} har siden <strong>ingen annonceaftaler</strong>. Knapperne "Start din sag hos Flyhjælp" er almindelige links, som ikke giver os noget. Vi har valgt at linke til Flyhjælp, fordi de er danske og oplyser deres salær åbent, og vi søger om optagelse i deres partnerprogram via netværket Adtraction. Bliver aftalen godkendt, bliver knapperne mærket "Annoncelink", og datoen for aftalen kommer til at stå her.</p>`;

for (const [file, p, title, description, opts = {}] of STATIC) {
  let body = await readFile(`src/pages/${file}.html`, 'utf8');
  body = body.replace('{{DK_OPTIONS}}', [...dkAirports].sort((x, y) => (x.iata === 'CPH' ? -1 : y.iata === 'CPH' ? 1 : 0)).map((a) => `<option value="${a.iata}"${a.iata === 'CPH' ? ' selected' : ''}>${esc(a.name)}</option>`).join(''))
    .replace('{{DEST_OPTIONS}}', destOptions('CPH'))
    .replace('{{AIRLINE_PILLS}}', airlines.map((al) => `<li><a href="/flyselskab/${al.slug}/">${esc(al.name)}</a></li>`).join(''))
    .replace('{{AIRLINES_JSON}}', JSON.stringify(airlines.map(({ slug, name, zone }) => ({ slug, name, zone }))).replace(/<\//g, '<\\/'))
    .replace('{{CTA_JSON}}', ctaJson.replace(/<\//g, '<\\/'))
    .replace('{{CTA}}', ctaBox())
    .replace('{{CHECKED}}', new Date(providersFile.checked).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }))
    .replace('{{PROVIDER_TABLE}}', providerTable())
    .replace('{{AFFILIATE_STATUS}}', affiliateStatus())
    .replaceAll('{{IDENTITY}}', identityHtml())
    .replace('{{FH_DISCLOSURE}}', FH.affiliate ? '<strong>Annoncepartner:</strong> vi får betaling, når du opretter en sag hos Flyhjælp via vores link.' : '<strong>Ingen betalt aftale i dag:</strong> linket til Flyhjælp giver os intet lige nu.')
    .replace('{{FAQ}}', opts.faq ? faqHtml(opts.faq) : '');
  await emit({ path: p, title, description, body, faq: opts.faq, dateModified: gitDate(`src/pages/${file}.html`) });
}
{ const body = await readFile('src/pages/404.html', 'utf8'); await emit({ path: '/404.html', title: 'Siden findes ikke | Tjek dit fly', description: 'Adressen findes ikke på Tjek dit fly. Find vej til beregneren, situationerne og flyselskaberne.', body, file: 'public/404.html' }); }

// ---------- situationer ----------
const SITUATIONS = {
  forsinket: { name: 'Forsinket fly', short: 'forsinkelse', seo: 'Forsinket fly: kompensation fra 3 timers forsinkelse', title: 'Forsinket fly: kompensation op til 600 € fra 3 timers forsinkelse',
    answer: 'Ankommer du mindst <strong>3 timer</strong> for sent til din endelige destination, har du krav på <strong>250, 400 eller 600 €</strong> pr. person afhængigt af rutens længde, medmindre selskabet kan bevise en usædvanlig omstændighed som vejr eller flyvelederstrejke. Fra 2 timer har du ret til mad og drikke, fra 5 timer kan du få billetten refunderet.',
    body: `<h2>Sådan måles forsinkelsen</h2><p>Det er <strong>ankomsten</strong>, der tæller, ikke afgangen. Ankomst betyder det tidspunkt, hvor mindst én af flyets døre åbnes ved gaten, ikke landingen. Var flyet 2 timer og 50 minutter forsinket ved døren, har du ikke krav på kompensation; var det 3 timer og 5 minutter, har du. Tag et billede af uret, når døren åbner, eller notér tiden, og gem boardingkortet.</p><p>Havde du skift på samme billet, måles forsinkelsen ved den <strong>sidste lufthavn</strong>. Et fly fra København til Amsterdam, der var 50 minutter forsinket og fik dig til at misse flyet til New York, så du ankom 7 timer senere end planlagt, giver 600 €, fordi hele rejsen København–New York regnes som én flyvning.</p>
<h2>Dine rettigheder time for time</h2><div class="table-wrap"><table><thead><tr><th>Forsinkelse</th><th>Det har du ret til</th></tr></thead><tbody>
<tr><td>Fra 2 timer</td><td>Mad og drikke i rimeligt forhold til ventetiden, to telefonopkald eller e-mails. Gælder fra 2 timer på ruter op til 1.500 km, 3 timer på 1.500 til 3.500 km og 4 timer derover.</td></tr>
<tr><td>Fra 3 timer</td><td>Kompensation på 250, 400 eller 600 €, medmindre selskabet beviser en usædvanlig omstændighed.</td></tr>
<tr><td>Fra 5 timer</td><td>Ret til at opgive rejsen og få billetten refunderet inden 7 dage, samt en returflyvning til udgangspunktet, hvis rejsen har mistet sit formål.</td></tr>
<tr><td>Overnatning</td><td>Hotel og transport mellem lufthavn og hotel, uanset årsag til forsinkelsen.</td></tr></tbody></table></div>
<h2>Det, selskaberne siger, og hvad der holder</h2><p>Den hyppigste afvisning er "operationelle årsager" eller "usædvanlige omstændigheder" uden nærmere forklaring. Bed altid om at få årsagen konkretiseret. Tekniske fejl, manglende besætning, forsinket indkommende fly og selskabets egen strejke holder ikke som undtagelse. Vejr, flyvelederstrejke, fugle og lukket luftrum gør som regel, men kun med dokumentation for netop din flyvning og for, at forsinkelsen ikke kunne undgås. <a href="/regler/">Se hele listen</a>.</p>`,
    faq: [
      { q: 'Tæller forsinkelsen fra afgang eller ankomst?', a: 'Fra ankomsten til din endelige destination. Et fly, der afgik 3 timer for sent, men indhentede en halv time i luften, giver ikke kompensation. Omvendt giver et fly, der afgik til tiden, men blev omdirigeret og landede 3 timer for sent, kompensation.' },
      { q: 'Jeg var kun 2 timer og 55 minutter forsinket. Har jeg krav på noget?', a: 'Ikke på kompensation. Grænsen på 3 timer er skarp. Du har ret til forplejning og til at få udgifter til mad dækket, hvis selskabet ikke sørgede for det. Tjek dog ankomsttiden præcist; selskabernes egne tal er ofte landingstiden, og døren åbnes 5 til 15 minutter senere.' },
      { q: 'Hvad hvis forsinkelsen betød, at jeg missede et hotel eller en krydstogtafgang?', a: 'Kompensationen dækker ulejligheden, ikke følgeudgifter. Tabte hotelovernatninger og lignende kan kræves som erstatning efter Montreal-konventionen, hvis selskabet ikke gjorde alt for at undgå forsinkelsen, men det er en anden og vanskeligere sag. Rejseforsikringen dækker ofte netop den slags.' },
      { q: 'Har børn krav på fuld kompensation?', a: 'Ja, alle passagerer med egen billet og eget sæde har krav på det fulde beløb. Spædbørn på skødet uden egen billet har ikke.' },
    ] },
  aflyst: { name: 'Aflyst fly', short: 'aflysning', seo: 'Aflyst fly: refusion, ny billet og kompensation', title: 'Aflyst fly: refusion, ny billet og kompensation op til 600 €',
    answer: 'Bliver dit fly aflyst, kan du altid vælge mellem <strong>fuld refusion</strong> og <strong>ombookning</strong>. Fik du besked <strong>under 14 dage</strong> før afgang, har du oven i det krav på <strong>250, 400 eller 600 €</strong>, medmindre selskabet tilbød en ombookning tæt på det oprindelige tidspunkt eller kan bevise en usædvanlig omstændighed.',
    body: `<h2>Dit valg: penge tilbage eller ny billet</h2><p>Ved aflysning skal selskabet tilbyde dig valget mellem at få hele billetten refunderet inden 7 dage, at blive ombooket til din destination hurtigst muligt, eller at blive ombooket på en senere dato efter dit valg. Valget er dit, ikke selskabets. Selskabet må ikke nøjes med at tilbyde en voucher; kontanter kræver ikke dit samtykke, en voucher gør.</p><p>Vælger du ombookning, skal selskabet også betale forplejning, mens du venter, og hotel, hvis det nye fly først går næste dag. Ombookningen kan være med et andet selskab, hvis det får dig hurtigere frem.</p>
<h2>Kompensation afhænger af varslet</h2><div class="table-wrap"><table><thead><tr><th>Besked om aflysning</th><th>Kompensation</th></tr></thead><tbody>
<tr><td>14 dage eller mere før afgang</td><td>Nej. Kun refusion eller ombookning.</td></tr>
<tr><td>7 til 13 dage før afgang</td><td>Ja, medmindre du blev tilbudt en ombookning, der afgik højst 2 timer tidligere og ankom højst 4 timer senere end planlagt.</td></tr>
<tr><td>Under 7 dage før, eller i lufthavnen</td><td>Ja, medmindre du blev tilbudt en ombookning, der afgik højst 1 time tidligere og ankom højst 2 timer senere end planlagt.</td></tr></tbody></table></div>
<p>Beskeden skal være givet til dig. Sendte selskabet mailen til rejsebureauet, som ikke gav den videre, hæfter selskabet stadig (Krijgsman-sagen, 2017). Det er selskabet, der skal bevise, hvornår du fik besked.</p>
<h2>Halveret kompensation</h2><p>Ombookes du og når frem højst 2 timer (op til 1.500 km), 3 timer (1.500 til 3.500 km) eller 4 timer (over 3.500 km) senere end planlagt, må selskabet halvere kompensationen til 125, 200 eller 300 €.</p>
<h2>Selskabets undtagelser</h2><p>Aflysninger på grund af vejr, flyvelederstrejke, lukket luftrum eller sikkerhed giver som regel ikke kompensation, men selskabet skal også vise, at det ikke kunne have undgået aflysningen eller ombooket dig hurtigere. Aflysninger på grund af teknik, besætning, egen strejke, for få passagerer eller "operationelle årsager" gør. <a href="/regler/">Se hele listen</a>.</p>`,
    faq: [
      { q: 'Flyet blev aflyst 3 uger før. Har jeg krav på noget?', a: 'Refusion eller ombookning, ja. Kompensation, nej. Med 14 dages varsel eller mere er kompensationen bortfaldet, uanset årsag. Kostede den nye billet mere, fordi du selv måtte købe den, kan du kræve differencen, hvis selskabet ikke tilbød ombookning.' },
      { q: 'Selskabet tilbød kun en voucher. Skal jeg tage den?', a: 'Nej. Du har krav på refusion i penge inden 7 dage. En voucher kræver dit skriftlige samtykke. Skriv, at du ønsker refusion til din konto.' },
      { q: 'Jeg købte selv en ny billet med et andet selskab. Får jeg pengene tilbage?', a: 'Tilbød selskabet ikke en brugbar ombookning, kan du kræve den nye billet dækket som erstatning ud over refusionen af den gamle, hvis prisen var rimelig. Gem kvitteringen og bed først selskabet om at ombooke dig, så du kan dokumentere, at de ikke gjorde det.' },
      { q: 'Kan jeg få kompensation, hvis aflysningen skete dagen før på grund af strejke?', a: 'Strejkede selskabets eget personale, ja. Strejkede flyveledere eller lufthavnen, nej, men du har stadig ret til refusion eller ombookning og forplejning.' },
    ] },
  'naegtet-boarding': { name: 'Nægtet boarding', short: 'nægtet boarding', seo: 'Nægtet boarding: kompensation med det samme', title: 'Nægtet boarding og overbooking: kompensation med det samme',
    answer: 'Blev du afvist ved gaten mod din vilje, selv om du havde bekræftet reservation og var mødt i tide, har du krav på <strong>250, 400 eller 600 €</strong> med det samme, uanset årsag. Der findes ingen undtagelse for usædvanlige omstændigheder ved nægtet boarding. Oven i det har du ret til refusion eller ombookning og forplejning.',
    body: `<h2>Hvornår er det nægtet boarding?</h2><p>Nægtet boarding er, når selskabet afviser at tage dig med, selv om du har en bekræftet reservation og er mødt til check-in og gate i tide. Den almindelige årsag er overbooking: selskabet har solgt flere billetter, end der er sæder. Det kan også være, at flyet er skiftet til en mindre type, eller at besætningen skal have sæderne.</p><p>Det er <strong>ikke</strong> nægtet boarding, hvis du mødte for sent, manglede gyldigt pas eller visum, var påvirket eller udgjorde en sikkerhedsrisiko. Så har du ingen krav.</p>
<h2>Frivillige først</h2><p>Selskabet skal først spørge efter frivillige, der vil afgive deres plads mod en godtgørelse, de aftaler med selskabet. Melder du dig frivilligt, gælder den aftale, og du har ikke krav på den faste kompensation. Overvej, hvad du siger ja til: den faste kompensation er 250 til 600 € plus ombookning, så et tilbud om en voucher på 100 € er dårligt.</p>
<h2>Dine rettigheder</h2><ul><li>Kompensation på 250, 400 eller 600 € <strong>med det samme</strong>, i lufthavnen eller senest inden 7 dage.</li><li>Valget mellem refusion og ombookning til din destination.</li><li>Forplejning, og hotel hvis ombookningen først er næste dag.</li><li>Ombookes du til en lavere klasse, skal 30 % (op til 1.500 km), 50 % (1.500 til 3.500 km og alle ruter inden for EU) eller 75 % (længere ruter uden for EU) af billetprisen refunderes oven i.</li></ul>
<h2>Sørg for dokumentation</h2><p>Bed om en skriftlig bekræftelse på, at du blev nægtet boarding, og på årsagen. Selskabet er forpligtet til at udlevere en skriftlig meddelelse om dine rettigheder. Fotografér boardingkort og opslag ved gaten.</p>`,
    faq: [
      { q: 'Kan selskabet nægte at betale, fordi det var overbooking af tekniske årsager?', a: 'Nej. Ved nægtet boarding findes ingen undtagelse for usædvanlige omstændigheder. Kompensationen skal betales, uanset hvorfor der ikke var plads.' },
      { q: 'Jeg blev nægtet boarding på hjemrejsen, fordi udrejsen var aflyst. Gælder det?', a: 'Ja. Annullerer selskabet din hjemrejse, fordi du ikke brugte udrejsen, og afviser dig ved gaten, er det nægtet boarding (FW mod LATAM Airlines, C-238/22, 2023). Du har krav på kompensation.' },
      { q: 'Tæller det, hvis jeg blev sat af, fordi flyet var for tungt?', a: 'Ja. Vægt- og balanceproblemer, ændret flytype og besætning, der skal have sæderne, er selskabets forhold. Det er nægtet boarding med krav på kompensation.' },
    ] },
  strejke: { name: 'Strejke', short: 'strejke', seo: 'Strejke: har du krav på flykompensation?', title: 'Strejke: hvornår har du krav på kompensation for aflyst eller forsinket fly?',
    answer: 'Det afhænger af, <strong>hvem der strejker</strong>. Strejker flyselskabets eget personale, piloter eller kabinepersonale, har du krav på <strong>250, 400 eller 600 €</strong> ligesom ved enhver anden aflysning; EU-Domstolen afgjorde det i sagen Airhelp mod SAS i 2021. Strejker flyveledere, lufthavnspersonale eller sikkerhedskontrollen, er det som regel en usædvanlig omstændighed, og kompensationen bortfalder, hvis selskabet også kan vise, at det ikke kunne have undgået forsinkelsen, fx ved ombookning. Retten til refusion, ombookning og forplejning gælder altid.',
    body: `<h2>Egen strejke: selskabets ansvar</h2><p>I marts 2021 besvarede EU-Domstolen i sagen <em>Airhelp mod SAS</em> (C-28/20), forelagt af en svensk domstol om SAS-pilotstrejken i 2019, spørgsmålet om strejke som usædvanlig omstændighed. Domstolen fastslog, at en strejke blandt selskabets egne ansatte, også en lovlig og varslet strejke, er en del af selskabets normale drift. Selskabet kan påvirke den gennem forhandling, og den er derfor ikke en usædvanlig omstændighed. Det samme gjaldt allerede for overenskomststridige strejker (Krüsemann mod TUIfly, 2018).</p><p>Konsekvensen: aflyses eller forsinkes dit fly på grund af strejke hos SAS, Lufthansa, Ryanair, Norwegian eller et andet selskabs eget personale, har du krav på kompensation, hvis varslet var under 14 dage, eller forsinkelsen var over 3 timer.</p>
<h2>Ekstern strejke: som regel uden for selskabets kontrol</h2><p>Strejker flyveledere (fx i Frankrig, som ofte rammer fly over fransk luftrum), lufthavnens personale, sikkerhedskontrol eller brændstofleverandører, er det som regel en usædvanlig omstændighed. Men selskabet skal både dokumentere, at netop din flyvning blev ramt, og at forsinkelsen ikke kunne undgås, fx ved ombookning eller omdirigering. Var strejken varslet i god tid, er der ekstra grund til at bede om den dokumentation. Strejke hos handlingpersonale, selskabet selv har hyret, er ikke uden videre uden for dets kontrol. Selskabet skal uanset ombooke dig, refundere eller give forplejning og hotel.</p>
<h2>Det, du skal holde øje med</h2><ul><li><strong>Hvem strejker?</strong> Selskaberne skriver ofte bare "strejke". Spørg, om det var deres eget personale.</li><li><strong>14-dages-reglen.</strong> Aflyser selskabet fly mere end 14 dage før en varslet strejke, bortfalder kompensationen, men ikke retten til refusion.</li><li><strong>Hvem er det transporterende selskab?</strong> Kravet rettes mod det selskab, der faktisk udførte flyvningen (det står på boardingkortet), også når billetten er købt hos et andet selskab eller et rejsebureau.</li><li><strong>Kompensationsselskaberne siger ofte nej til strejkesager</strong>, fordi de er sværere at vinde og betales dårligere. Det betyder ikke, at du ikke har et krav. Overvej at <a href="/klag-selv/">klage selv</a>.</li></ul>`,
    faq: [
      { q: 'SAS aflyste mit fly på grund af pilotstrejke. Har jeg krav på kompensation?', a: 'Ja, hvis du fik besked under 14 dage før afgang. EU-Domstolen afgjorde i 2021, at SAS\' egen pilotstrejke ikke er en usædvanlig omstændighed. Du har krav på 250 til 600 € plus refusion eller ombookning.' },
      { q: 'Flyveledere i Frankrig strejkede, og mit fly til Malaga blev aflyst. Får jeg kompensation?', a: 'Som regel nej. Flyvelederstrejke er uden for selskabets kontrol og en usædvanlig omstændighed. Men selskabet skal dokumentere, at netop din flyvning blev ramt, og at det ikke kunne have ombooket dig hurtigere. Du har uanset ret til at vælge mellem refusion og ombookning og til forplejning og hotel, mens du venter.' },
      { q: 'Selskabet siger, strejken var varslet, og at de derfor ikke skal betale. Er det rigtigt?', a: 'Nej. At strejken var varslet og lovlig, gør den ikke usædvanlig; det var netop tilfældet i Airhelp mod SAS. Det afgørende er, om det var selskabets eget personale.' },
    ] },
  bagage: { name: 'Forsinket eller mistet bagage', short: 'bagage', seo: 'Forsinket eller mistet bagage: dine rettigheder', title: 'Forsinket, beskadiget eller mistet bagage: dine rettigheder og frister',
    answer: 'Bagage er ikke omfattet af EU-forordning 261/2004, men af <strong>Montreal-konventionen</strong>. Selskabet hæfter for op til <strong>1.519 SDR</strong>, cirka 13.000 kr, pr. passager for forsinket, beskadiget eller mistet bagage. Du skal anmelde skader <strong>inden 7 dage</strong> og forsinkelse <strong>inden 21 dage</strong> skriftligt, ellers mister du kravet. Bagage regnes som mistet efter 21 dage.',
    body: `<h2>Det gør du i lufthavnen</h2><p>Gå til selskabets bagageskranke, før du forlader ankomsthallen, og få udfyldt en <strong>PIR-rapport</strong> (Property Irregularity Report). Den er dit bevis. Gem bagagemærket fra check-in og boardingkortet. Uden PIR-rapport er sagen svær.</p>
<h2>Fristerne er korte</h2><div class="table-wrap"><table><thead><tr><th>Situation</th><th>Frist for skriftlig klage</th><th>Det kan du kræve</th></tr></thead><tbody>
<tr><td>Beskadiget kuffert eller indhold</td><td>7 dage fra modtagelsen</td><td>Reparation eller erstatning af kuffert og indhold, op til 1.519 SDR.</td></tr>
<tr><td>Forsinket bagage</td><td>21 dage fra du fik den</td><td>Rimelige udgifter til tøj, toiletsager og andet nødvendigt i ventetiden. Gem kvitteringer. Køb ikke nyt til hele ferien.</td></tr>
<tr><td>Mistet bagage (efter 21 dage)</td><td>2 år for at anlægge sag</td><td>Erstatning for kuffert og indhold, op til 1.519 SDR. Du skal kunne sandsynliggøre indholdets værdi.</td></tr></tbody></table></div>
<p>SDR er en regningsenhed fra Den Internationale Valutafond. 1.519 SDR svarer til omkring 13.000 kr; beløbet svinger med kursen. Grænsen blev hævet fra 1.288 SDR den 28. december 2024 og reguleres hvert femte år, næste gang i december 2029.</p>
<h2>Forsikringen først</h2><p>Mange rejse- og indboforsikringer dækker bagage bedre og hurtigere end flyselskabet, og uden loftet på 1.519 SDR for dyre ting. Anmeld til begge, men få pengene ét sted. Betalte du rejsen med kreditkort, kan kortets rejseforsikring også dække.</p>
<h2>Bagage er ikke en sag for kompensationsselskaberne</h2><p>Flyhjælp og de andre kompensationsselskaber tager ikke bagagesager; der er ingen fast kompensation at tage procent af. Du skal selv skrive til selskabet. Brug selskabets bagageformular, henvis til Montreal-konventionens artikel 17 og 19, og vedhæft PIR-rapport, kvitteringer og bagagemærke.</p>`,
    faq: [
      { q: 'Min kuffert kom 3 dage for sent på ferien. Hvad kan jeg kræve?', a: 'Rimelige udgifter til det nødvendige i de 3 dage: tøj, undertøj, toiletsager, evt. badetøj. Gem kvitteringerne og send dem til selskabet inden 21 dage efter, du fik kufferten. Nogle selskaber betaler et fast dagsbeløb i stedet.' },
      { q: 'Kan jeg få kompensation på 250 € for forsinket bagage?', a: 'Nej. De faste beløb i EU-forordningen gælder kun forsinkelse, aflysning og nægtet boarding af dig, ikke af bagagen. Bagage dækkes af Montreal-konventionen, der erstatter dokumenterede udgifter og tab.' },
      { q: 'Kufferten var ødelagt, men jeg opdagede det først hjemme. Er det for sent?', a: 'Fristen er 7 dage fra modtagelsen for skader. Er du inden for 7 dage, så skriv straks til selskabet med billeder og bagagemærke. Er du over, er kravet mod selskabet som regel tabt, men rejseforsikringen kan stadig dække.' },
    ] },
};
const CLAIM_SITUATIONS = ['forsinket', 'aflyst', 'naegtet-boarding', 'strejke'];

await emit({ path: '/situation/', title: 'Din situation: forsinket, aflyst, strejke eller bagage | Tjek dit fly', description: 'Vælg det, der skete med dit fly, og se dine rettigheder, beløbet og de undtagelser, flyselskabet kan bruge.',
  breadcrumb: [['Forside', '/'], ['Situationer', '/situation/']],
  body: `<section class="hero compact"><h1>Hvad skete der med dit fly?</h1><p class="lead">Reglerne er forskellige for forsinkelse, aflysning, nægtet boarding, strejke og bagage. Vælg din situation.</p></section><section><h2>Situationerne</h2><div class="grid">${Object.entries(SITUATIONS).map(([k, s]) => `<a class="card" href="/situation/${k}/"><h3>${esc(s.name)}</h3><p>${esc(s.answer.replace(/<[^>]+>/g, '').split('. ')[0])}.</p></a>`).join('')}</div></section>` });

for (const [key, s] of Object.entries(SITUATIONS)) {
  const cta = key === 'bagage' ? '' : key === 'strejke' ? ctaBox({ h: 'Var det selskabets egen strejke?', p: `Så har du et krav som ved enhver anden aflysning, og du kan lade Flyhjælp tage sagen mod ${FH_FEE} af beløbet, kun hvis de vinder. Var det flyveledere eller lufthavnen, der strejkede, er der som regel ingen kompensation at hente, og du skal i stedet sikre dig refusion eller ombookning direkte hos selskabet.` }) : ctaBox();
  await emit({ path: `/situation/${key}/`, title: `${s.seo} | Tjek dit fly`, description: s.answer.replace(/<[^>]+>/g, '').slice(0, 155).replace(/\s\S*$/, '') + '.',
    breadcrumb: [['Forside', '/'], ['Situationer', '/situation/'], [s.name, `/situation/${key}/`]], faq: s.faq,
    body: `<section class="hero compact"><h1>${esc(s.title)}</h1></section>
<div class="answer"><h2>Det korte svar</h2><p>${s.answer}</p></div>
${key !== 'bagage' ? `<p><a class="btn" href="/beregn/?hvad=${key === 'strejke' ? 'aflyst' : key}">Beregn beløbet for din rute</a></p>` : ''}
<section class="prose">${s.body}</section>
${cta}
${key !== 'bagage' ? `<section><h2>${esc(s.name)} hos dit flyselskab</h2><ul class="pills">${airlines.map((al) => `<li><a href="/flyselskab/${al.slug}/${key}/">${esc(al.name)}</a></li>`).join('')}</ul></section>` : ''}
<section class="faq"><h2>Ofte stillede spørgsmål om ${esc(s.short)}</h2>${faqHtml(s.faq)}</section>` });
}

// ---------- flyselskaber ----------
const zoneText = (al) => al.zone === 'eu'
  ? `${al.name} har licens i ${al.country}, som er omfattet af EU-reglerne. Det betyder, at <strong>både udrejser fra Danmark og hjemrejser til Danmark</strong> er dækket, også hjemrejser fra lande uden for EU.`
  : al.zone === 'uk'
    ? `${al.name} er et britisk selskab. <strong>Udrejser fra Danmark</strong> er dækket af EU-reglerne. <strong>Hjemrejser fra Storbritannien</strong> er dækket af den britiske kopi, UK261, med samme grænser i pund (220, 350 eller 520 £). Flyver du med ${al.name} fra et land uden for EU og Storbritannien til Danmark, er du ikke dækket.`
    : `${al.name} har licens i ${al.country}, uden for EU. Det betyder, at <strong>kun flyvninger, der afgår fra en EU-lufthavn</strong>, er dækket. Udrejsen fra København er dækket; hjemrejsen fra ${A[al.hub]?.city || 'udlandet'} er ikke, og det samme gælder eventuelle videre flyvninger derfra. Landets egne regler og din rejseforsikring kan hjælpe på hjemrejsen.`;

await emit({ path: '/flyselskab/', title: 'Flyselskaber: kompensation hos SAS, Norwegian, Ryanair og 16 andre | Tjek dit fly', description: 'Vælg dit flyselskab og se, hvordan du kræver kompensation, om hjemrejser er dækket, og hvad der er særligt for netop det selskab.',
  breadcrumb: [['Forside', '/'], ['Flyselskaber', '/flyselskab/']],
  body: `<section class="hero compact"><h1>Vælg dit flyselskab</h1><p class="lead">Reglerne er de samme for alle, men dækningen på hjemrejser og vejen til at klage er forskellig. ${airlines.length} selskaber, der flyver fra Danmark.</p></section>
<section><div class="table-wrap"><table><thead><tr><th>Selskab</th><th>Hjemland</th><th>Type</th><th>Hjemrejser fra lande uden for EU</th></tr></thead><tbody>${airlines.map((al) => `<tr><td><a href="/flyselskab/${al.slug}/"><strong>${esc(al.name)}</strong></a></td><td>${esc(al.country)}</td><td>${esc(al.type)}</td><td>${al.zone === 'eu' ? '<span class="tag ok">Dækket</span>' : al.zone === 'uk' ? '<span class="tag">UK261 fra Storbritannien</span>' : '<span class="tag bad">Ikke dækket</span>'}</td></tr>`).join('')}</tbody></table></div>
<p class="small muted">Udrejser fra Danmark og resten af EU er dækket hos alle selskaber. Kolonnen gælder hjemrejser til EU fra lande uden for EU.</p></section>` });

for (const al of airlines) {
  const hub = A[al.hub];
  const faq = [
    { q: `Er hjemrejsen med ${al.name} dækket af EU-reglerne?`, a: al.zone === 'eu' ? `Ja. ${al.name} er et EU-selskab i forordningens forstand, så både ud- og hjemrejser er dækket, uanset hvor i verden de afgår fra.` : al.zone === 'uk' ? `Fra Storbritannien, ja, via UK261 med beløb i pund. Fra andre lande uden for EU, nej.` : `Nej. Kun flyvninger, der afgår fra EU, er dækket, når selskabet ikke er et EU-selskab. Hjemrejsen fra ${hub?.city || 'udlandet'} med ${al.name} er ikke omfattet.` },
    { q: `Hvordan klager jeg til ${al.name}?`, a: `Brug selskabets egen formular til kompensationskrav på deres hjemmeside, eller send vores <a href="/klag-selv/">skabelon</a> til kundeservice. Angiv bookingnummer, flynummer, dato og din endelige ankomsttid. Får du ikke svar inden 6 uger, kan du klage til Trafikstyrelsen, hvis flyet afgik fra Danmark.` },
    { q: `Hvor meget kan jeg få hos ${al.name}?`, a: `250 € på ruter op til 1.500 km, 400 € på 1.500 til 3.500 km og 600 € over 3.500 km uden for EU. Beløbet er det samme hos alle selskaber og uafhængigt af, hvad billetten kostede. <a href="/beregn/?selskab=${al.slug}">Beregn for din rute</a>.` },
    { q: `Kan ${al.name} slippe med en voucher?`, a: 'Nej. Kompensation og refusion skal betales i penge, medmindre du skriftligt accepterer en voucher. Du kan sige nej til vouchers og kræve overførsel til din konto.' },
  ];
  await emit({ path: `/flyselskab/${al.slug}/`, title: `${al.name}: kompensation for forsinket eller aflyst fly | Tjek dit fly`, description: `Sådan får du kompensation hos ${al.name}: beløb, om hjemrejser er dækket, hvor du klager, og hvad der er særligt for ${al.name}.`,
    breadcrumb: [['Forside', '/'], ['Flyselskaber', '/flyselskab/'], [al.name, `/flyselskab/${al.slug}/`]], faq,
    body: `<section class="hero compact"><h1>${esc(al.name)}: kompensation for forsinket eller aflyst fly</h1></section>
<div class="answer"><h2>Det korte svar</h2><p>Var dit fly med ${esc(al.name)} mindst 3 timer forsinket, aflyst med under 14 dages varsel, eller blev du nægtet boarding, har du krav på <strong>250, 400 eller 600 €</strong> pr. person. ${zoneText(al)}</p></div>
<p><a class="btn" href="/beregn/?selskab=${al.slug}">Beregn dit krav mod ${esc(al.name)}</a></p>
<section class="prose"><h2>Særligt for ${esc(al.name)}</h2><p>${esc(al.note)}</p>
<h2>Sådan klager du til ${esc(al.name)}</h2><ol class="steps"><li><strong>Find bookingnummer, flynummer og dato.</strong> Notér den faktiske ankomsttid ved din endelige destination.</li><li><strong>Skriv til ${esc(al.name)}</strong> via <a href="${esc(al.claim)}" rel="noopener" target="_blank">selskabets kundeservice</a>. Brug vores <a href="/klag-selv/">skabelon</a>, og henvis til forordning 261/2004 artikel 7.</li><li><strong>Afviser de,</strong> så bed om dokumentation for den usædvanlige omstændighed. Får du intet svar efter 6 uger, klager du til Trafikstyrelsen (fly fra Danmark).</li><li><strong>Vil du ikke selv,</strong> tager et <a href="/sammenlign/">kompensationsselskab</a> sagen mod omkring 30 % af beløbet.</li></ol></section>
${ctaBox({ h: `Lad Flyhjælp tage sagen mod ${al.name}`, p: `Flyhjælp fører sager mod ${al.name} og de andre selskaber, der flyver fra Danmark. De tager ${FH_FEE} af kompensationen inkl. moms, og kun hvis du får pengene. Får du ingen kompensation, koster det ikke noget.` })}
<section><h2>Din situation hos ${esc(al.name)}</h2><div class="grid">${CLAIM_SITUATIONS.map((k) => `<a class="card" href="/flyselskab/${al.slug}/${k}/"><h3>${esc(SITUATIONS[k].name)} med ${esc(al.name)}</h3><p>${esc(SITUATIONS[k].answer.replace(/<[^>]+>/g, '').split('. ')[0])}.</p></a>`).join('')}</div></section>
<section class="faq"><h2>Ofte stillede spørgsmål om ${esc(al.name)}</h2>${faqHtml(faq)}</section>` });

  for (const k of CLAIM_SITUATIONS) {
    const s = SITUATIONS[k];
    const title = `${s.name} med ${al.name}: ${k === 'forsinket' ? 'kompensation fra 3 timers forsinkelse' : k === 'aflyst' ? 'refusion, ombookning og kompensation' : k === 'strejke' ? 'har du krav på kompensation?' : 'kompensation med det samme'}`;
    const faq2 = [
      { q: `Har jeg krav på kompensation, når ${al.name} ${k === 'forsinket' ? 'er forsinket' : k === 'aflyst' ? 'aflyser' : k === 'strejke' ? 'strejker' : 'nægter mig boarding'}?`, a: s.answer.replace(/<[^>]+>/g, '') },
      { q: `Hvor meget kan jeg få hos ${al.name}?`, a: `250 € på ruter op til 1.500 km, 400 € på 1.500 til 3.500 km og 600 € over 3.500 km uden for EU, pr. person og uafhængigt af billetprisen.` },
      ...(k === 'strejke' ? [{ q: `Strejker ${al.name}s eget personale, eller er det andre?`, a: `Strejker piloter eller kabinepersonale hos ${al.name}, er det selskabets egen strejke, og du har krav på kompensation. Strejker flyveledere eller lufthavnen, har du ikke. Spørg ${al.name}, hvem der strejkede, og bed om det på skrift.` }] : []),
      ...(al.zone !== 'eu' ? [{ q: `Gælder det også på hjemrejsen med ${al.name}?`, a: al.zone === 'uk' ? 'Fra Storbritannien gælder UK261 med samme regler i pund. Fra andre lande uden for EU er hjemrejsen ikke dækket.' : `Nej. ${al.name} er ikke et EU-selskab, så kun afgange fra EU-lufthavne er dækket.` }] : []),
    ];
    await emit({ path: `/flyselskab/${al.slug}/${k}/`, title: `${title} | Tjek dit fly`, description: `${s.name} med ${al.name}: dine rettigheder, beløbet og hvordan du klager. ${al.zone === 'eu' ? 'Både ud- og hjemrejser er dækket.' : 'Kun afgange fra EU er dækket.'}`,
      breadcrumb: [['Forside', '/'], ['Flyselskaber', '/flyselskab/'], [al.name, `/flyselskab/${al.slug}/`], [s.name, `/flyselskab/${al.slug}/${k}/`]], faq: faq2,
      body: `<section class="hero compact"><h1>${esc(title)}</h1></section>
<div class="answer"><h2>Det korte svar</h2><p>${s.answer.replace(/dit fly/g, `dit fly med ${esc(al.name)}`)}</p><p>${zoneText(al)}</p></div>
<p><a class="btn" href="/beregn/?selskab=${al.slug}&hvad=${k === 'strejke' ? 'aflyst' : k}">Beregn beløbet for din rute med ${esc(al.name)}</a></p>
<section class="prose">${s.body}
<h2>Sådan klager du til ${esc(al.name)}</h2><p>${esc(al.note)}</p><p>Skriv til <a href="${esc(al.claim)}" rel="noopener" target="_blank">${esc(al.name)}s kundeservice</a> med bookingnummer, flynummer, dato og faktisk ankomsttid, og henvis til forordning 261/2004 artikel 7. Brug vores <a href="/klag-selv/">skabelon</a>. Får du ikke svar inden 6 uger, kan du klage gratis til Trafikstyrelsen, hvis flyet afgik fra Danmark.</p></section>
${k === 'strejke' ? ctaBox({ h: `Var det ${al.name}s egen strejke?`, p: `Så har du et krav som ved enhver anden aflysning, og Flyhjælp kan tage sagen mod ${FH_FEE} af beløbet, kun hvis de vinder. Var det flyveledere eller lufthavnen, der strejkede, er der som regel ingen kompensation at hente.` }) : ctaBox({ h: `Lad Flyhjælp tage sagen mod ${al.name}`, p: `Flyhjælp fører sager om ${s.short} mod ${al.name} og de andre selskaber, der flyver fra Danmark. De tager ${FH_FEE} af kompensationen inkl. moms, og kun hvis du får pengene.` })}
<section><h2>Andre situationer med ${esc(al.name)}</h2><ul class="pills">${CLAIM_SITUATIONS.filter((x) => x !== k).map((x) => `<li><a href="/flyselskab/${al.slug}/${x}/">${esc(SITUATIONS[x].name)}</a></li>`).join('')}<li><a href="/flyselskab/${al.slug}/">Alt om ${esc(al.name)}</a></li></ul></section>
<section class="faq"><h2>Ofte stillede spørgsmål</h2>${faqHtml(faq2)}</section>` });
  }
}

// ---------- ruter og lufthavne ----------
function routeInfo(from, to) {
  const km = haversineKm(from, to);
  const bothEu = from.zone === 'eu' && to.zone === 'eu';
  const c = compensationFor(km, bothEu);
  return { km: Math.round(km), eur: c.eur, kr: dkk(c.eur), band: c.band, bothEu, limitH: c.rerouteLimitH, path: `/rute/${aSlug(from)}-${aSlug(to)}/` };
}
const routeList = [];
for (const [fromIata, dests] of Object.entries(routes)) for (const d of dests) routeList.push({ from: A[fromIata], to: A[d], ...routeInfo(A[fromIata], A[d]) });

await emit({ path: '/lufthavn/', title: 'Lufthavne og ruter: kompensation pr. rute fra København, Billund, Aalborg og Aarhus | Tjek dit fly', description: 'Vælg din afgangslufthavn og se afstand og kompensation for hver rute. 219 ruter fra de fire danske lufthavne.',
  breadcrumb: [['Forside', '/'], ['Lufthavne', '/lufthavn/']],
  body: `<section class="hero compact"><h1>Fra hvilken lufthavn fløj du?</h1><p class="lead">Kompensationen afhænger af rutens længde. Vælg lufthavn og find din rute.</p></section><section><h2>De fire danske afgangslufthavne</h2><div class="grid">${dkAirports.map((a) => `<a class="card" href="/lufthavn/${aSlug(a)}/"><h3>${esc(a.name)}</h3><p>${routes[a.iata].length} ruter med afstand og beløb.</p></a>`).join('')}</div></section>` });

for (const ap of dkAirports) {
  const rows = routeList.filter((r) => r.from === ap).sort((x, y) => x.to.name.localeCompare(y.to.name, 'da'));
  const by = (eur) => rows.filter((r) => r.eur === eur);
  const faq = [
    { q: `Hvilke ruter fra ${ap.name} giver 250 €?`, a: `Ruter op til 1.500 km, det vil sige ${by(250).slice(0, 8).map((r) => r.to.city).join(', ')} og resten af Nordeuropa. ${by(250).length} af de ${rows.length} ruter her.` },
    { q: `Hvilke ruter fra ${ap.name} giver 400 €?`, a: `Ruter fra 1.500 til 3.500 km, samt længere ruter inden for EU: ${by(400).slice(0, 8).map((r) => r.to.city).join(', ')} og lignende. ${by(400).length} ruter.` },
    ...(by(600).length ? [{ q: `Hvilke ruter fra ${ap.name} giver 600 €?`, a: `Ruter over 3.500 km til lande uden for EU: ${by(600).map((r) => r.to.city).join(', ')}.` }] : []),
    { q: `Hvor klager jeg over et fly fra ${ap.name}?`, a: `Først til flyselskabet. Svarer de ikke inden 6 uger eller afviser uden dokumentation, klager du gratis til Trafikstyrelsen, som er myndighed for alle fly, der afgår fra Danmark.` },
  ];
  await emit({ path: `/lufthavn/${aSlug(ap)}/`, title: `${ap.name}: kompensation for forsinket eller aflyst fly, alle ${rows.length} ruter | Tjek dit fly`, description: `Afstand og kompensation for ${rows.length} ruter fra ${ap.name}. Se om din rute giver 250, 400 eller 600 €, og hvordan du klager.`,
    breadcrumb: [['Forside', '/'], ['Lufthavne', '/lufthavn/'], [ap.name, `/lufthavn/${aSlug(ap)}/`]], faq,
    extra: [{ '@type': 'Airport', name: ap.name, iataCode: ap.iata, icaoCode: ap.icao, address: { '@type': 'PostalAddress', addressLocality: ap.city, addressCountry: 'DK' }, geo: { '@type': 'GeoCoordinates', latitude: ap.lat, longitude: ap.lon } }],
    body: `<section class="hero compact"><h1>${esc(ap.name)}: kompensation for forsinket eller aflyst fly</h1></section>
<div class="answer"><h2>Det korte svar</h2><p>Alle fly, der afgår fra ${esc(ap.name)}, er dækket af EU-reglerne, uanset selskab. Mindst 3 timers forsinkelse, aflysning med under 14 dages varsel eller nægtet boarding giver <strong>250 € (${by(250).length} ruter), 400 € (${by(400).length} ruter)${by(600).length ? ` eller 600 € (${by(600).length} ruter)` : ''}</strong> pr. person. Klagemyndigheden er Trafikstyrelsen.</p></div>
<section><h2>Ruter fra ${esc(ap.name)}</h2><div class="table-wrap"><table><thead><tr><th>Til</th><th>Land</th><th class="num">Afstand</th><th class="num">Kompensation</th><th class="num">I kroner</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="${r.path}"><strong>${esc(r.to.name)}</strong></a></td><td>${esc(r.to.country)}</td><td class="num">${fmt(r.km)} km</td><td class="num">${r.eur} €</td><td class="num">${fmt(r.kr)} kr</td></tr>`).join('')}</tbody></table></div><p class="small muted">Storcirkelafstand mellem lufthavnene, som forordningen kræver. Kroner efter kursen ${EUR_DKK.toLocaleString('da-DK')}. Beløbet gælder pr. person ved mindst 3 timers forsinkelse ved ankomst, aflysning med under 14 dages varsel eller nægtet boarding. Mangler din rute? Brug <a href="/beregn/?fra=${ap.iata}">beregneren</a>.</p></section>
${ctaBox()}
<section class="faq"><h2>Ofte stillede spørgsmål om fly fra ${esc(ap.name)}</h2>${faqHtml(faq)}</section>` });
}

const airlinesEu = airlines.filter((a) => a.zone === 'eu').map((a) => a.name);
for (const r of routeList) {
  const { from, to } = r;
  const back = to.zone === 'eu' ? `Hjemrejsen fra ${to.city} til ${from.city} er dækket på samme måde, fordi ${to.country === 'Danmark' ? 'begge lufthavne ligger i Danmark' : `${to.country} ${['Norge', 'Island'].includes(to.country) ? 'er omfattet af EU-reglerne gennem EØS-aftalen' : to.country === 'Schweiz' ? 'er omfattet af EU-reglerne gennem luftfartsaftalen mellem EU og Schweiz' : 'er et EU-land'}`}. Beløbet er det samme, ${r.eur} €.`
    : to.zone === 'uk' ? `Hjemrejsen fra ${to.city} er dækket af den britiske udgave af reglerne, UK261, uanset selskab. Beløbet er ${({ 250: 220, 400: 350, 600: 520 })[r.eur]} £ i stedet for ${r.eur} €, og klagen går til det britiske CAA i stedet for Trafikstyrelsen.`
    : `Hjemrejsen fra ${to.city} til ${from.city} er <strong>kun dækket, hvis selskabet er et EU-selskab</strong>, fx ${airlinesEu.slice(0, 3).join(', ')} eller ${airlinesEu[3]}. Flyver du hjem med et selskab fra ${to.country} eller et andet land uden for EU, gælder EU-reglerne ikke på hjemrejsen.`;
  const examples = r.eur === 250 ? 'En forsinkelse på 3 timer giver det fulde beløb. Ombookes du ved aflysning eller nægtet boarding og når frem højst 2 timer senere end planlagt, må selskabet halvere til 125 €.'
    : r.eur === 400 ? 'Ombookes du ved aflysning eller nægtet boarding og når frem højst 3 timer senere end planlagt, må selskabet halvere til 200 €. Ved ren forsinkelse halveres ikke.'
      : 'Ombookes du ved aflysning eller nægtet boarding og når frem højst 4 timer senere end planlagt, må selskabet halvere til 300 €. Nogle selskaber halverer også ved 3 til 4 timers ren forsinkelse; det er ikke afgjort af EU-Domstolen, og fløj du med det oprindelige fly, er der gode argumenter for de fulde 600 €.';
  const faq = [
    { q: `Hvor meget kan jeg få, hvis flyet fra ${from.city} til ${to.city} er forsinket?`, a: `${r.eur} € pr. person, cirka ${fmt(r.kr)} kr, når du ankommer mindst 3 timer for sent til ${to.city}. Ruten er ${fmt(r.km)} km, altså ${r.band}.` },
    { q: `Gælder det samme på hjemrejsen fra ${to.city}?`, a: back.replace(/<[^>]+>/g, '') },
    { q: `Hvad hvis flyet ${from.city}–${to.city} blev aflyst?`, a: `Du kan vælge mellem fuld refusion og ombookning. Fik du besked under 14 dage før afgang, har du oven i det krav på ${r.eur} €, medmindre selskabet tilbød en ombookning tæt på det oprindelige tidspunkt eller kan bevise en usædvanlig omstændighed.` },
    { q: `Hvor klager jeg over et fly fra ${from.city} til ${to.city}?`, a: `Først til flyselskabet med bookingnummer og flynummer. Svarer de ikke inden 6 uger, klager du gratis til Trafikstyrelsen, fordi flyet afgik fra Danmark.` },
  ];
  await emit({ path: r.path, title: `${from.city} til ${to.city} forsinket eller aflyst: ${r.eur} € i kompensation | Tjek dit fly`, description: `Ruten ${from.name} til ${to.name} er ${fmt(r.km)} km. Ved mindst 3 timers forsinkelse, aflysning eller nægtet boarding har du krav på ${r.eur} € (cirka ${fmt(r.kr)} kr) pr. person. Sådan får du dem.`,
    breadcrumb: [['Forside', '/'], ['Lufthavne', '/lufthavn/'], [from.name, `/lufthavn/${aSlug(from)}/`], [`${from.city} til ${to.city}`, r.path]], faq,
    extra: [{ '@type': 'Trip', name: `${from.name} til ${to.name}`, itinerary: [{ '@type': 'Airport', name: from.name, iataCode: from.iata }, { '@type': 'Airport', name: to.name, iataCode: to.iata }] }],
    body: `<section class="hero compact"><h1>${esc(from.city)} til ${esc(to.city)}: forsinket eller aflyst fly giver ${r.eur} € i kompensation</h1></section>
<div class="answer"><h2>Det korte svar</h2><span class="amount">${r.eur} € <small>≈ ${fmt(r.kr)} kr pr. person</small></span><p>Ruten fra ${esc(from.name)} (${from.iata}) til ${esc(to.name)} (${to.iata}) er <strong>${fmt(r.km)} km</strong>, altså ${r.band}. Ankommer du mindst <strong>3 timer</strong> for sent til ${esc(to.city)}, blev flyet aflyst med under 14 dages varsel, eller blev du nægtet boarding, har du krav på ${r.eur} € pr. person, uanset selskab og billetpris. Undtagelsen er usædvanlige omstændigheder som vejr og flyvelederstrejke, som selskabet skal bevise.</p></div>
<div class="facts"><div class="fact"><b>${fmt(r.km)} km</b><span>Storcirkelafstand mellem lufthavnene</span></div><div class="fact"><b>${r.eur} €</b><span>${esc(r.band)}</span></div><div class="fact"><b>${fmt(r.kr)} kr</b><span>Cirka, ved kursen ${EUR_DKK.toLocaleString('da-DK')}</span></div><div class="fact"><b>3 timer</b><span>Mindste forsinkelse ved ankomst i ${esc(to.city)}</span></div></div>
<p><a class="btn" href="/beregn/?fra=${from.iata}&til=${to.iata}&hvad=forsinket">Tjek din konkrete situation på ruten</a></p>
<section class="prose"><h2>Udrejse og hjemrejse</h2><p>Udrejsen fra ${esc(from.name)} er dækket af EU-forordning 261/2004, fordi den afgår fra en EU-lufthavn. Det gælder for alle selskaber, også lavprisselskaber og charter. ${back}</p>
<h2>Hvornår halveres beløbet?</h2><p>${examples}</p>
<h2>Det, du skal gøre</h2><ol class="steps"><li><strong>Gem dokumentationen.</strong> Bookingbekræftelse, boardingkort og den faktiske ankomsttid i ${esc(to.city)}. Bed selskabet om årsagen på skrift.</li><li><strong>Skriv til flyselskabet</strong> med vores <a href="/klag-selv/">skabelon</a>. Henvis til forordning 261/2004 artikel 7 og ruten ${esc(from.city)}–${esc(to.city)} på ${fmt(r.km)} km.</li><li><strong>Afviser de uden dokumentation,</strong> klag til Trafikstyrelsen. Det er gratis, fordi flyet afgik fra Danmark. Eller lad et <a href="/sammenlign/">kompensationsselskab</a> tage sagen mod omkring 30 %.</li></ol></section>
${ctaBox({ h: `Forsinket eller aflyst mellem ${from.city} og ${to.city}?`, p: `Flyhjælp tager sagen mod flyselskabet for dig. De tager ${FH_FEE} af de ${r.eur} € inkl. moms, og kun hvis du får pengene. Får du ingen kompensation, koster det ikke noget.` })}
<section><h2>Flyselskaber på ruten</h2><p class="muted">Vi angiver ikke, hvem der flyver ruten lige nu; det skifter med sæsonen. Reglerne er de samme for alle. Vælg dit selskab:</p><ul class="pills">${airlines.map((al) => `<li><a href="/flyselskab/${al.slug}/">${esc(al.name)}</a></li>`).join('')}</ul></section>
<section><h2>Andre ruter fra ${esc(from.name)}</h2><ul class="pills">${routeList.filter((x) => x.from === from && x !== r && Math.abs(x.km - r.km) < 600).slice(0, 10).map((x) => `<li><a href="${x.path}">${esc(x.to.city)}, ${x.eur} €</a></li>`).join('')}<li><a href="/lufthavn/${aSlug(from)}/">Alle ruter fra ${esc(from.city)}</a></li></ul></section>
<section class="faq"><h2>Ofte stillede spørgsmål om ruten</h2>${faqHtml(faq)}</section>` });
}

// ---------- sitemap og llms.txt ----------
await writeFile('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${SITE}${p.path}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
await writeFile('public/llms.txt', `# Tjek dit fly (tjekditfly.dk)

> Dansk guide til flykompensation efter EU-forordning 261/2004. Ikke ejet af flyselskaber eller kompensationsselskaber; finansieret af annoncelinks. Gratis beregner, regler på almindeligt dansk, skabelon til at klage selv, og en sammenligning af de selskaber, der tager sagen mod salær. Skrevet af Rasmus Pedersen. Vejledning, ikke juridisk rådgivning.

## Kerneregler (gyldige pr. ${RULES_DATE})
- Kompensation: 250 € (op til 1.500 km), 400 € (1.500–3.500 km, og alle længere ruter inden for EU), 600 € (over 3.500 km uden for EU). Pr. person, uafhængigt af billetpris. Kurs: 1 € ≈ ${EUR_DKK} kr.
- Forsinkelse: mindst 3 timer ved ankomst til endelig destination. Aflysning: besked under 14 dage før afgang. Nægtet boarding: altid, uanset årsag.
- Dækning: alle afgange fra EU/EØS/Schweiz uanset selskab; ankomster til EU fra lande uden for EU kun med EU-selskab. Storbritannien har UK261 (220/350/520 £).
- Usædvanlige omstændigheder (fritager som regel): vejr ved den konkrete flyvning, flyveleder- og lufthavnsstrejke, fugle, lukket luftrum, sikkerhed. Selskabet skal derudover bevise, at forsinkelsen ikke kunne undgås med rimelige forholdsregler (C-294/10, C-399/24). Fritager ikke: tekniske fejl i normal drift, manglende besætning, egen strejke (Airhelp mod SAS, C-28/20), forsinket indkommende fly.
- Revision vedtaget juli 2026 (Parlamentet 7. juli, Rådet 13. juli), gælder 12 måneder efter offentliggørelse i EU-Tidende, dvs. 2027. 3 timer og beløbene er uændrede. Nyt: 9 måneders frist for krav, besked fra selskabet inden 96 timer, 30 dages svarfrist, liste over usædvanlige omstændigheder.
- Forældelse i Danmark: 3 år. Klagemyndighed for fly fra Danmark: Trafikstyrelsen. Kompensationsselskaber tager typisk 30 % (40–50 % ved retssag).

## Vigtige sider
- Beregner: ${SITE}/beregn/
- Reglerne: ${SITE}/regler/
- Klag selv med skabelon: ${SITE}/klag-selv/
- Sammenligning af kompensationsselskaber: ${SITE}/sammenlign/
- Situationer: ${Object.keys(SITUATIONS).map((k) => `${SITE}/situation/${k}/`).join(', ')}
- Flyselskaber: ${SITE}/flyselskab/ (${airlines.map((a) => a.name).join(', ')})
- Lufthavne og ${routeList.length} ruter: ${SITE}/lufthavn/
- Om og finansiering: ${SITE}/om/ , ${SITE}/annoncelinks/

## Kilder
- Forordning (EF) nr. 261/2004: https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:32004R0261
- Lufthavnskoordinater: OurAirports (public domain)
`);
console.log(`Byggede ${pages.length} sider: ${Object.keys(SITUATIONS).length} situationer, ${airlines.length} selskaber × ${1 + CLAIM_SITUATIONS.length}, ${dkAirports.length} lufthavne, ${routeList.length} ruter.`);
