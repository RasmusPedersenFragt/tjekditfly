// Brevgeneratoren på /klag-selv/. Brugeren udfylder felter, og brevet skrives færdigt med afstand, beløb og
// forsinkelse regnet ud. Alt sker i browseren; intet sendes eller gemmes. Importeres fra app.js.
import { haversineKm, compensationFor } from '/assets/eu261.js?v=0e4e1348';

const $ = (s, el = document) => el.querySelector(s);

export async function initLetter() {
  const bf = document.getElementById('brev-form');
  const data = await (await fetch('/data/airports.json')).json();
  const byIata = Object.fromEntries(data.airports.map((a) => [a.iata, a]));
  const airlines = JSON.parse($('#airlines-data').textContent);
  const ordered = [...data.airports].sort((x, y) => (x.dk !== y.dk ? (x.dk ? -1 : 1) : x.iata === 'CPH' ? -1 : y.iata === 'CPH' ? 1 : 0));
  for (const sel of [$('#b-fra'), $('#b-til')]) {
    const dkGroup = document.createElement('optgroup'); dkGroup.label = 'Danmark';
    const restGroup = document.createElement('optgroup'); restGroup.label = 'Udlandet';
    for (const a of ordered) { const o = document.createElement('option'); o.value = a.iata; o.textContent = `${a.name}${a.dk ? '' : ', ' + a.country} (${a.iata})`; (a.dk ? dkGroup : restGroup).appendChild(o); }
    sel.appendChild(dkGroup); sel.appendChild(restGroup);
  }
  const alSel = $('#b-selskab');
  for (const al of airlines) { const o = document.createElement('option'); o.value = al.slug; o.textContent = al.name; alSel.insertBefore(o, alSel.lastElementChild); }

  const q = new URLSearchParams(location.search);
  $('#b-fra').value = byIata[q.get('fra')] ? q.get('fra') : 'CPH';
  if (byIata[q.get('til')]) $('#b-til').value = q.get('til');
  if (q.get('hvad')) { const r = bf.querySelector(`input[name=hvad][value="${q.get('hvad')}"]`); if (r) r.checked = true; }
  if (q.get('selskab')) alSel.value = q.get('selskab');
  if (q.get('hvad') || q.get('til')) $('#brev').scrollIntoView();

  const show = () => {
    const hvad = bf.hvad.value;
    $('#b-forsinket').hidden = hvad !== 'forsinket';
    $('#b-aflyst').hidden = hvad !== 'aflyst';
    $('#b-selskab-andet-wrap').hidden = alSel.value !== 'andet';
    const from = byIata[$('#b-fra').value], to = byIata[$('#b-til').value];
    if (from && to && from !== to) {
      const km = haversineKm(from, to);
      $('#b-distance').textContent = `${from.city} til ${to.city}: ${Math.round(km).toLocaleString('da-DK')} km, ${compensationFor(km, from.zone === 'eu' && to.zone === 'eu').eur} € pr. person.`;
    } else $('#b-distance').textContent = '';
  };
  bf.addEventListener('change', show); show();
  bf.addEventListener('submit', (e) => { e.preventDefault(); write(); });

  function write() {
    const v = (n) => (bf.elements[n]?.value || '').trim();
    const from = byIata[v('fra')], to = byIata[v('til')];
    const hvad = bf.hvad.value, lang = bf.sprog.value;
    const al = airlines.find((a) => a.slug === alSel.value);
    const airline = alSel.value === 'andet' ? v('selskabAndet') : al?.name || '';
    const missing = [];
    if (!airline) missing.push('flyselskab');
    if (!from || !to || from === to) missing.push('fra og til lufthavn');
    if (!v('booking')) missing.push('bookingnummer');
    if (!v('flynr')) missing.push('flynummer');
    if (!v('dato')) missing.push('afgangsdato');
    if (!v('pax')) missing.push('passagerer');
    if (hvad === 'forsinket' && (!v('plan') || !v('faktisk'))) missing.push('planlagt og faktisk ankomst');
    if (hvad === 'aflyst' && !v('besked')) missing.push('dato for besked om aflysning');
    if (!v('navn')) missing.push('dit navn');
    if (!v('mail')) missing.push('e-mail');
    const err = $('#b-fejl');
    if (missing.length) { err.textContent = 'Udfyld: ' + missing.join(', ') + '.'; err.style.color = '#a12626'; return; }
    err.textContent = '';

    const km = Math.round(haversineKm(from, to));
    const comp = compensationFor(km, from.zone === 'eu' && to.zone === 'eu');
    const pax = v('pax').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    const total = comp.eur * pax.length;
    const dateFmt = (iso, l) => new Date(iso + 'T12:00:00').toLocaleDateString(l === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const tm = (t) => (lang === 'da' ? t.replace(':', '.') : t);
    const nextDay = bf.elements.naesteDag.checked;
    let delayMin = 0, daysBefore = null;
    if (hvad === 'forsinket') {
      const [ph, pm] = v('plan').split(':').map(Number), [fh, fm] = v('faktisk').split(':').map(Number);
      delayMin = (fh * 60 + fm) - (ph * 60 + pm) + (nextDay ? 1440 : 0);
      if (delayMin < 0) delayMin += 1440;
    }
    if (hvad === 'aflyst') daysBefore = Math.round((new Date(v('dato')) - new Date(v('besked'))) / 86400000);
    const h = Math.floor(delayMin / 60), m = delayMin % 60;
    const durDa = `${h} time${h === 1 ? '' : 'r'}${m ? ` og ${m} minutter` : ''}`;
    const durEn = `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minutes` : ''}`;

    const warnings = [];
    if (hvad === 'forsinket' && delayMin < 180) warnings.push(`Forsinkelsen er ${durDa}. Kompensation kræver mindst 3 timer ved ankomsten. Brevet kan stadig bruges til at kræve forplejning og udgifter dækket, men ikke det faste beløb.`);
    if (hvad === 'aflyst' && daysBefore >= 14) warnings.push(`Du fik besked ${daysBefore} dage før afgang. Med 14 dages varsel eller mere er der ikke krav på kompensation, kun på refusion eller ombookning. Brevet er tilpasset det.`);
    if (hvad === 'aflyst' && daysBefore !== null && daysBefore < 0) warnings.push('Datoen for besked ligger efter afgangsdatoen. Tjek datoerne.');
    if (from.zone !== 'eu' && (!al || al.zone !== 'eu')) warnings.push(`Flyvningen afgår fra ${from.name} uden for EU${al ? `, og ${al.name} er ikke et EU-selskab` : ''}. EU-reglerne gælder muligvis ikke her. Tjek i beregneren først.`);
    if (['vejr', 'ekstern-strejke'].includes(v('aarsag'))) warnings.push('Vejr og strejke uden for selskabet er som regel usædvanlige omstændigheder. Brevet beder om dokumentation, men vær forberedt på et nej til det faste beløb. Retten til refusion, ombookning og forplejning gælder uanset.');
    const warn = $('#b-advarsel');
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.map((w) => `<p style="margin:4px 0">${w}</p>`).join('');

    const noComp = (hvad === 'forsinket' && delayMin < 180) || (hvad === 'aflyst' && daysBefore >= 14);
    const route = `${from.name} (${from.iata}) ${lang === 'da' ? 'til' : 'to'} ${to.name} (${to.iata})`;
    const causeDa = { teknisk: 'en teknisk fejl', personale: 'manglende besætning', operationelt: 'operationelle årsager', 'egen-strejke': 'strejke blandt jeres eget personale', 'ekstern-strejke': 'strejke uden for selskabet', vejr: 'vejret', andet: 'andre forhold' }[v('aarsag')];
    const causeEn = { teknisk: 'a technical fault', personale: 'crew shortage', operationelt: 'operational reasons', 'egen-strejke': 'a strike by your own staff', 'ekstern-strejke': 'a strike outside your company', vejr: 'the weather', andet: 'other circumstances' }[v('aarsag')];
    const expenses = v('udgifter');
    const account = bf.elements.konto.value === 'nu' && v('kontonr') ? v('kontonr') : null;
    const ombook = bf.elements.ombook.value;
    const sig = `${v('navn')}${v('adresse') ? '\n' + v('adresse') : ''}\n${v('mail')}${v('tlf') ? ', ' + v('tlf') : ''}`;
    const head = `${v('booking').toUpperCase()}|${v('flynr').toUpperCase()}`.split('|');
    let text;

    if (lang === 'da') {
      const what = hvad === 'forsinket'
        ? `Planlagt ankomst til ${to.city}: kl. ${tm(v('plan'))}. Faktisk ankomst (døren åbnet): kl. ${tm(v('faktisk'))}${nextDay ? ' den følgende dag' : ''}, det vil sige ${durDa} for sent til min endelige destination.`
        : hvad === 'aflyst'
          ? `Flyvningen blev aflyst. Jeg fik besked den ${dateFmt(v('besked'), 'da')}, det vil sige ${daysBefore} dag${daysBefore === 1 ? '' : 'e'} før afgang.${ombook === 'ingen' ? ' Jeg blev ikke tilbudt en brugbar ombookning.' : ombook === 'senere' ? ' Den tilbudte ombookning bragte mig frem mere end 2 timer senere end planlagt.' : ''}`
          : 'Jeg blev nægtet boarding mod min vilje, selv om jeg havde bekræftet reservation og var mødt rettidigt til check-in og gate.';
      const claim = noComp
        ? `Jeg gør krav på ${hvad === 'aflyst' ? 'fuld refusion af billetten inden 7 dage, jf. artikel 8, samt ' : ''}dækning af de udgifter, jeg har haft som følge af ${hvad === 'aflyst' ? 'aflysningen' : 'forsinkelsen'}, jf. artikel 9.`
        : `Rutens storcirkelafstand er ${km.toLocaleString('da-DK')} km. Efter forordningens artikel 7 har hver passager derfor krav på ${comp.eur} €, i alt ${total.toLocaleString('da-DK')} € for ${pax.length} passager${pax.length === 1 ? '' : 'er'}.${hvad === 'aflyst' ? ' Herudover gør jeg krav på refusion af billetten eller ombookning efter artikel 8, i det omfang det ikke allerede er sket.' : ''}`;
      const evidence = noComp ? '' : `\nMener I, at ${hvad === 'aflyst' ? 'aflysningen' : hvad === 'forsinket' ? 'forsinkelsen' : 'afvisningen'} skyldtes usædvanlige omstændigheder, beder jeg om konkret dokumentation for den pågældende flyvning: hvad der skete, hvornår, og hvilke rimelige forholdsregler I traf for at undgå det. Jeg gør opmærksom på, at tekniske fejl, besætningsproblemer og strejke blandt eget personale ifølge EU-Domstolens praksis (bl.a. sagerne C-549/07, C-195/17 og C-28/20) ikke er usædvanlige omstændigheder.${hvad === 'naegtet-boarding' ? ' Ved nægtet boarding gælder undtagelsen for usædvanlige omstændigheder i øvrigt ikke.' : ''}\n`;
      text = `Til ${airline}, kundeservice

Krav om kompensation efter forordning (EF) nr. 261/2004

Bookingnummer: ${head[0]}
Flynummer: ${head[1]}
Dato: ${dateFmt(v('dato'), 'da')}
Rute: ${route}
Passagerer: ${pax.join(', ')}

${what}${v('aarsag') !== 'ved-ikke' && causeDa ? ` Som årsag oplyste I ${causeDa}.` : ''}

${claim}
${expenses ? `\nJeg har desuden haft følgende udgifter, som jeg beder om at få dækket efter artikel 9, og som jeg kan dokumentere med kvitteringer: ${expenses}.\n` : ''}
${account ? `Jeg beder om, at beløbet overføres inden 14 dage til konto ${account}.` : 'Jeg beder om, at I inden 14 dage bekræfter kravet, hvorefter jeg oplyser kontonummer til udbetaling.'}
${evidence}
Får jeg ikke svar inden 6 uger, indbringer jeg sagen for Trafikstyrelsen${from.cc !== 'DK' ? ' eller den kompetente myndighed i afgangslandet' : ''}.

Med venlig hilsen
${sig}`;
    } else {
      const what = hvad === 'forsinket'
        ? `Scheduled arrival at ${to.city}: ${tm(v('plan'))}. Actual arrival (doors opened): ${tm(v('faktisk'))}${nextDay ? ' the following day' : ''}, i.e. ${durEn} late at my final destination.`
        : hvad === 'aflyst'
          ? `The flight was cancelled. I was informed on ${dateFmt(v('besked'), 'en')}, i.e. ${daysBefore} day${daysBefore === 1 ? '' : 's'} before departure.${ombook === 'ingen' ? ' I was not offered any usable re-routing.' : ombook === 'senere' ? ' The re-routing offered brought me to my destination more than 2 hours later than scheduled.' : ''}`
          : 'I was denied boarding against my will despite holding a confirmed reservation and presenting myself for check-in and at the gate on time.';
      const claim = noComp
        ? `I claim ${hvad === 'aflyst' ? 'a full refund of the ticket within 7 days under Article 8, and ' : ''}reimbursement of the expenses I incurred as a result of the ${hvad === 'aflyst' ? 'cancellation' : 'delay'} under Article 9.`
        : `The great-circle distance of the route is ${km.toLocaleString('en-GB')} km. Under Article 7 of the Regulation each passenger is therefore entitled to EUR ${comp.eur}, a total of EUR ${total.toLocaleString('en-GB')} for ${pax.length} passenger${pax.length === 1 ? '' : 's'}.${hvad === 'aflyst' ? ' In addition I claim a refund or re-routing under Article 8, to the extent not already provided.' : ''}`;
      const evidence = noComp ? '' : `\nIf you consider that the ${hvad === 'aflyst' ? 'cancellation' : hvad === 'forsinket' ? 'delay' : 'denial of boarding'} was caused by extraordinary circumstances, I request specific evidence relating to this particular flight: what happened, when, and which reasonable measures you took to avoid it. I note that technical faults, crew shortages and strikes by your own staff are not extraordinary circumstances according to the case law of the Court of Justice of the EU (cases C-549/07, C-195/17 and C-28/20 among others).${hvad === 'naegtet-boarding' ? ' In cases of denied boarding the extraordinary-circumstances defence does not apply at all.' : ''}\n`;
      text = `To ${airline}, Customer Relations

Claim for compensation under Regulation (EC) No 261/2004

Booking reference: ${head[0]}
Flight number: ${head[1]}
Date: ${dateFmt(v('dato'), 'en')}
Route: ${route}
Passengers: ${pax.join(', ')}

${what}${v('aarsag') !== 'ved-ikke' && causeEn ? ` The reason given was ${causeEn}.` : ''}

${claim}
${expenses ? `\nI also incurred the following expenses, which I ask you to reimburse under Article 9 and can document with receipts: ${expenses}.\n` : ''}
${account ? `Please transfer the amount within 14 days to account ${account}.` : 'Please confirm the claim within 14 days, after which I will provide bank details for payment.'}
${evidence}
If I do not receive a reply within 6 weeks I will refer the matter to the Danish Civil Aviation and Railway Authority (Trafikstyrelsen)${from.cc !== 'DK' ? ' or the competent national enforcement body in the country of departure' : ''}.

Yours faithfully
${sig}`;
    }
    text = text.replace(/\n{3,}/g, '\n\n');
    $('#brev-tekst').textContent = text;
    const subject = lang === 'da' ? `Krav om kompensation, ${head[1]} den ${dateFmt(v('dato'), 'da')}, booking ${head[0]}` : `Compensation claim, ${head[1]} on ${dateFmt(v('dato'), 'en')}, booking ${head[0]}`;
    $('#b-mailto').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    $('#b-hvorhen').innerHTML = al
      ? `Send brevet via <a href="${al.claim}" target="_blank" rel="noopener">${al.name}s kundeservice eller klageformular</a>. Har formularen et fritekstfelt, så sæt brevet ind dér. Gem en kopi af det, du sender, og datoen.`
      : 'Find selskabets klageformular eller kundeservice-mail på deres hjemmeside, og sæt brevet ind. Gem en kopi og datoen.';
    $('#brev-ud').hidden = false;
    $('#brev-ud').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
