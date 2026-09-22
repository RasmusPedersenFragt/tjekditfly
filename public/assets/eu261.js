// Reglerne i EU-forordning 261/2004 som kode. Bruges både ved build (rutesider) og i browseren (beregner og brev).
// Kilder: forordningens artikel 3 (anvendelse), 4 (nægtet boarding), 5 (aflysning), 6 (forsinkelse), 7 (kompensation),
// 8 (refusion/ombookning) og EU-Domstolens praksis: Sturgeon C-402/07 (forsinkelse over 3 timer = kompensation),
// Folkerts C-11/11 (forsinkelsen måles ved endelig destination), Wallentin-Hermann C-549/07 og van der Lans C-257/14
// (tekniske fejl), Germanwings C-501/17 (fremmedlegeme på banen), Eglītis C-294/10 og AirHelp mod Austrian C-399/24
// (rimelige forholdsregler skal også bevises), Krüsemann C-195/17 og Airhelp mod SAS C-28/20 (egen strejke er ikke
// usædvanlig), Finnair mod Lassooy C-22/11 (nægtet boarding uden undtagelse), Delfly C-356/19 (udbetaling i egen valuta).
// Gennemgået juridisk 22. september 2026. Ingen eksterne afhængigheder; kopieres direkte til public/assets.

export const EUR_DKK = 7.46; // Danmarks fastkurs over for euroen ligger stabilt omkring 7,46
export const GBP_DKK = 8.7;
export const RULES_VERSION = '2026-09-22';

export function haversineKm(a, b) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Artikel 7, stk. 1 og 2: beløb efter afstand, og grænsen for halvering ved ombookning (2/3/4 timer). Ruter inden for EU over 1.500 km: 400 € og 3 timer. */
export function compensationFor(km, bothInEu) {
  if (km <= 1500) return { eur: 250, band: 'op til 1.500 km', rerouteLimitH: 2 };
  if (km <= 3500 || bothInEu) return { eur: 400, band: bothInEu && km > 3500 ? 'over 3.500 km inden for EU' : '1.500 til 3.500 km', rerouteLimitH: 3 };
  return { eur: 600, band: 'over 3.500 km uden for EU', rerouteLimitH: 4 };
}

export const dkk = (eur) => Math.round((eur * EUR_DKK) / 5) * 5;

/** Artikel 6, stk. 1: forplejning ved forsinkelse udløses efter 2 timer (op til 1.500 km), 3 timer (1.500-3.500 km og alle ruter inden for EU over 1.500 km) eller 4 timer (øvrige). Måles mod planlagt afgang. */
export const assistanceThresholdH = (km, bothInEu = false) => (km <= 1500 ? 2 : km <= 3500 || bothInEu ? 3 : 4);

/** Artikel 10, stk. 2: refusion ved nedgradering. */
export const downgradePct = (km, bothInEu = false) => (km <= 1500 ? 30 : km <= 3500 || bothInEu ? 50 : 75);

/**
 * Gælder forordningen for flyvningen? from/to har zone: 'eu' | 'uk' | 'other'. airlineZone ligeledes ('unknown' hvis ukendt).
 * Afgang fra EU/EØS/Schweiz: altid. Ankomst til EU fra land udenfor: kun med EU-selskab. Afgang fra Storbritannien: UK261 (samme regler i pund).
 * Ankomst til EU fra Storbritannien med EU-selskab: både UK261 og EU261; vi angiver EU261 og nævner valget.
 */
export function coverage(from, to, airlineZone) {
  if (from.zone === 'eu') return { covered: true, law: 'EU261', why: `Flyvningen afgår fra ${from.name}, som er omfattet af EU-reglerne. Så gælder reglerne, uanset hvilket selskab der flyver.` };
  if (to.zone === 'eu' && airlineZone === 'eu') return { covered: true, law: 'EU261', both: from.zone === 'uk', why: `Flyvningen lander i EU, og selskabet er et EU-selskab. Så gælder EU-reglerne, også selvom afgangen er fra ${from.name}.${from.zone === 'uk' ? ' Afgangen fra Storbritannien er samtidig dækket af UK261, og du kan vælge det regelsæt, der passer dig bedst.' : ''}` };
  if (from.zone === 'uk') return { covered: true, law: 'UK261', why: `Flyvningen afgår fra Storbritannien. Her gælder den britiske kopi af reglerne (UK261) med samme grænser, blot i pund: 220, 350 eller 520 £.` };
  if (to.zone === 'uk' && airlineZone === 'uk') return { covered: true, law: 'UK261', why: 'Flyvningen lander i Storbritannien med et britisk selskab, så UK261 gælder.' };
  if (to.zone === 'eu' && airlineZone === 'unknown') return { covered: null, law: 'EU261', why: `Flyvningen lander i EU fra et land uden for EU. Så gælder reglerne kun, hvis selskabet har licens i et EU-land, Norge, Island eller Schweiz. Vælg flyselskab for at få et klart svar.` };
  return { covered: false, law: null, why: `Flyvningen afgår fra ${from.name} uden for EU${to.zone === 'eu' ? ', og selskabet er ikke et EU-selskab' : ''}. EU-reglerne gælder ikke. Landets egne regler kan gælde, og din rejseforsikring kan dække udgifter.` };
}

/**
 * Er årsagen en "usædvanlig omstændighed"? extraordinary: true (som udgangspunkt ja), false (nej), null (ukendt).
 * Selv når svaret er ja, er selskabet kun fritaget, hvis det også beviser, at forsinkelsen ikke kunne undgås med rimelige forholdsregler.
 */
export function causeAssessment(cause) {
  switch (cause) {
    case 'teknisk': return { extraordinary: false, text: 'Tekniske fejl, der opstår som led i den normale drift, er selskabets eget ansvar, også når de opdages uventet (EU-Domstolen, C-549/07 og C-257/14). Undtagelserne er få: skjulte fabrikationsfejl, sabotage og skader påført udefra, fx et fremmedlegeme på landingsbanen, der ødelægger et dæk (C-501/17).' };
    case 'personale': return { extraordinary: false, text: 'Manglende besætning, sygdom hos personalet, sen ankomst af besætning eller overskreden arbejdstid er selskabets planlægning og fritager som udgangspunkt ikke.' };
    case 'operationelt': return { extraordinary: false, text: 'Forsinket indkommende fly, rotationsproblemer, overbooking eller ombookning på grund af selskabets egne beslutninger er ikke usædvanlige omstændigheder.' };
    case 'egen-strejke': return { extraordinary: false, text: 'Strejke blandt flyselskabets eget personale, varslet eller ej, er ifølge EU-Domstolen (Krüsemann C-195/17 og Airhelp mod SAS C-28/20) en del af selskabets almindelige drift. Du har som udgangspunkt krav på kompensation.' };
    case 'vejr': return { extraordinary: true, text: 'Vejr, der reelt umuliggør flyvningen (tåge, storm, snestorm, askesky), er som regel en usædvanlig omstændighed. Selskabet skal dokumentere, at vejret ramte netop din flyvning, og at forsinkelsen ikke kunne begrænses, fx ved ombookning. "Dårligt vejr et sted i Europa" er ikke nok.' };
    case 'ekstern-strejke': return { extraordinary: true, text: 'Strejke uden for selskabet (flyveledere, lufthavnspersonale, sikkerhedskontrol) er som regel en usædvanlig omstændighed. Men selskabet skal både dokumentere, at netop din flyvning blev ramt, og at forsinkelsen ikke kunne undgås, fx ved ombookning. Var strejken varslet i god tid, er der ekstra grund til at bede om den dokumentation. Strejke hos handlingpersonale, selskabet selv har hyret, er ikke uden videre uden for dets kontrol.' };
    case 'sikkerhed': return { extraordinary: true, text: 'Lukket luftrum, politisk uro, terrortrussel, sikkerhedsrisiko eller myndighedsbeslutning er som regel usædvanlige omstændigheder. Selskabet skal stadig vise, at det gjorde, hvad det kunne, for at begrænse forsinkelsen.' };
    case 'atc': return { extraordinary: true, text: 'Restriktioner fra flyvekontrollen (slots, kapacitet i luftrummet) er som regel en usædvanlig omstændighed, hvis de ramte netop din flyvning. Rutinemæssige forsinkelser på grund af kendt kapacitetsmangel er omstridt. Bed om dokumentation.' };
    case 'fugl': return { extraordinary: true, text: 'Kollision med fugle er ifølge EU-Domstolen (Pešková C-315/15) en usædvanlig omstændighed. Selskabet skal dog have gjort alt for at begrænse forsinkelsen bagefter.' };
    default: return { extraordinary: null, text: 'Kender du ikke årsagen, så kræv kompensation alligevel. Det er selskabet, der skal bevise, at der var en usædvanlig omstændighed, og at de gjorde alt for at undgå den. Mange afvisninger holder ikke, når man spørger igen.' };
  }
}

const REASONABLE_MEASURES = 'Selskabet er kun fritaget, hvis det både beviser den usædvanlige omstændighed og at forsinkelsen ikke kunne være undgået med rimelige forholdsregler, fx ombookning på et andet fly eller indregnet reservetid (EU-Domstolen, C-294/10 og C-399/24). Kunne du have været ombooket til en afgang få timer senere og blev sat på en dagen efter, har du efter al sandsynlighed et krav. Bed altid om begge dele skriftligt.';

/**
 * Samlet vurdering.
 * situation: 'forsinket' | 'aflyst' | 'naegtet-boarding'
 * delayH: forsinkelse ved ankomst til endelig destination i timer (kan være decimal)
 * noticeDays: for aflysning, hvor mange dage før afgang du fik besked
 * rerouteH: hvor mange timer senere end planlagt du nåede frem med den tilbudte ombookning (null = ingen ombookning taget)
 * departEarlierH: hvor mange timer tidligere end planlagt ombookningen afgik (0 = samme tid eller senere)
 * cause: se causeAssessment. voluntary: frivilligt afgivet plads ved nægtet boarding.
 * verdict: 'ja' | 'sandsynligvis' | 'sandsynligvis-ikke' | 'nej'
 */
export function assess({ from, to, airlineZone = 'unknown', situation, delayH = 0, noticeDays = null, rerouteH = null, departEarlierH = 0, cause = 'ved-ikke', voluntary = false }) {
  const km = haversineKm(from, to);
  const bothInEu = from.zone === 'eu' && to.zone === 'eu';
  const comp = compensationFor(km, bothInEu);
  const cov = coverage(from, to, airlineZone);
  const out = { km: Math.round(km), band: comp.band, fullEur: comp.eur, eur: 0, dkk: 0, halved: false, halvedDisputed: false, verdict: 'nej', law: cov.law, reasons: [], rights: [], assistanceThresholdH: assistanceThresholdH(km, bothInEu) };
  if (cov.covered === false) { out.reasons.push(cov.why); return out; }
  out.reasons.push(cov.why);
  const curr = cov.law === 'UK261' ? '£' : '€';
  out.currency = curr;
  const gbp = { 250: 220, 400: 350, 600: 520 };
  const assistH = out.assistanceThresholdH;

  const c = causeAssessment(cause);
  let eligible = true;
  if (situation === 'forsinket') {
    if (delayH < 3) { eligible = false; out.reasons.push(`Kompensation kræver mindst 3 timers forsinkelse ved ankomsten til din endelige destination. På denne rute har du ret til forplejning fra ${assistH} timers forsinkelse ved afgangen; derunder giver forordningen ingen rettigheder.`); }
    else out.reasons.push(`Du ankom ${Math.floor(delayH)} timer eller mere for sent til din endelige destination. Det udløser kompensation, hvis selskabet ikke kan bevise en usædvanlig omstændighed og rimelige forholdsregler.`);
    if (delayH >= assistH) out.rights.push('Mad og drikke i rimeligt forhold til ventetiden, plus to telefonopkald eller e-mails (måles fra den planlagte afgang).');
    if (delayH >= 5) out.rights.push('Ved 5 timers forsinkelse ved afgangen: ret til at opgive rejsen og få refunderet den del af billetten, du ikke bruger, plus hele billetten og en returflyvning til udgangspunktet, hvis rejsen har mistet sit formål.');
    out.rights.push('Hotel og transport til og fra hotellet, hvis forsinkelsen betyder overnatning.');
  } else if (situation === 'aflyst') {
    // Artikel 5, stk. 1, litra c: begge betingelser (afgang tidligst x timer før OG ankomst senest y timer efter) skal være opfyldt, før kompensationen bortfalder.
    if (noticeDays !== null && noticeDays >= 14) { eligible = false; out.reasons.push('Fik du besked om aflysningen mindst 14 dage før afgang, har du ikke krav på kompensation. Du har ret til at vælge mellem refusion og ombookning.'); }
    else if (noticeDays !== null && noticeDays >= 7) {
      if (rerouteH !== null && rerouteH <= 4 && departEarlierH <= 2) { eligible = false; out.reasons.push('Besked 7 til 13 dage før og en ombookning, der afgik højst 2 timer tidligere og ankom højst 4 timer senere end planlagt, giver ikke kompensation.'); }
      else out.reasons.push('Besked 7 til 13 dage før afgang giver kompensation, medmindre du blev tilbudt en ombookning, der både afgik højst 2 timer før og ankom højst 4 timer efter det oprindelige tidspunkt.');
    } else {
      if (rerouteH !== null && rerouteH <= 2 && departEarlierH <= 1) { eligible = false; out.reasons.push('Besked under 7 dage før og en ombookning, der afgik højst 1 time tidligere og ankom højst 2 timer senere end planlagt, giver ikke kompensation.'); }
      else out.reasons.push('Besked under 7 dage før afgang (eller ingen besked) giver kompensation, medmindre du blev tilbudt en ombookning, der både afgik højst 1 time før og ankom højst 2 timer efter det oprindelige tidspunkt.');
    }
    out.rights.push('Valget mellem refusion af den del af rejsen, du ikke fik (og hele billetten, hvis rejsen dermed har mistet sit formål), inden for 7 dage, og ombookning til din destination ved først mulige lejlighed eller på en senere dato efter dit valg.');
    out.rights.push('Forplejning under ventetiden og hotel, hvis ombookningen først er næste dag.');
  } else if (situation === 'naegtet-boarding') {
    if (voluntary) { eligible = false; out.reasons.push('Afgav du frivilligt din plads mod en aftalt godtgørelse, gælder den aftale i stedet for kompensationen.'); }
    else out.reasons.push('Blev du nægtet boarding mod din vilje, typisk på grund af overbooking, har du krav på kompensation med det samme, uanset årsag (EU-Domstolen, Finnair mod Lassooy C-22/11). Undtagelsen er, hvis du mødte for sent, manglede gyldige rejsedokumenter eller udgjorde en sikkerhedsrisiko.');
    out.rights.push('Valget mellem refusion og ombookning, plus forplejning og eventuelt hotel.');
  }

  let likelyNot = false;
  if (eligible && situation !== 'naegtet-boarding') {
    if (c.extraordinary === true) { likelyNot = true; out.reasons.push(c.text); out.reasons.push(REASONABLE_MEASURES); }
    else out.reasons.push(c.text);
  }

  if (eligible) {
    let eur = comp.eur;
    // Artikel 7, stk. 2: halvering ved tilbudt ombookning, der får dig frem inden 2/3/4 timer. Gælder aflysning og nægtet boarding (art. 4, stk. 3, henviser til art. 7 og 8).
    if ((situation === 'aflyst' || situation === 'naegtet-boarding') && rerouteH !== null && rerouteH <= comp.rerouteLimitH) { out.halved = true; eur = eur / 2; out.reasons.push(`Selskabet må halvere kompensationen, fordi du med ombookningen nåede frem højst ${comp.rerouteLimitH} timer senere end planlagt (artikel 7, stk. 2).`); }
    // Ren forsinkelse på lange ruter uden for EU: mange selskaber halverer ved 3-4 timer. Ikke afgjort af EU-Domstolen; vi regner konservativt og siger det.
    if (situation === 'forsinket' && delayH >= 3 && delayH < 4 && comp.eur === 600) { out.halved = true; out.halvedDisputed = true; eur = 300; out.reasons.push('På ruter over 3.500 km uden for EU halverer mange selskaber til 300 € ved 3 til 4 timers forsinkelse. Det er ikke afgjort af EU-Domstolen, og forordningens ordlyd knytter halveringen til en tilbudt ombookning. Fløj du med det oprindelige fly, er der gode argumenter for de fulde 600 €. Vi regner med 300 € som det sikre beløb.'); }
    out.eur = curr === '£' ? (out.halved ? gbp[comp.eur] / 2 : gbp[comp.eur]) : eur;
    out.dkk = curr === '£' ? Math.round((out.eur * GBP_DKK) / 5) * 5 : dkk(eur);
    out.verdict = likelyNot ? 'sandsynligvis-ikke' : situation === 'naegtet-boarding' ? (cov.covered === null ? 'sandsynligvis' : 'ja') : (cov.covered === null || c.extraordinary === null) ? 'sandsynligvis' : 'ja';
  }
  if (cov.law === 'UK261') out.rights.push('Forældelse: for UK261-krav anlagt i England og Wales er fristen 6 år (Limitation Act 1980, Dawson v Thomson Airways 2014), i Skotland 5 år.');
  else out.rights.push('Kravet forældes i Danmark efter 3 år regnet fra flyvningen. Klager du til Trafikstyrelsen inden da, forældes kravet tidligst 1 år efter deres afgørelse (forældelsesloven § 21, stk. 2), men klagen skal være indgivet inden fristen, og sagsbehandlingen tager typisk 9 til 12 måneder.');
  if (curr === '€') out.rights.push('Du kan kræve beløbet udbetalt i kroner (EU-Domstolen, Delfly mod Smartwings C-356/19). Kronebeløbet her er vejledende og afhænger af kursen på betalingsdagen.');
  return out;
}

export const SITUATION_LABEL = { forsinket: 'Forsinket fly', aflyst: 'Aflyst fly', 'naegtet-boarding': 'Nægtet boarding', strejke: 'Strejke', bagage: 'Forsinket eller mistet bagage' };
export const VERDICT_LABEL = { ja: 'Ja, du har krav på kompensation', sandsynligvis: 'Sandsynligvis, kræv den', 'sandsynligvis-ikke': 'Sandsynligvis ikke, men bed om dokumentation', nej: 'Nej, ikke kompensation i denne situation' };
