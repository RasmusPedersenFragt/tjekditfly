// Brevgeneratoren på /klag-selv/. Brugeren udfylder felter, og brevet skrives ud fra regelmotorens vurdering
// (assess i eu261.mjs), så brevet aldrig kræver mere, end reglerne giver. Alt sker i browseren; intet sendes
// til os. Knappen "Åbn i dit mailprogram" lægger teksten i brugerens eget mailprogram eller webmail.
import { haversineKm, compensationFor, coverage, assess, assistanceThresholdH } from '/assets/eu261.js?v=c31976c5';

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
    $('#b-boarding').hidden = hvad !== 'naegtet-boarding';
    $('#b-selskab-andet-wrap').hidden = alSel.value !== 'andet';
    $('#b-aarsag-wrap').hidden = hvad === 'naegtet-boarding';
    const from = byIata[$('#b-fra').value], to = byIata[$('#b-til').value];
    if (from && to && from !== to) {
      const km = haversineKm(from, to);
      const c = compensationFor(km, from.zone === 'eu' && to.zone === 'eu');
      const cov = coverage(from, to, airlineZone());
      $('#b-distance').textContent = `${from.city} til ${to.city}: ${Math.round(km).toLocaleString('da-DK')} km, ${c.eur} € pr. person. ` + (cov.covered === false ? 'Denne flyvning er ikke dækket af EU-reglerne.' : cov.covered === null ? 'Vælg flyselskab: på denne rute afhænger dækningen af, om selskabet er et EU-selskab.' : '');
    } else $('#b-distance').textContent = '';
  };
  function airlineZone() {
    const al = airlines.find((a) => a.slug === alSel.value);
    if (al) return al.zone;
    if (alSel.value === 'andet') return bf.elements.andetZone.value || 'unknown';
    return 'unknown';
  }
  bf.addEventListener('change', show); show();
  bf.addEventListener('submit', (e) => { e.preventDefault(); write(); });

  const out = $('#brev-ud'), warn = $('#b-advarsel'), letterEl = $('#brev-tekst'), actions = $('#b-actions');
  function block(html) {
    warn.hidden = false; warn.className = 'verdict nej'; warn.innerHTML = html;
    letterEl.hidden = true; actions.hidden = true; $('#b-hvorhen').textContent = ''; $('#b-overskrift').hidden = true;
    out.hidden = false; out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

    // Tider og frister
    const nextDay = bf.elements.naesteDag.checked;
    let delayMin = 0, daysBefore = null;
    if (hvad === 'forsinket') {
      const [ph, pm] = v('plan').split(':').map(Number), [fh, fm] = v('faktisk').split(':').map(Number);
      delayMin = (fh * 60 + fm) - (ph * 60 + pm) + (nextDay ? 1440 : 0);
      if (delayMin < 0) delayMin += 1440;
    }
    if (hvad === 'aflyst') {
      daysBefore = Math.round((new Date(v('dato')) - new Date(v('besked'))) / 86400000);
      if (daysBefore < 0) { block('<h2>Tjek datoerne</h2><p>Datoen for besked om aflysningen ligger efter afgangsdatoen.</p>'); return; }
    }
    const rerouteRaw = hvad === 'aflyst' ? v('ombook') : '';
    const rerouteH = rerouteRaw === '' ? null : Number(rerouteRaw);
    const voluntary = hvad === 'naegtet-boarding' && v('frivillig') === 'ja';
    const causeMap = { 'ved-ikke': 'ved-ikke', teknisk: 'teknisk', personale: 'personale', operationelt: 'operationelt', 'egen-strejke': 'egen-strejke', 'ekstern-strejke': 'ekstern-strejke', vejr: 'vejr', andet: 'ved-ikke' };
    const cause = hvad === 'naegtet-boarding' ? 'ved-ikke' : (causeMap[v('aarsag')] || 'ved-ikke');

    // Dækning og vurdering fra regelmotoren
    const zone = airlineZone();
    const cov = coverage(from, to, zone);
    if (cov.covered === false) {
      block(`<h2>EU-reglerne gælder ikke for denne flyvning</h2><p>${cov.why}</p><p>Vi laver ikke et brev, der kræver kompensation efter forordning 261/2004, når den ikke gælder. Tjek i stedet flyselskabets egne vilkår, afgangslandets passagerregler og din rejseforsikring. <a href="/beregn/?fra=${from.iata}&til=${to.iata}&hvad=${hvad}">Se vurderingen i beregneren</a>.</p>`);
      return;
    }
    if (cov.covered === null) {
      block(`<h2>Vælg flyselskab først</h2><p>${cov.why} Vælg selskabet i listen, eller vælg "Andet selskab" og angiv, om det har licens i et EU-land.</p>`);
      return;
    }
    if (voluntary) {
      block('<h2>Frivilligt afgivet plads: aftalen gælder</h2><p>Meldte du dig frivilligt og aftalte en godtgørelse med selskabet, er det den aftale, der gælder, ikke den faste kompensation i forordningen. Et brev, der kræver kompensation "mod min vilje", ville være forkert. Har selskabet ikke leveret det, I aftalte, så skriv til dem med henvisning til aftalen og dokumentationen for den.</p>');
      return;
    }
    const r = assess({ from, to, airlineZone: zone, situation: hvad, delayH: delayMin / 60, noticeDays: daysBefore, rerouteH, cause, voluntary });
    const km = r.km;
    const pax = v('pax').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    const h = Math.floor(delayMin / 60), m = delayMin % 60;
    const durDa = `${h} time${h === 1 ? '' : 'r'}${m ? ` og ${m} minutter` : ''}`;
    const durEn = `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minutes` : ''}`;
    const assistH = assistanceThresholdH(km);
    const expenses = v('udgifter');
    const rerouted = hvad === 'aflyst' && rerouteH !== null; // fløj med selskabets ombookning
    const hasComp = r.eur > 0;
    const canClaimAssistance = hvad !== 'forsinket' || delayMin >= assistH * 60;
    const canClaimRefund = hvad === 'aflyst' && !rerouted; // valgretten er brugt, hvis man tog ombookningen
    const claimExpenses = expenses && canClaimAssistance;

    // Intet at kræve: sig det i stedet for at lave et brev
    if (!hasComp && !canClaimRefund && !claimExpenses) {
      const why = r.reasons.map((x) => `<li>${x}</li>`).join('');
      const tip = hvad === 'forsinket' && delayMin < assistH * 60
        ? `<p>På denne rute (${km.toLocaleString('da-DK')} km) giver forordningen først ret til forplejning fra ${assistH} timers forsinkelse og kompensation fra 3 timer ved ankomsten. Har du haft udgifter alligevel, kan du prøve selskabets kundeservice eller din rejseforsikring, men der er ikke et krav efter forordningen at henvise til.</p>`
        : hvad === 'forsinket' ? '<p>Havde du udgifter til mad eller transport i ventetiden, så skriv dem i feltet "Udgifter", så laver vi et brev om dem.</p>'
          : rerouted ? '<p>Du tog imod selskabets ombookning, så retten til refusion er brugt. Havde du udgifter i ventetiden, så skriv dem i feltet "Udgifter".</p>' : '';
      block(`<h2>Der er ikke et krav at skrive brev om</h2><ul>${why}</ul>${tip}<p><a href="/beregn/?fra=${from.iata}&til=${to.iata}&hvad=${hvad}${al ? '&selskab=' + al.slug : ''}">Se hele vurderingen i beregneren</a>.</p>`);
      return;
    }

    // Advarsler, når brevet laves med forbehold
    const warnings = [];
    if (!hasComp) warnings.push('Der er ikke krav på det faste kompensationsbeløb i din situation. Brevet kræver derfor kun ' + [canClaimRefund ? 'refusion' : '', claimExpenses ? 'dækning af udgifter' : ''].filter(Boolean).join(' og ') + '.');
    if (hasComp && r.verdict === 'sandsynligvis') warnings.push('Brevet kræver kompensation, men selskabet kan have dokumentation for en usædvanlig omstændighed, som vi ikke kender. Regn med, at de kan afvise, og bed så om dokumentationen.');
    if (r.halved) warnings.push(`Beløbet i brevet er halveret til ${r.eur} €, fordi reglerne tillader det i din situation. Det er det korrekte beløb at kræve.`);
    if (['vejr', 'ekstern-strejke'].includes(cause) && hasComp) warnings.push('Vejr og strejke uden for selskabet er som regel usædvanlige omstændigheder. Vær forberedt på et nej til det faste beløb. Retten til refusion, ombookning og forplejning gælder uanset.');
    warn.hidden = !warnings.length; warn.className = 'notice';
    warn.innerHTML = warnings.map((w) => `<p style="margin:4px 0">${w}</p>`).join('');

    const total = r.eur * pax.length;
    const curr = r.currency || '€';
    const law = r.law === 'UK261' ? { da: 'de britiske regler om flypassagerers rettigheder (UK261, forordning 261/2004 som overført i britisk ret)', en: 'Regulation (EC) No 261/2004 as retained in UK law (UK261)' } : { da: 'forordning (EF) nr. 261/2004', en: 'Regulation (EC) No 261/2004' };
    const dateFmt = (iso, l) => new Date(iso + 'T12:00:00').toLocaleDateString(l === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const tm = (t) => (lang === 'da' ? t.replace(':', '.') : t);
    const account = bf.elements.konto.value === 'nu' && v('kontonr') ? v('kontonr') : null;
    const sig = `${v('navn')}${v('adresse') ? '\n' + v('adresse') : ''}\n${v('mail')}${v('tlf') ? ', ' + v('tlf') : ''}`;
    const booking = v('booking').toUpperCase(), flynr = v('flynr').toUpperCase();
    const authority = r.law === 'UK261' ? { da: 'den britiske luftfartsmyndighed CAA', en: 'the UK Civil Aviation Authority' } : from.cc === 'DK' ? { da: 'Trafikstyrelsen', en: 'the Danish Civil Aviation and Railway Authority (Trafikstyrelsen)' } : { da: 'den kompetente myndighed i afgangslandet', en: 'the competent national enforcement body in the country of departure' };
    const causeDa = { teknisk: 'en teknisk fejl', personale: 'manglende besætning', operationelt: 'operationelle årsager', 'egen-strejke': 'strejke blandt jeres eget personale', 'ekstern-strejke': 'strejke uden for selskabet', vejr: 'vejret' }[v('aarsag')];
    const causeEn = { teknisk: 'a technical fault', personale: 'crew shortage', operationelt: 'operational reasons', 'egen-strejke': 'a strike by your own staff', 'ekstern-strejke': 'a strike outside your company', vejr: 'the weather' }[v('aarsag')];
    const ombookDa = rerouteH === null ? ' Jeg blev ikke tilbudt en brugbar ombookning.' : rerouteH <= 2 ? ' Med den tilbudte ombookning nåede jeg frem højst 2 timer senere end planlagt.' : ` Med den tilbudte ombookning nåede jeg frem ${rerouteH === 5 ? 'mere end 4' : `${rerouteH - 1} til ${rerouteH}`} timer senere end planlagt.`;
    const ombookEn = rerouteH === null ? ' I was not offered any usable re-routing.' : rerouteH <= 2 ? ' With the re-routing offered I arrived at most 2 hours later than scheduled.' : ` With the re-routing offered I arrived ${rerouteH === 5 ? 'more than 4' : `${rerouteH - 1} to ${rerouteH}`} hours later than scheduled.`;
    let text;

    if (lang === 'da') {
      const what = hvad === 'forsinket'
        ? `Planlagt ankomst til ${to.city}: kl. ${tm(v('plan'))}. Faktisk ankomst (døren åbnet): kl. ${tm(v('faktisk'))}${nextDay ? ' den følgende dag' : ''}, det vil sige ${durDa} for sent til min endelige destination.`
        : hvad === 'aflyst'
          ? `Flyvningen blev aflyst. Jeg fik besked den ${dateFmt(v('besked'), 'da')}, det vil sige ${daysBefore} dag${daysBefore === 1 ? '' : 'e'} før afgang.${ombookDa}`
          : 'Jeg blev nægtet boarding mod min vilje, selv om jeg havde bekræftet reservation og var mødt rettidigt til check-in og gate. Jeg meldte mig ikke frivilligt.';
      const parts = [];
      if (hasComp) parts.push(`Rutens storcirkelafstand er ${km.toLocaleString('da-DK')} km. Efter forordningens artikel 7 har hver passager derfor krav på ${r.eur} ${curr}${r.halved ? ' (efter den halvering, artikel 7, stk. 2, giver mulighed for)' : ''}, i alt ${total.toLocaleString('da-DK')} ${curr} for ${pax.length} passager${pax.length === 1 ? '' : 'er'}.`);
      if (canClaimRefund) parts.push(`Jeg gør ${hasComp ? 'desuden' : ''} krav på fuld refusion af billetten inden 7 dage efter artikel 8, stk. 1, litra a, i det omfang refusion ikke allerede er sket.`);
      if (claimExpenses) parts.push(`Jeg har haft følgende udgifter, som jeg beder om at få dækket efter artikel 9, og som jeg kan dokumentere med kvitteringer: ${expenses}.`);
      const evidence = !hasComp ? '' : `\nMener I, at ${hvad === 'aflyst' ? 'aflysningen' : hvad === 'forsinket' ? 'forsinkelsen' : 'afvisningen'} skyldtes usædvanlige omstændigheder, beder jeg om konkret dokumentation for den pågældende flyvning: hvad der skete, hvornår, og hvilke rimelige forholdsregler I traf for at undgå det. Jeg gør opmærksom på, at tekniske fejl, besætningsproblemer og strejke blandt eget personale ifølge EU-Domstolens praksis (bl.a. sagerne C-549/07, C-195/17 og C-28/20) ikke er usædvanlige omstændigheder.${hvad === 'naegtet-boarding' ? ' Ved nægtet boarding gælder undtagelsen for usædvanlige omstændigheder i øvrigt ikke.' : ''}\n`;
      text = `Til ${airline}, kundeservice

Krav efter ${law.da}

Bookingnummer: ${booking}
Flynummer: ${flynr}
Dato: ${dateFmt(v('dato'), 'da')}
Rute: ${from.name} (${from.iata}) til ${to.name} (${to.iata})
Passagerer: ${pax.join(', ')}

${what}${causeDa ? ` Som årsag oplyste I ${causeDa}.` : ''}

${parts.join('\n\n')}

${account ? `Jeg beder om, at beløbet overføres inden 14 dage til konto ${account}.` : 'Jeg beder om, at I inden 14 dage bekræfter kravet, hvorefter jeg oplyser kontonummer til udbetaling.'}
${evidence}
Får jeg ikke svar inden 6 uger, indbringer jeg sagen for ${authority.da}.

Med venlig hilsen
${sig}`;
    } else {
      const what = hvad === 'forsinket'
        ? `Scheduled arrival at ${to.city}: ${tm(v('plan'))}. Actual arrival (doors opened): ${tm(v('faktisk'))}${nextDay ? ' the following day' : ''}, i.e. ${durEn} late at my final destination.`
        : hvad === 'aflyst'
          ? `The flight was cancelled. I was informed on ${dateFmt(v('besked'), 'en')}, i.e. ${daysBefore} day${daysBefore === 1 ? '' : 's'} before departure.${ombookEn}`
          : 'I was denied boarding against my will despite holding a confirmed reservation and presenting myself for check-in and at the gate on time. I did not volunteer to surrender my seat.';
      const parts = [];
      if (hasComp) parts.push(`The great-circle distance of the route is ${km.toLocaleString('en-GB')} km. Under Article 7 of the Regulation each passenger is therefore entitled to ${curr === '£' ? 'GBP' : 'EUR'} ${r.eur}${r.halved ? ' (after the 50 % reduction permitted by Article 7(2))' : ''}, a total of ${curr === '£' ? 'GBP' : 'EUR'} ${total.toLocaleString('en-GB')} for ${pax.length} passenger${pax.length === 1 ? '' : 's'}.`);
      if (canClaimRefund) parts.push(`I ${hasComp ? 'also ' : ''}claim a full refund of the ticket within 7 days under Article 8(1)(a), to the extent not already provided.`);
      if (claimExpenses) parts.push(`I incurred the following expenses, which I ask you to reimburse under Article 9 and can document with receipts: ${expenses}.`);
      const evidence = !hasComp ? '' : `\nIf you consider that the ${hvad === 'aflyst' ? 'cancellation' : hvad === 'forsinket' ? 'delay' : 'denial of boarding'} was caused by extraordinary circumstances, I request specific evidence relating to this particular flight: what happened, when, and which reasonable measures you took to avoid it. I note that technical faults, crew shortages and strikes by your own staff are not extraordinary circumstances according to the case law of the Court of Justice of the EU (cases C-549/07, C-195/17 and C-28/20 among others).${hvad === 'naegtet-boarding' ? ' In cases of denied boarding the extraordinary-circumstances defence does not apply at all.' : ''}\n`;
      text = `To ${airline}, Customer Relations

Claim under ${law.en}

Booking reference: ${booking}
Flight number: ${flynr}
Date: ${dateFmt(v('dato'), 'en')}
Route: ${from.name} (${from.iata}) to ${to.name} (${to.iata})
Passengers: ${pax.join(', ')}

${what}${causeEn ? ` The reason given was ${causeEn}.` : ''}

${parts.join('\n\n')}

${account ? `Please transfer the amount within 14 days to account ${account}.` : 'Please confirm the claim within 14 days, after which I will provide bank details for payment.'}
${evidence}
If I do not receive a reply within 6 weeks I will refer the matter to ${authority.en}.

Yours faithfully
${sig}`;
    }
    text = text.replace(/\n{3,}/g, '\n\n');
    letterEl.hidden = false; actions.hidden = false; $('#b-overskrift').hidden = false;
    letterEl.textContent = text;
    const subject = lang === 'da' ? `Krav om ${hasComp ? 'kompensation' : 'refusion'}, ${flynr} den ${dateFmt(v('dato'), 'da')}, booking ${booking}` : `${hasComp ? 'Compensation' : 'Refund'} claim, ${flynr} on ${dateFmt(v('dato'), 'en')}, booking ${booking}`;
    $('#b-mailto').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    $('#b-hvorhen').innerHTML = al
      ? `Send brevet via <a href="${al.claim}" target="_blank" rel="noopener">${al.name}s kundeservice eller klageformular</a>. Har formularen et fritekstfelt, så sæt brevet ind dér. Gem en kopi af det, du sender, og datoen.`
      : 'Find selskabets klageformular eller kundeservice-mail på deres hjemmeside, og sæt brevet ind. Gem en kopi og datoen.';
    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
