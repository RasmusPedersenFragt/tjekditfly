// Koger OurAirports' airports.csv (public domain, https://ourairports.com/data/) ned til
// src/data/airports.json: kun de lufthavne, vi laver sider for, med danske navne og koordinater.
// Kør: node scripts/make-airports.mjs   (kræver scripts/ourairports.csv; hent fra
// https://davidmegginson.github.io/ourairports-data/airports.csv)
import { readFile, writeFile } from 'node:fs/promises';

// EU-lande plus EØS (Norge, Island, Liechtenstein) og Schweiz: forordning 261/2004 gælder dér.
const EU261_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','NO','IS','LI','CH']);
// Storbritannien har sin egen kopi af reglerne (UK261) siden 2021.
const UK = new Set(['GB']);

// IATA-kode → dansk navn, by, land (dansk). Rækkefølgen er ligegyldig.
const WANTED = {
  // Danmark
  CPH: ['Københavns Lufthavn', 'København', 'Danmark'],
  BLL: ['Billund Lufthavn', 'Billund', 'Danmark'],
  AAL: ['Aalborg Lufthavn', 'Aalborg', 'Danmark'],
  AAR: ['Aarhus Lufthavn', 'Aarhus', 'Danmark'],
  RNN: ['Bornholms Lufthavn', 'Rønne', 'Danmark'],
  KRP: ['Midtjyllands Lufthavn', 'Karup', 'Danmark'],
  SGD: ['Sønderborg Lufthavn', 'Sønderborg', 'Danmark'],
  // Storbritannien og Irland
  LHR: ['London Heathrow', 'London', 'Storbritannien'],
  LGW: ['London Gatwick', 'London', 'Storbritannien'],
  STN: ['London Stansted', 'London', 'Storbritannien'],
  LTN: ['London Luton', 'London', 'Storbritannien'],
  MAN: ['Manchester', 'Manchester', 'Storbritannien'],
  EDI: ['Edinburgh', 'Edinburgh', 'Storbritannien'],
  DUB: ['Dublin', 'Dublin', 'Irland'],
  // Benelux og Frankrig
  AMS: ['Amsterdam Schiphol', 'Amsterdam', 'Holland'],
  BRU: ['Bruxelles', 'Bruxelles', 'Belgien'],
  CDG: ['Paris Charles de Gaulle', 'Paris', 'Frankrig'],
  ORY: ['Paris Orly', 'Paris', 'Frankrig'],
  NCE: ['Nice', 'Nice', 'Frankrig'],
  LYS: ['Lyon', 'Lyon', 'Frankrig'],
  MRS: ['Marseille', 'Marseille', 'Frankrig'],
  // Tyskland, Schweiz, Østrig
  FRA: ['Frankfurt', 'Frankfurt', 'Tyskland'],
  MUC: ['München', 'München', 'Tyskland'],
  BER: ['Berlin Brandenburg', 'Berlin', 'Tyskland'],
  HAM: ['Hamborg', 'Hamborg', 'Tyskland'],
  DUS: ['Düsseldorf', 'Düsseldorf', 'Tyskland'],
  CGN: ['Köln/Bonn', 'Köln', 'Tyskland'],
  STR: ['Stuttgart', 'Stuttgart', 'Tyskland'],
  ZRH: ['Zürich', 'Zürich', 'Schweiz'],
  GVA: ['Genève', 'Genève', 'Schweiz'],
  VIE: ['Wien', 'Wien', 'Østrig'],
  // Central- og Østeuropa
  PRG: ['Prag', 'Prag', 'Tjekkiet'],
  WAW: ['Warszawa Chopin', 'Warszawa', 'Polen'],
  KRK: ['Krakow', 'Krakow', 'Polen'],
  GDN: ['Gdansk', 'Gdansk', 'Polen'],
  BUD: ['Budapest', 'Budapest', 'Ungarn'],
  SOF: ['Sofia', 'Sofia', 'Bulgarien'],
  BOJ: ['Burgas', 'Burgas', 'Bulgarien'],
  OTP: ['Bukarest Otopeni', 'Bukarest', 'Rumænien'],
  // Norden og Baltikum
  ARN: ['Stockholm Arlanda', 'Stockholm', 'Sverige'],
  GOT: ['Göteborg Landvetter', 'Göteborg', 'Sverige'],
  OSL: ['Oslo Gardermoen', 'Oslo', 'Norge'],
  BGO: ['Bergen', 'Bergen', 'Norge'],
  TRD: ['Trondheim', 'Trondheim', 'Norge'],
  SVG: ['Stavanger', 'Stavanger', 'Norge'],
  HEL: ['Helsinki', 'Helsinki', 'Finland'],
  KEF: ['Reykjavik Keflavik', 'Reykjavik', 'Island'],
  RIX: ['Riga', 'Riga', 'Letland'],
  TLL: ['Tallinn', 'Tallinn', 'Estland'],
  VNO: ['Vilnius', 'Vilnius', 'Litauen'],
  // Spanien og Portugal
  MAD: ['Madrid Barajas', 'Madrid', 'Spanien'],
  BCN: ['Barcelona El Prat', 'Barcelona', 'Spanien'],
  PMI: ['Palma de Mallorca', 'Mallorca', 'Spanien'],
  AGP: ['Malaga', 'Malaga', 'Spanien'],
  ALC: ['Alicante', 'Alicante', 'Spanien'],
  IBZ: ['Ibiza', 'Ibiza', 'Spanien'],
  LPA: ['Gran Canaria', 'Las Palmas', 'Spanien'],
  TFS: ['Tenerife Syd', 'Tenerife', 'Spanien'],
  ACE: ['Lanzarote', 'Arrecife', 'Spanien'],
  FUE: ['Fuerteventura', 'Puerto del Rosario', 'Spanien'],
  LIS: ['Lissabon', 'Lissabon', 'Portugal'],
  FAO: ['Faro', 'Faro', 'Portugal'],
  OPO: ['Porto', 'Porto', 'Portugal'],
  // Italien
  FCO: ['Rom Fiumicino', 'Rom', 'Italien'],
  MXP: ['Milano Malpensa', 'Milano', 'Italien'],
  VCE: ['Venedig Marco Polo', 'Venedig', 'Italien'],
  NAP: ['Napoli', 'Napoli', 'Italien'],
  CTA: ['Catania', 'Catania', 'Italien'],
  PMO: ['Palermo', 'Palermo', 'Italien'],
  BLQ: ['Bologna', 'Bologna', 'Italien'],
  // Grækenland, Kroatien, Cypern, Malta
  ATH: ['Athen', 'Athen', 'Grækenland'],
  HER: ['Kreta Heraklion', 'Heraklion', 'Grækenland'],
  CHQ: ['Kreta Chania', 'Chania', 'Grækenland'],
  RHO: ['Rhodos', 'Rhodos', 'Grækenland'],
  CFU: ['Korfu', 'Korfu', 'Grækenland'],
  KGS: ['Kos', 'Kos', 'Grækenland'],
  SKG: ['Thessaloniki', 'Thessaloniki', 'Grækenland'],
  SPU: ['Split', 'Split', 'Kroatien'],
  DBV: ['Dubrovnik', 'Dubrovnik', 'Kroatien'],
  ZAG: ['Zagreb', 'Zagreb', 'Kroatien'],
  LCA: ['Larnaca', 'Larnaca', 'Cypern'],
  PFO: ['Paphos', 'Paphos', 'Cypern'],
  MLA: ['Malta', 'Malta', 'Malta'],
  // Tyrkiet, Mellemøsten, Nordafrika
  IST: ['Istanbul', 'Istanbul', 'Tyrkiet'],
  SAW: ['Istanbul Sabiha Gökçen', 'Istanbul', 'Tyrkiet'],
  AYT: ['Antalya', 'Antalya', 'Tyrkiet'],
  DLM: ['Dalaman', 'Dalaman', 'Tyrkiet'],
  BJV: ['Bodrum', 'Bodrum', 'Tyrkiet'],
  TLV: ['Tel Aviv Ben Gurion', 'Tel Aviv', 'Israel'],
  HRG: ['Hurghada', 'Hurghada', 'Egypten'],
  SSH: ['Sharm el-Sheikh', 'Sharm el-Sheikh', 'Egypten'],
  RAK: ['Marrakech', 'Marrakech', 'Marokko'],
  AGA: ['Agadir', 'Agadir', 'Marokko'],
  DXB: ['Dubai', 'Dubai', 'Forenede Arabiske Emirater'],
  AUH: ['Abu Dhabi', 'Abu Dhabi', 'Forenede Arabiske Emirater'],
  DOH: ['Doha Hamad', 'Doha', 'Qatar'],
  // Asien
  BKK: ['Bangkok Suvarnabhumi', 'Bangkok', 'Thailand'],
  HKT: ['Phuket', 'Phuket', 'Thailand'],
  SIN: ['Singapore Changi', 'Singapore', 'Singapore'],
  PEK: ['Beijing Capital', 'Beijing', 'Kina'],
  PVG: ['Shanghai Pudong', 'Shanghai', 'Kina'],
  NRT: ['Tokyo Narita', 'Tokyo', 'Japan'],
  HND: ['Tokyo Haneda', 'Tokyo', 'Japan'],
  DEL: ['Delhi', 'Delhi', 'Indien'],
  MLE: ['Malé', 'Malé', 'Maldiverne'],
  CMB: ['Colombo', 'Colombo', 'Sri Lanka'],
  // Nordamerika
  JFK: ['New York JFK', 'New York', 'USA'],
  EWR: ['New York Newark', 'New York', 'USA'],
  BOS: ['Boston', 'Boston', 'USA'],
  ORD: ['Chicago O\'Hare', 'Chicago', 'USA'],
  MIA: ['Miami', 'Miami', 'USA'],
  LAX: ['Los Angeles', 'Los Angeles', 'USA'],
  SFO: ['San Francisco', 'San Francisco', 'USA'],
  IAD: ['Washington Dulles', 'Washington', 'USA'],
  YYZ: ['Toronto Pearson', 'Toronto', 'Canada'],
  // Afrika og Sydamerika
  CPT: ['Cape Town', 'Cape Town', 'Sydafrika'],
  JNB: ['Johannesburg', 'Johannesburg', 'Sydafrika'],
  ZNZ: ['Zanzibar', 'Zanzibar', 'Tanzania'],
  NBO: ['Nairobi', 'Nairobi', 'Kenya'],
};

// Hvilke destinationer vi laver rutesider for fra hver dansk lufthavn (ruter, der faktisk flyves i dag
// eller i sæsonen). Alle destinationer ovenfor fra København; udvalg fra de tre andre.
const ROUTES = {
  CPH: Object.keys(WANTED).filter((k) => k !== 'CPH'),
  BLL: ['CPH','LHR','LGW','STN','MAN','EDI','DUB','AMS','BRU','CDG','NCE','FRA','MUC','BER','HAM','DUS','ZRH','VIE','PRG','WAW','KRK','GDN','BUD','OSL','BGO','ARN','KEF','RIX','VNO','MAD','BCN','PMI','AGP','ALC','LPA','TFS','ACE','FUE','LIS','FAO','FCO','MXP','NAP','CTA','ATH','HER','CHQ','RHO','CFU','KGS','SPU','DBV','LCA','PFO','MLA','IST','SAW','AYT','DLM','HRG','SSH','DXB','DOH','BKK','HKT'],
  AAL: ['CPH','LGW','STN','AMS','OSL','BGO','ARN','PMI','AGP','ALC','LPA','TFS','LIS','FAO','HER','RHO','CFU','SPU','AYT','HRG','IST','DUS'],
  AAR: ['CPH','LHR','STN','OSL','GOT','ARN','PMI','AGP','ALC','LPA','HER','RHO','AYT','DXB'],
};

const csv = await readFile('scripts/ourairports.csv', 'utf8');
const lines = csv.split('\n');
const header = parseLine(lines[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const byIata = {};
for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const f = parseLine(line);
  const iata = f[col.iata_code];
  if (!iata || !WANTED[iata]) continue;
  const type = f[col.type];
  if (!/^(large|medium)_airport$/.test(type)) continue;
  if (byIata[iata] && byIata[iata].type === 'large_airport') continue; // behold den store, hvis to deler kode
  byIata[iata] = { type, lat: Number(f[col.latitude_deg]), lon: Number(f[col.longitude_deg]), country: f[col.iso_country], ident: f[col.ident] };
}
const missing = Object.keys(WANTED).filter((k) => !byIata[k]);
if (missing.length) throw new Error('Mangler i OurAirports: ' + missing.join(', '));

const airports = Object.entries(WANTED).map(([iata, [name, city, country]]) => {
  const a = byIata[iata];
  return { iata, icao: a.ident, name, city, country, cc: a.country, lat: Math.round(a.lat * 10000) / 10000, lon: Math.round(a.lon * 10000) / 10000,
    zone: EU261_COUNTRIES.has(a.country) ? 'eu' : UK.has(a.country) ? 'uk' : 'other', dk: a.country === 'DK' };
}).sort((x, y) => (x.dk === y.dk ? x.name.localeCompare(y.name, 'da') : x.dk ? -1 : 1));

for (const [from, dests] of Object.entries(ROUTES)) for (const d of dests) if (!WANTED[d]) throw new Error(`Rute ${from}-${d}: ukendt destination`);
await writeFile('src/data/airports.json', JSON.stringify({ source: 'OurAirports (public domain), hentet ' + new Date().toISOString().slice(0, 10), airports, routes: ROUTES }, null, 1));
console.log(`${airports.length} lufthavne, ${Object.values(ROUTES).reduce((n, r) => n + r.length, 0)} ruter skrevet til src/data/airports.json`);

function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur.replace(/\r$/, ''));
  return out;
}
