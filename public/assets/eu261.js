// Reglerne i EU-forordning 261/2004 som kode. Bruges både ved build (rutesider) og i browseren (beregneren).
// Kilder: forordningens artikel 3 (anvendelse), 5 (aflysning), 6 (forsinkelse), 7 (kompensation) og EU-Domstolens
// praksis: Sturgeon C-402/07 (forsinkelse over 3 timer = kompensation), Folkerts C-11/11 (forsinkelsen måles ved
// endelig destination), Krüsemann C-195/17 og Airhelp mod SAS C-28/20 (egen strejke er ikke usædvanlig).
// Ingen eksterne afhængigheder. Holdes som ES-modul, så den kan kopieres direkte til public/assets.

export const EUR_DKK = 7.46; // Danmarks fastkurs over for euroen ligger stabilt omkring 7,46
export const RULES_VERSION = '2026-09';

export function haversineKm(a, b) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Kompensationens størrelse afhænger kun af afstanden (storcirkel) og om begge lufthavne ligger i EU/EØS/Schweiz. */
export function compensationFor(km, bothInEu) {
  if (km <= 1500) return { eur: 250, band: 'op til 1.500 km', rerouteLimitH: 2 };
  if (km <= 3500 || bothInEu) return { eur: 400, band: bothInEu && km > 3500 ? 'over 3.500 km inden for EU' : '1.500 til 3.500 km', rerouteLimitH: 3 };
  return { eur: 600, band: 'over 3.500 km', rerouteLimitH: 4 };
}

export const dkk = (eur) => Math.round((eur * EUR_DKK) / 5) * 5;

/**
 * Gælder forordningen for flyvningen? from/to har zone: 'eu' | 'uk' | 'other'. airlineZone ligeledes.
 * Afgang fra EU: altid. Ankomst til EU fra land uden for EU: kun med EU-selskab. Afgang fra Storbritannien: UK261 (samme regler i pund).
 */
export function coverage(from, to, airlineZone) {
  if (from.zone === 'eu') return { covered: true, law: 'EU261', why: `Flyvningen afgår fra ${from.name}, som ligger i EU. Så gælder reglerne, uanset hvilket selskab der flyver.` };
  if (to.zone === 'eu' && airlineZone === 'eu') return { covered: true, law: 'EU261', why: `Flyvningen lander i EU, og selskabet er et EU-selskab. Så gælder reglerne, også selvom afgangen er fra ${from.name}.` };
  if (from.zone === 'uk') return { covered: true, law: 'UK261', why: `Flyvningen afgår fra Storbritannien. Her gælder den britiske kopi af reglerne (UK261) med samme grænser, blot i pund: 220, 350 eller 520 £.` };
  if (to.zone === 'uk' && airlineZone === 'uk') return { covered: true, law: 'UK261', why: 'Flyvningen lander i Storbritannien med et britisk selskab, så UK261 gælder.' };
  if (to.zone === 'eu' && airlineZone === 'unknown') return { covered: null, law: 'EU261', why: `Flyvningen lander i EU fra et land uden for EU. Så gælder reglerne kun, hvis selskabet har licens i et EU-land. Vælg flyselskab for at få et klart svar.` };
  return { covered: false, law: null, why: `Flyvningen afgår fra ${from.name} uden for EU${to.zone === 'eu' ? ', og selskabet er ikke et EU-selskab' : ''}. EU-reglerne gælder ikke. Landets egne regler kan gælde, og din rejseforsikring kan dække udgifter.` };
}

/** Er årsagen en "usædvanlig omstændighed", der fritager selskabet? Returnerer { extraordinary: true|false|null, text }. */
export function causeAssessment(cause) {
  switch (cause) {
    case 'teknisk': return { extraordinary: false, text: 'Tekniske fejl på flyet er selskabets eget ansvar. EU-Domstolen har afgjort, at almindelige tekniske problemer ikke er usædvanlige omstændigheder, heller ikke når de opdages uventet.' };
    case 'personale': return { extraordinary: false, text: 'Manglende besætning, sygdom hos personalet, sen ankomst af besætning eller overskreden arbejdstid er selskabets planlægning og fritager ikke.' };
    case 'operationelt': return { extraordinary: false, text: 'Forsinket indkommende fly, rotationsproblemer, overbooking eller ombookning på grund af selskabets egne beslutninger er ikke usædvanlige omstændigheder.' };
    case 'egen-strejke': return { extraordinary: false, text: 'Strejke blandt flyselskabets eget personale, varslet eller ej, er ifølge EU-Domstolen (sagen Airhelp mod SAS, 2021) en del af selskabets almindelige drift. Du har som regel krav på kompensation.' };
    case 'vejr': return { extraordinary: true, text: 'Vejr, der reelt umuliggør flyvningen (tåge, storm, snestorm, askesky), er en usædvanlig omstændighed. Selskabet skal dog kunne dokumentere det, og det skal være vejret ved den konkrete flyvning, ikke bare dårligt vejr et sted i Europa.' };
    case 'ekstern-strejke': return { extraordinary: true, text: 'Strejke uden for selskabet (flyveledere, lufthavnspersonale, sikkerhedskontrol, bagagehåndtering hos tredjepart) er normalt en usædvanlig omstændighed. Du har stadig ret til forplejning, ombookning eller refusion.' };
    case 'sikkerhed': return { extraordinary: true, text: 'Lukket luftrum, politisk uro, terrortrussel, sikkerhedsrisiko eller myndighedsbeslutning er usædvanlige omstændigheder.' };
    case 'atc': return { extraordinary: true, text: 'Restriktioner fra flyvekontrollen (slots, kapacitet i luftrummet) er normalt en usædvanlig omstændighed, hvis de ramte netop din flyvning.' };
    case 'fugl': return { extraordinary: true, text: 'Kollision med fugle er ifølge EU-Domstolen (Pešková, 2017) en usædvanlig omstændighed. Selskabet skal dog have gjort alt for at begrænse forsinkelsen bagefter.' };
    default: return { extraordinary: null, text: 'Kender du ikke årsagen, så kræv kompensation alligevel. Det er selskabet, der skal bevise, at der var en usædvanlig omstændighed, og at de gjorde alt for at undgå den. Mange afvisninger holder ikke, når man spørger igen.' };
  }
}

/**
 * Samlet vurdering.
 * situation: 'forsinket' | 'aflyst' | 'naegtet-boarding'
 * delayH: forsinkelse ved ankomst til endelig destination i hele timer
 * noticeDays: for aflysning, hvor mange dage før afgang du fik besked (0-6, 7-13, 14+)
 * rerouteH: hvor mange timer senere end planlagt du nåede frem med den tilbudte ombookning (aflysning)
 * cause: se causeAssessment
 */
export function assess({ from, to, airlineZone = 'unknown', situation, delayH = 0, noticeDays = null, rerouteH = null, cause = 'ved-ikke', voluntary = false }) {
  const km = haversineKm(from, to);
  const bothInEu = from.zone === 'eu' && to.zone === 'eu';
  const comp = compensationFor(km, bothInEu);
  const cov = coverage(from, to, airlineZone);
  const out = { km: Math.round(km), band: comp.band, fullEur: comp.eur, eur: 0, dkk: 0, halved: false, verdict: 'nej', law: cov.law, reasons: [], rights: [] };
  if (cov.covered === false) { out.reasons.push(cov.why); return out; }
  if (cov.covered === null) out.reasons.push(cov.why);
  else out.reasons.push(cov.why);
  const curr = cov.law === 'UK261' ? '£' : '€';
  out.currency = curr;
  const gbp = { 250: 220, 400: 350, 600: 520 };

  const c = causeAssessment(cause);
  let eligible = true;
  if (situation === 'forsinket') {
    if (delayH < 3) { eligible = false; out.reasons.push('Kompensation kræver mindst 3 timers forsinkelse ved ankomsten til din endelige destination. Under 2 timer giver ingen rettigheder ud over selskabets egne regler; fra 2 timer har du ret til forplejning.'); }
    else out.reasons.push(`Du ankom ${delayH} timer eller mere for sent til din endelige destination. Det udløser kompensation, hvis selskabet ikke kan bevise en usædvanlig omstændighed.`);
    if (delayH >= 2) out.rights.push('Mad og drikke i rimeligt forhold til ventetiden, plus to telefonopkald eller e-mails.');
    if (delayH >= 5) out.rights.push('Ved 5 timer eller mere: ret til at opgive rejsen og få billetten refunderet inden for 7 dage, plus en returflyvning til dit udgangspunkt, hvis rejsen har mistet sit formål.');
    out.rights.push('Hotel og transport til og fra hotellet, hvis forsinkelsen betyder overnatning.');
  } else if (situation === 'aflyst') {
    if (noticeDays !== null && noticeDays >= 14) { eligible = false; out.reasons.push('Fik du besked om aflysningen mindst 14 dage før afgang, har du ikke krav på kompensation. Du har ret til at vælge mellem fuld refusion og ombookning.'); }
    else if (noticeDays !== null && noticeDays >= 7) {
      if (rerouteH !== null && rerouteH <= 4) { eligible = false; out.reasons.push('Besked 7 til 13 dage før og en ombookning, der afgik højst 2 timer tidligere og ankom højst 4 timer senere end planlagt, giver ikke kompensation.'); }
      else out.reasons.push('Besked 7 til 13 dage før afgang giver kompensation, medmindre du blev tilbudt en ombookning, der afgik højst 2 timer før og ankom højst 4 timer efter det oprindelige tidspunkt.');
    } else {
      if (rerouteH !== null && rerouteH <= 2) { eligible = false; out.reasons.push('Besked under 7 dage før og en ombookning, der afgik højst 1 time tidligere og ankom højst 2 timer senere end planlagt, giver ikke kompensation.'); }
      else out.reasons.push('Besked under 7 dage før afgang (eller ingen besked) giver kompensation, medmindre du blev tilbudt en ombookning, der afgik højst 1 time før og ankom højst 2 timer efter det oprindelige tidspunkt.');
    }
    out.rights.push('Valget mellem fuld refusion af billetten inden for 7 dage og ombookning til din destination ved først mulige lejlighed, eller på en senere dato efter dit valg.');
    out.rights.push('Forplejning under ventetiden og hotel, hvis ombookningen først er næste dag.');
  } else if (situation === 'naegtet-boarding') {
    if (voluntary) { eligible = false; out.reasons.push('Afgav du frivilligt din plads mod en aftalt godtgørelse, gælder den aftale i stedet for kompensationen.'); }
    else out.reasons.push('Blev du nægtet boarding mod din vilje, typisk på grund af overbooking, har du krav på kompensation med det samme, uanset årsag. Undtagelsen er, hvis du mødte for sent, manglede gyldige rejsedokumenter eller udgjorde en sikkerhedsrisiko.');
    out.rights.push('Valget mellem refusion og ombookning, plus forplejning og eventuelt hotel.');
  }

  if (eligible && situation !== 'naegtet-boarding') {
    if (c.extraordinary === true) { eligible = false; out.reasons.push(c.text); out.verdict = 'nej'; }
    else out.reasons.push(c.text);
  }

  if (eligible) {
    let eur = comp.eur;
    if (situation === 'aflyst' && rerouteH !== null && rerouteH <= comp.rerouteLimitH) { out.halved = true; eur = eur / 2; out.reasons.push(`Selskabet må halvere kompensationen, fordi du med ombookningen nåede frem højst ${comp.rerouteLimitH} timer senere end planlagt.`); }
    if (situation === 'forsinket' && delayH >= 3 && delayH < 4 && comp.eur === 600) { out.halved = true; eur = 300; out.reasons.push('På ruter over 3.500 km må selskabet halvere kompensationen til 300 €, når forsinkelsen er under 4 timer.'); }
    out.eur = curr === '£' ? (out.halved ? gbp[comp.eur] / 2 : gbp[comp.eur]) : eur;
    out.dkk = curr === '£' ? Math.round(out.eur * 8.7 / 5) * 5 : dkk(eur);
    out.verdict = cov.covered === null || c.extraordinary === null ? 'sandsynligvis' : 'ja';
  }
  out.rights.push('Kravet forældes i Danmark efter 3 år. Kompensation kan søges, længe efter rejsen er overstået.');
  return out;
}

export const SITUATION_LABEL = { forsinket: 'Forsinket fly', aflyst: 'Aflyst fly', 'naegtet-boarding': 'Nægtet boarding', strejke: 'Strejke', bagage: 'Forsinket eller mistet bagage' };
