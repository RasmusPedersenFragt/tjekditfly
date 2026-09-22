// Regressionstest af regelmotoren mod kendte tilfælde. Kør: node scripts/test-rules.mjs  (exit 1 ved fejl)
import { readFile } from 'node:fs/promises';
import { assess, haversineKm, compensationFor, assistanceThresholdH, downgradePct } from '../src/lib/eu261.mjs';

const { airports } = JSON.parse(await readFile('src/data/airports.json', 'utf8'));
const A = Object.fromEntries(airports.map((a) => [a.iata, a]));
const errors = [];
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${name}: fik ${JSON.stringify(got)}, ventede ${JSON.stringify(want)}`); };
const between = (name, v, lo, hi) => { if (!(v >= lo && v <= hi)) errors.push(`${name}: ${v} uden for ${lo}-${hi}`); };
const has = (arr, start) => arr.some((x) => x.startsWith(start));

// Afstande (kendte værdier ±3 %)
between('CPH-LHR km', haversineKm(A.CPH, A.LHR), 940, 1000);
between('CPH-PMI km', haversineKm(A.CPH, A.PMI), 1900, 2000);
between('CPH-BKK km', haversineKm(A.CPH, A.BKK), 8500, 8800);
between('CPH-LPA km', haversineKm(A.CPH, A.LPA), 3800, 4100);
between('CPH-AAL km', haversineKm(A.CPH, A.AAL), 220, 260);

// Beløbsbånd og grænser
eq('250 band', compensationFor(1000, true).eur, 250);
eq('400 band', compensationFor(2000, true).eur, 400);
eq('600 band', compensationFor(4000, false).eur, 600);
eq('intra-EU >3500 = 400', compensationFor(4000, true).eur, 400);
eq('intra-EU >3500 halveringsgrænse 3h', compensationFor(4000, true).rerouteLimitH, 3);
eq('forplejning 2h', assistanceThresholdH(1000), 2);
eq('forplejning 3h intra-EU lang', assistanceThresholdH(4000, true), 3);
eq('forplejning 4h', assistanceThresholdH(4000, false), 4);
eq('nedgradering 30/50/75', [downgradePct(1000), downgradePct(2000), downgradePct(4000, true), downgradePct(4000)], [30, 50, 50, 75]);

// Forsinkelse 3 timer København–London, teknisk fejl: 250 €
let r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'forsinket', delayH: 3, cause: 'teknisk' });
eq('CPH-LHR 3h teknisk verdict', r.verdict, 'ja'); eq('CPH-LHR 3h beløb', r.eur, 250); eq('CPH-LHR dkk', r.dkk, 1865);
eq('kroner-ret nævnes', has(r.rights, 'Du kan kræve beløbet udbetalt i kroner'), true);
eq('dansk forældelse nævnes', has(r.rights, 'Kravet forældes i Danmark'), true);
// Under 3 timer: intet
r = assess({ from: A.CPH, to: A.LHR, situation: 'forsinket', delayH: 2, cause: 'teknisk' });
eq('2h = nej', r.verdict, 'nej'); eq('2h beløb', r.eur, 0);
// Vejr: som udgangspunkt fritaget, men rimelighedsprøven gælder -> 'sandsynligvis-ikke' med beløb oplyst
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'forsinket', delayH: 5, cause: 'vejr' });
eq('vejr = sandsynligvis-ikke', r.verdict, 'sandsynligvis-ikke'); eq('vejr beløb vises', r.eur, 400);
eq('vejr rimelighed nævnes', has(r.reasons, 'Selskabet er kun fritaget'), true);
// Egen strejke fritager ikke (Airhelp mod SAS)
r = assess({ from: A.CPH, to: A.ARN, airlineZone: 'eu', situation: 'aflyst', noticeDays: 0, cause: 'egen-strejke' });
eq('egen strejke = ja', r.verdict, 'ja'); eq('egen strejke beløb', r.eur, 250);
// Ukendt årsag: sandsynligvis
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'forsinket', delayH: 4, cause: 'ved-ikke' });
eq('ved-ikke = sandsynligvis', r.verdict, 'sandsynligvis'); eq('ved-ikke beløb', r.eur, 400);
// Langdistance 3-4 timer: 300 € konservativt, markeret som omstridt
r = assess({ from: A.CPH, to: A.BKK, airlineZone: 'eu', situation: 'forsinket', delayH: 3, cause: 'teknisk' });
eq('BKK 3h halveret', r.eur, 300); eq('BKK halved flag', r.halved, true); eq('BKK omstridt', r.halvedDisputed, true);
r = assess({ from: A.CPH, to: A.BKK, airlineZone: 'eu', situation: 'forsinket', delayH: 5, cause: 'teknisk' });
eq('BKK 5h fuld', r.eur, 600); eq('BKK 5h ikke omstridt', r.halvedDisputed, false);
// Gran Canaria: over 3500 km men inden for EU = 400
r = assess({ from: A.CPH, to: A.LPA, airlineZone: 'eu', situation: 'forsinket', delayH: 4, cause: 'personale' });
eq('LPA = 400', r.eur, 400);
// Hjemrejse fra Bangkok med ikke-EU-selskab: ikke dækket
r = assess({ from: A.BKK, to: A.CPH, airlineZone: 'other', situation: 'forsinket', delayH: 6, cause: 'teknisk' });
eq('BKK-CPH other = nej', r.verdict, 'nej'); eq('BKK-CPH law', r.law, null);
// Hjemrejse fra Bangkok med EU-selskab: dækket
r = assess({ from: A.BKK, to: A.CPH, airlineZone: 'eu', situation: 'forsinket', delayH: 6, cause: 'teknisk' });
eq('BKK-CPH eu = ja', r.verdict, 'ja'); eq('BKK-CPH eu beløb', r.eur, 600);
// Hjemrejse fra Bangkok, selskab ukendt: sandsynligvis med forbehold
r = assess({ from: A.BKK, to: A.CPH, airlineZone: 'unknown', situation: 'forsinket', delayH: 6, cause: 'teknisk' });
eq('BKK-CPH unknown', r.verdict, 'sandsynligvis');
// Fra London med britisk selskab: UK261 i pund, britisk forældelse
r = assess({ from: A.LHR, to: A.CPH, airlineZone: 'uk', situation: 'forsinket', delayH: 3, cause: 'teknisk' });
eq('LHR-CPH law', r.law, 'UK261'); eq('LHR-CPH beløb', r.eur, 220); eq('LHR-CPH valuta', r.currency, '£');
eq('UK forældelse', has(r.rights, 'Forældelse: for UK261'), true); eq('ingen dansk forældelse ved UK', has(r.rights, 'Kravet forældes i Danmark'), false);
// Fra London med EU-selskab: EU261 (og UK261 nævnes)
r = assess({ from: A.LHR, to: A.CPH, airlineZone: 'eu', situation: 'forsinket', delayH: 3, cause: 'teknisk' });
eq('LHR-CPH eu law', r.law, 'EU261'); eq('LHR-CPH eu begge nævnes', r.reasons[0].includes('UK261'), true);
// Aflysning 14+ dage: nej
r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'aflyst', noticeDays: 14, cause: 'operationelt' });
eq('aflyst 14d = nej', r.verdict, 'nej');
// Aflysning 7-13 dage, ombookning inden 4 timer og afgang højst 2 timer før: nej
r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'aflyst', noticeDays: 7, rerouteH: 4, departEarlierH: 0, cause: 'operationelt' });
eq('aflyst 7d reroute 4h = nej', r.verdict, 'nej');
// Samme, men erstatningsflyet afgik 6 timer tidligere: begge betingelser ikke opfyldt -> ja, fuldt beløb (afgangsbetingelsen fejler)
r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'aflyst', noticeDays: 7, rerouteH: 3, departEarlierH: 6, cause: 'operationelt' });
eq('aflyst 7d afgang 6h før = ja', r.verdict, 'ja'); eq('men halveret pga. ankomst inden 2h?', r.eur, 250);
// Aflysning <7 dage, ombookning 2 timer senere, afgang samme tid: nej
r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'aflyst', noticeDays: 0, rerouteH: 2, cause: 'operationelt' });
eq('aflyst 0d reroute 2h = nej', r.verdict, 'nej');
// Aflysning <7 dage, ombookning 2 timer senere men afgang 3 timer før: ja, halveret (ankomst inden 2h)
r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'aflyst', noticeDays: 0, rerouteH: 2, departEarlierH: 3, cause: 'operationelt' });
eq('aflyst 0d afgang 3h før = ja', r.verdict, 'ja'); eq('halveret 125', r.eur, 125);
// Aflysning <7 dage, ombookning 5 timer senere: ja, fuldt beløb
r = assess({ from: A.CPH, to: A.LHR, airlineZone: 'eu', situation: 'aflyst', noticeDays: 0, rerouteH: 5, cause: 'operationelt' });
eq('aflyst 0d reroute 5h = ja', r.verdict, 'ja'); eq('aflyst fuldt', r.eur, 250);
// Aflysning <7 dage på mellemdistance, ombookning 3 timer senere: ja men halveret (grænsen er 3 timer for 400 €)
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'aflyst', noticeDays: 0, rerouteH: 3, cause: 'operationelt' });
eq('PMI aflyst reroute 3h halveret', r.eur, 200); eq('PMI halved', r.halved, true);
// Nægtet boarding: altid ja, uanset årsag og uden 'sandsynligvis'
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'naegtet-boarding', cause: 'vejr' });
eq('boarding = ja', r.verdict, 'ja'); eq('boarding beløb', r.eur, 400);
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'naegtet-boarding', cause: 'ved-ikke' });
eq('boarding ved-ikke = ja', r.verdict, 'ja');
// Nægtet boarding med ombookning inden 3 timer: halveret
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'naegtet-boarding', rerouteH: 3 });
eq('boarding halveret', r.eur, 200);
r = assess({ from: A.CPH, to: A.PMI, airlineZone: 'eu', situation: 'naegtet-boarding', voluntary: true });
eq('frivillig = nej', r.verdict, 'nej');

// Forplejning: 2 timer op til 1.500 km, 3 timer op til 3.500 km, 4 timer derover
r = assess({ from: A.CPH, to: A.LHR, situation: 'forsinket', delayH: 2, cause: 'teknisk' });
eq('LHR 2h forplejning', has(r.rights, 'Mad og drikke'), true);
r = assess({ from: A.CPH, to: A.PMI, situation: 'forsinket', delayH: 2, cause: 'teknisk' });
eq('PMI 2h ingen forplejning', has(r.rights, 'Mad og drikke'), false);
r = assess({ from: A.CPH, to: A.BKK, situation: 'forsinket', delayH: 3, cause: 'teknisk' });
eq('BKK 3h ingen forplejning', has(r.rights, 'Mad og drikke'), false);
eq('BKK threshold', r.assistanceThresholdH, 4);
r = assess({ from: A.CPH, to: A.LPA, situation: 'forsinket', delayH: 3, cause: 'teknisk' });
eq('LPA threshold 3h (intra-EU lang)', r.assistanceThresholdH, 3);

console.log(errors.length ? `${errors.length} fejl i regelmotoren:` : 'Regelmotor: alle tests bestået.');
for (const e of errors) console.log('  ' + e);
if (errors.length) process.exit(1);
