// Beregneren på /beregn/. Læser formularen (eller adressens parametre), kalder regelmotoren og skriver resultatet.
// Ingen afhængigheder. Alt sker i browseren; intet sendes nogen steder.
import { assess, haversineKm, compensationFor, dkk, SITUATION_LABEL } from '/assets/eu261.js?v=__RULES_V__';

const $ = (s, el = document) => el.querySelector(s);
const form = $('form.calc:not(#brev-form)');
if (form) init();
if (document.getElementById('brev-form')) import('/assets/letter.js?v=__LETTER_V__').then((m) => m.initLetter());

async function init() {
  const data = await (await fetch('/data/airports.json')).json();
  const byIata = Object.fromEntries(data.airports.map((a) => [a.iata, a]));
  const airlines = JSON.parse($('#airlines-data').textContent);

  // Udfyld lufthavnslister: danske først, så resten alfabetisk
  for (const sel of [$('#fra'), $('#til')]) {
    const dkGroup = document.createElement('optgroup'); dkGroup.label = 'Danmark';
    const restGroup = document.createElement('optgroup'); restGroup.label = 'Udlandet';
    const ordered = [...data.airports].sort((x, y) => (x.dk !== y.dk ? (x.dk ? -1 : 1) : x.iata === 'CPH' ? -1 : y.iata === 'CPH' ? 1 : 0));
    for (const a of ordered) {
      const o = document.createElement('option'); o.value = a.iata; o.textContent = `${a.name}${a.dk ? '' : ', ' + a.country} (${a.iata})`;
      (a.dk ? dkGroup : restGroup).appendChild(o);
    }
    sel.appendChild(dkGroup); sel.appendChild(restGroup);
  }
  const alSel = $('#selskab');
  for (const al of airlines) { const o = document.createElement('option'); o.value = al.slug; o.textContent = al.name; alSel.appendChild(o); }

  // Forudfyld fra adressen (forsiden sender fra/til/hvad med)
  const q = new URLSearchParams(location.search);
  if (q.get('fra') && byIata[q.get('fra')]) $('#fra').value = q.get('fra');
  else $('#fra').value = 'CPH';
  if (q.get('til') && byIata[q.get('til')]) $('#til').value = q.get('til');
  if (q.get('hvad')) { const r = form.querySelector(`input[name=hvad][value="${q.get('hvad')}"]`); if (r) r.checked = true; }
  if (q.get('selskab')) alSel.value = q.get('selskab');

  $('#swap').addEventListener('click', () => { const a = $('#fra').value; $('#fra').value = $('#til').value; $('#til').value = a; showConditional(); });
  form.addEventListener('change', showConditional);
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  showConditional();
  if (q.get('til') && q.get('hvad')) run();

  function showConditional() {
    const hvad = form.hvad.value;
    $('#f-forsinket').hidden = hvad !== 'forsinket';
    $('#f-aflyst').hidden = hvad !== 'aflyst';
    $('#f-boarding').hidden = hvad !== 'naegtet-boarding';
    $('#f-aarsag').hidden = hvad === 'naegtet-boarding';
    // Afstand vises løbende, så man kan se, at valget gør noget
    const from = byIata[$('#fra').value], to = byIata[$('#til').value];
    const out = $('#distance');
    if (from && to && from !== to) {
      const km = haversineKm(from, to);
      const c = compensationFor(km, from.zone === 'eu' && to.zone === 'eu');
      out.textContent = `${from.city} til ${to.city}: ${Math.round(km).toLocaleString('da-DK')} km. Det er ${c.band}, så fuld kompensation er ${c.eur} € (cirka ${dkk(c.eur).toLocaleString('da-DK')} kr) pr. person.`;
    } else out.textContent = '';
  }

  function run() {
    const from = byIata[$('#fra').value], to = byIata[$('#til').value];
    const res = $('#resultat');
    if (!from || !to || from === to) { res.innerHTML = '<div class="verdict nej"><h2>Vælg to forskellige lufthavne</h2></div>'; res.scrollIntoView({ behavior: 'smooth' }); return; }
    const hvad = form.hvad.value;
    const al = airlines.find((a) => a.slug === alSel.value);
    const airlineZone = al ? al.zone : 'unknown';
    const noticeRaw = form.varsel ? form.varsel.value : '';
    const rerouteRaw = form.ombook ? form.ombook.value : '';
    const r = assess({
      from, to, airlineZone, situation: hvad,
      delayH: Number(form.timer.value || 0),
      noticeDays: hvad === 'aflyst' && noticeRaw !== '' ? Number(noticeRaw) : null,
      rerouteH: hvad === 'aflyst' && rerouteRaw !== '' ? Number(rerouteRaw) : null,
      cause: hvad === 'naegtet-boarding' ? 'ved-ikke' : form.aarsag.value,
      voluntary: hvad === 'naegtet-boarding' && form.frivillig.value === 'ja',
    });
    const label = SITUATION_LABEL[hvad] || hvad;
    const head = r.verdict === 'ja' ? 'Ja, du har krav på kompensation' : r.verdict === 'sandsynligvis' ? 'Sandsynligvis, kræv den' : 'Nej, ikke kompensation i denne situation';
    const amount = r.eur ? `<span class="amount">${r.eur.toLocaleString('da-DK')} ${r.currency || '€'} <small>≈ ${r.dkk.toLocaleString('da-DK')} kr pr. person</small></span>` : '';
    const ctaData = $('#cta-data') ? JSON.parse($('#cta-data').textContent) : null;
    const cta = r.eur && ctaData ? `<div class="cta"><div><h2>${ctaData.h}</h2><p>${ctaData.p}</p></div><div class="cta-actions"><a class="btn big" href="${ctaData.url}" target="_blank" rel="${ctaData.rel}">${ctaData.btn}</a><span class="small muted">${ctaData.note}</span><a class="btn secondary" href="/klag-selv/?fra=${from.iata}&til=${to.iata}&hvad=${hvad}${al ? '&selskab=' + al.slug : ''}#brev">Eller skriv klagen selv, gratis</a></div></div>` : `<p><a class="btn secondary" href="/klag-selv/?fra=${from.iata}&til=${to.iata}&hvad=${hvad}${al ? '&selskab=' + al.slug : ''}#brev">Skriv brev om dine øvrige rettigheder</a></p>`;
    res.innerHTML = `<div class="verdict ${r.verdict}"><h2>${head}</h2>${amount}
<p class="muted">${label}, ${from.city} til ${to.city}, ${r.km.toLocaleString('da-DK')} km${al ? ', ' + al.name : ''}. ${r.law ? 'Regelsæt: ' + r.law + '.' : ''}</p>
<h3>Derfor</h3><ul>${r.reasons.map((x) => `<li>${x}</li>`).join('')}</ul>
${r.rights.length ? `<h3>Det har du også ret til</h3><ul>${r.rights.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
</div>${cta}
<p class="small muted">Beregningen følger EU-forordning 261/2004 og EU-Domstolens praksis, men er vejledning, ikke en afgørelse. Selskabet kan have dokumentation, vi ikke kender. <a href="/regler/">Læs reglerne</a>.</p>`;
    res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Del-bar adresse, så resultatet kan sendes videre eller bogmærkes
    const u = new URL(location.href); u.searchParams.set('fra', from.iata); u.searchParams.set('til', to.iata); u.searchParams.set('hvad', hvad); if (al) u.searchParams.set('selskab', al.slug); else u.searchParams.delete('selskab');
    history.replaceState(null, '', u);
  }
}

// Kopiér-knap på /klag-selv/
for (const btn of document.querySelectorAll('[data-copy]')) {
  btn.addEventListener('click', async () => {
    const src = document.getElementById(btn.dataset.copy);
    try { await navigator.clipboard.writeText(src.innerText); btn.textContent = 'Kopieret'; setTimeout(() => (btn.textContent = 'Kopiér teksten'), 2000); }
    catch { const r = document.createRange(); r.selectNodeContents(src); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Markeret, tryk Ctrl+C'; }
  });
}
