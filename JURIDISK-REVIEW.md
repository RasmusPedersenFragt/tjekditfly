# Juridisk review af tjekditfly.dk

Gennemført 22. september 2026 af to uafhængige juridiske gennemgange:
**Gennemgang 1** — materiel EU261-ret: regelmotoren, `/regler/`, `/beregn/`, situationssiderne.
**Gennemgang 2** — dansk forbruger-, markedsførings- og databeskyttelsesret: brevgeneratoren, `/sammenlign/`, tillidssiderne, selskabssiderne.

Dette er et fagligt review, ikke en juridisk godkendelse. Skal sitet stå skarpt over for forbrugere, bør den endelige tekst gennemses af en navngiven dansk advokat.

**Notation:** [FAST RET] = verificeret lovtekst eller afgørelse. [VURDERING] = juridisk subsumption, ikke fast praksis. [UVERIFICERET] = kunne ikke bekræftes, bør blødes op eller fjernes.

---

## 0. Status på forordningen pr. 22. september 2026

Begge gennemgange nåede uafhængigt frem til det samme:

- **15. juni 2026** — politisk enighed mellem Rådet og Europa-Parlamentet.
- **7. juli 2026** — Parlamentet godkendte teksten (646 mod 12).
- **13. juli 2026** — Rådet gav endelig godkendelse.
- **3-timers-grænsen og beløbene 250/400/600 € er BEVARET.** Rådets generelle indstilling fra juni 2025 med 4/6-timers-grænser og 300/500 € blev forkastet under forhandlingerne.
- **Ikrafttræden:** 12 måneder efter offentliggørelse i EU-Tidende, dvs. omkring midten af 2027. Frem til da gælder 261/2004 uændret.

Nyt fra 2027: proaktiv oplysning til passageren inden 96 timer, standardformular, 9 måneders frist for at indgive krav, 30 dages svarfrist for selskabet, forbud mod no-show-annullering af hjemrejsen, udtømmende liste over usædvanlige omstændigheder, håndbagage inkluderet i prisen, ret til at børn under 14 sidder hos en forælder, gratis rettelse af navnestavefejl.

---

# SKAL RETTES FØR PUBLICERING

## Regelmotoren og regelsiderne

### 1. Montreal-grænsen er forældet — 1.288 SDR skal være 1.519 SDR

`scripts/build-pages.mjs:215, 218, 220, 221, 222` og hele `/situation/bagage/`, inkl. `<meta name="description">`.

Grænsen blev hævet 17,9 % ved ICAO's femårige revision og har siden **28. december 2024** været **1.519 SDR** (ca. 13.000–13.500 kr). Sitet underdriver brugerens loft med 18 %. [FAST RET]

**Ret:** alle forekomster af "1.288 SDR" til "1.519 SDR", "cirka 11.000 kr" til "cirka 13.000 kr". Tilføj, at grænsen reguleres hvert femte år (næste december 2029).

*Resten af bagagesiden er korrekt:* Montreal-konventionen frem for 261/2004, 7 dage ved skade og 21 dage ved forsinkelse (art. 31), 2 år for sagsanlæg (art. 35), bortkommet efter 21 dage (art. 17, stk. 3). FAQ'en "Kan jeg få 250 € for forsinket bagage? Nej" er rigtig.

### 2. Forplejningsretten skal være afstandsafhængig

`src/lib/eu261.mjs:82` og `src/pages/regler.html:34`.

```js
if (delayH >= 2) out.rights.push('Mad og drikke ...');
```

Artikel 6, stk. 1, har tre tærskler: **2 timer** (op til 1.500 km), **3 timer** (flyvninger inden for EU over 1.500 km og andre mellem 1.500 og 3.500 km), **4 timer** (øvrige). [FAST RET]

Testet: København–Bangkok med 2 timers forsinkelse svarer motoren "Mad og drikke i rimeligt forhold til ventetiden". Der er ingen ret til forplejning før 4 timer på den rute. Fejl til brugerens fordel, men den kan sende ham i en konflikt i lufthavnen, han ikke kan vinde.

**Bemærk:** `scripts/build-pages.mjs:166` gør det rigtigt — sitet modsiger sig selv.

**Ret:** `const careH = km <= 1500 ? 2 : (km <= 3500 || bothInEu) ? 3 : 4;` og brug `delayH >= careH`. Ret `regler.html:34` tilsvarende.

### 3. Schweiz er ikke medlem af EØS

`scripts/build-pages.mjs:340`, renderet i `public/rute/koebenhavn-geneve/index.html` både i brødtekst og JSON-LD-FAQ.

> "... fordi Schweiz er omfattet af EU-reglerne gennem EØS-aftalen."

Schweizerne forkastede EØS ved folkeafstemning i 1992. 261/2004 gælder i Schweiz via **luftfartsaftalen mellem EU og Schweiz af 21. juni 1999** (i kraft 1. juni 2002), hvis bilag inkorporerer forordningen. [FAST RET]

**Ret:** split betingelsen:

```js
['Norge','Island'].includes(to.country) ? 'er omfattet af EU-reglerne gennem EØS-aftalen'
  : to.country === 'Schweiz' ? 'er omfattet af EU-reglerne gennem luftfartsaftalen mellem EU og Schweiz'
  : 'er et EU-land'
```

Samme præcisering i `regler.html:14` og `beregn.html:64`.

[VURDERING] EU–Schweiz-aftalen dækker ruter mellem EU og Schweiz. Om forordningen også dækker afgange fra Schweiz til tredjelande er omstridt. Sitet har kun CPH–Genève i dag, så det er latent — men motoren ville svare "dækket" på fx Zürich–New York, hvilket ikke er sikkert.

### 4. 3-årsfristen vises også på UK261-sager

`src/lib/eu261.mjs:115` — sætningen pushes ubetinget, uden for `if (eligible)` og uafhængigt af `cov.law`.

Testet: London Heathrow–New York med British Airways giver `law: UK261, 520 £` **plus** "Kravet forældes i Danmark efter 3 år."

For UK261-krav anlagt i England og Wales er fristen **6 år** efter Limitation Act 1980, section 9 — fastslået af Court of Appeal i **Dawson v Thomson Airways Ltd [2014] EWCA Civ 845**, som samtidig afviste, at Montreal-konventionens 2-årsfrist gælder EU261-krav. I Skotland 5 år. [FAST RET]

En bruger med et 4 år gammelt Gatwick-krav får her at vide, at det er tabt.

**Ret:** gør sætningen afhængig af regelsættet.

### 5. Halveringsgrænsen mangler EU-forbeholdet

`src/pages/regler.html:30` og `scripts/build-pages.mjs:185`.

> "... eller 4 timer (over 3.500 km) senere end planlagt."

Artikel 7, stk. 2, litra b, giver 3-timers-grænsen til "alle flyvninger inden for Fællesskabet på over 1.500 km" — altså også dem over 3.500 km. København–Gran Canaria (3.805 km, begge i EU) har grænsen **3 timer, ikke 4**. [FAST RET]

Motoren har det **korrekt** (`rerouteLimitH: 3` for `bothInEu && km > 3500`). Prosaen modsiger koden. Næste sætning har samme fejl: "På ruter over 3.500 km betyder det, at en forsinkelse på 3 til 4 timer giver 300 € i stedet for 600 €" — skal være "over 3.500 km **uden for EU**".

**Ret:** "... 3 timer (1.500 til 3.500 km, samt alle ruter inden for EU over 1.500 km) eller 4 timer (over 3.500 km uden for EU)".

### 6. Revisionsafsnittet er faktuelt forældet

`src/pages/regler.html:70`:

> "EU-landene og Europa-Parlamentet **forhandler** en revision ... som blandt andet **kan hæve grænsen for forsinkelse fra 3 til 4 eller 6 timer**"

Revisionen er færdigforhandlet og vedtaget i juli 2026, og 3-timers-grænsen og beløbene blev netop bevaret. Teksten efterlader læseren i tvivl om, hvorvidt hans krav snart forsvinder. Samme i `scripts/build-pages.mjs:374`.

**Foreslået tekst:**

> "Forordningen blev revideret i 2026. Europa-Parlamentet godkendte den nye tekst 7. juli 2026 og Rådet 13. juli 2026. **3-timers-grænsen og beløbene 250/400/600 € blev bevaret.** De nye regler — blandt andet at selskabet selv skal oplyse dig om dit krav inden 96 timer, en 9-måneders frist for at indgive krav og 30 dages svarfrist — gælder først 12 måneder efter offentliggørelsen i EU-Tidende, altså omkring midten af 2027. Frem til da gælder reglerne på denne side uændret."

### 7. Usædvanlige omstændigheder giver hårdt nej uden rimelighedsprøven

`src/lib/eu261.mjs:102-105`. **Det tungeste fund i motoren.**

```js
if (c.extraordinary === true) { eligible = false; out.reasons.push(c.text); out.verdict = 'nej'; }
```

Artikel 5, stk. 3, har **to kumulative betingelser**: der skal foreligge usædvanlige omstændigheder, **og** de skulle ikke have kunnet undgås, "selv om alle forholdsregler, der med rimelighed kunne træffes, faktisk var blevet truffet". Motoren afgør sagen alene på betingelse 1. [FAST RET]

Retskilder: **Eglītis C-294/10** (selskabet skal indregne reservetid), **Pešková C-315/15**, **Germanwings C-501/17**, og senest **AirHelp Germany mod Austrian Airlines C-399/24** (16. oktober 2025), hvor Domstolen anerkendte lynnedslag med efterfølgende obligatorisk sikkerhedsinspektion som usædvanlig omstændighed, men udtrykkeligt fastholdt, at selskabet **derudover** skal godtgøre, at det traf alle rimelige forholdsregler.

I praksis: København–Mallorca, 4 timers forsinkelse, årsag "vejr" → motoren svarer **"Nej, ikke kompensation i denne situation"**. Men kunne selskabet have ombooket til en afgang 3 timer senere og satte dig i stedet på en dagen efter, har du efter al sandsynlighed et krav.

Sitets egen `regler.html:50` beskriver tosidetheden korrekt — motoren implementerer den ikke.

**Ret:** lad `extraordinary: true` føre til verdict `'sandsynligvis-ikke'` i stedet for `'nej'`, og tilføj fast begrundelse:

> "Selskabet er kun fritaget, hvis det både beviser den usædvanlige omstændighed **og** at forsinkelsen ikke kunne være undgået med rimelige foranstaltninger, fx ombookning på et andet fly eller indregnet reservetid (EU-Domstolen, C-294/10 og C-399/24). Bed altid om begge dele skriftligt."

### 8. Nægtet boarding skal give "ja", ikke "sandsynligvis"

`src/lib/eu261.mjs:113` + `src/assets/app.js:48, 73`.

`app.js` skjuler årsagsfeltet ved nægtet boarding (korrekt) og sender `cause: 'ved-ikke'` → `extraordinary === null` → `verdict: 'sandsynligvis'`. Overskriften bliver "Sandsynligvis, kræv den".

Nægtet boarding mod passagerens vilje giver et **ubetinget** krav efter art. 4, stk. 3, uden undtagelse for usædvanlige omstændigheder — **Finnair mod Lassooy C-22/11** (4. oktober 2012), hvor en strejke ikke kunne fritage. [FAST RET] Sitets egne tekster siger det rigtigt (`build-pages.mjs:194` og FAQ linje 200); motoren underdriver.

**Ret:** `out.verdict = (cov.covered === null || (c.extraordinary === null && situation !== 'naegtet-boarding')) ? 'sandsynligvis' : 'ja';`

## Urigtige udsagn om navngivne virksomheder

### 9. Forkert retsudsagn om et navngivet advokatfirma

`src/data/providers.json:12`, renderet på `/sammenlign/` via `scripts/build-pages.mjs:138`:

> "**Advokater i Danmark må ikke tage en fast procentdel af erstatningen**, så modellen er en anden end hos de øvrige."

Det absolutte forbud mod *pactum de quota litis* blev ophævet i De Advokatetiske Regler med virkning fra september 2022 og erstattet af en principbaseret bestemmelse (art. 57): salærfastsættelse, herunder udbytteafhængig, skal ske på en måde, hvor advokatens uafhængighed og integritet ikke påvirkes. Udbytteafhængigt salær er altså tilladt efter en konkret vurdering. [FAST RET]

Sitet fortæller offentligt, at et navngivet advokatanpartsselskab er retligt afskåret fra en model, det lovligt kan anvende — og bruger det som forklaring i en sammenligning, hvor den fremhævede aktør er en konkurrent, sitet søger provision fra. Markedsføringslovens § 20, stk. 1; efter aktivering af affiliate-aftalen tillige § 21, stk. 2, nr. 1 og 5.

**Foreslået `feeNote`:**

> "Advokatanpartsselskab. Salæret står ikke på forsiden. Advokater må gerne aftale resultatafhængigt salær, men De Advokatetiske Regler kræver, at salærmodellen ikke påvirker advokatens uafhængighed. Spørg til salærmodellen, før du skriver under."

### 10. "Dømt af EU-Domstolen" om SAS

`src/data/airlines.json:2` — renderet på selskabssiden (`build-pages.mjs:277`) **og på hver af de fire situationssider** (`build-pages.mjs:295`), dvs. 5 offentlige sider.

C-28/20 *Airhelp Ltd mod Scandinavian Airlines System Denmark – Norway – Sweden* (23. marts 2021) er en **præjudiciel afgørelse** efter TEUF art. 267, forelagt af Attunda tingsrätt. EU-Domstolen fortolker EU-retten og dømmer ikke en part. [FAST RET]

**Foreslået tekst:**

> "EU-Domstolen fastslog i 2021 i sagen Airhelp mod SAS (C-28/20), at en lovligt varslet strejke blandt et flyselskabs eget personale ikke er en usædvanlig omstændighed. SAS har hub i København og flyver flest afgange fra Danmark."

`om.html:13` har formuleringen korrekt.

### 11. Udokumenterede adfærdspåstande om navngivne flyselskaber

Alle renderes på 5 sider pr. selskab.

| Fil:linje | Tekst | Problem |
|---|---|---|
| `src/data/airlines.json:4` | Ryanair "afviser ofte i første omgang" | Faktuel adfærdspåstand uden kilde, "ofte" ikke dokumenterbart |
| `src/data/airlines.json:8` | Wizz Air "har fået kritik af flere europæiske myndigheder for langsom behandling" | Mest eksponeret. Der er grundlag (UK CAA's håndhævelsessag 2023), men ingen kilde vises |
| `src/data/airlines.json:7` | Lufthansa har "ofte" strejker | Værdiladet hyppighedspåstand uden belæg |

Markedsføringslovens § 20, stk. 1 og 3. Sandhedsbevis efter straffelovens § 269, stk. 1, frifinder normalt — **hvis beviset kan føres**, og det er dokumentationen, der mangler. [VURDERING]

**Ret:** tilføj et `sourceUrl`-felt i `airlines.json`, som build renderer som kildehenvisning. Forslag:

- Ryanair: "Ryanair kræver, at kravet indgives via selskabets egen formular. Får du et afslag uden konkret begrundelse, så bed skriftligt om dokumentation for den usædvanlige omstændighed, inden du klager videre."
- Wizz Air: "Den britiske luftfartsmyndighed CAA indledte i 2023 håndhævelsesskridt mod Wizz Air om behandlingen af passagerkrav [link]. Regn med, at du skal følge op."
- Lufthansa: "Lufthansa har gentagne gange haft arbejdsnedlæggelser blandt eget personale. Sådanne strejker fritager ikke selskabet for kompensation, jf. C-28/20."

### 12. Estimat præsenteret som fast sats om navngiven konkurrent

`src/data/providers.json:8` har `"fee": 30` med noten "Omkring 30 %. ... den præcise sats står ikke på forsiden." Tabellen i `build-pages.mjs:138` renderer det som hårde **"30 %"** og **sorterer på det**.

`build-pages.mjs:110` (FAQ) modsiger direkte sitets egen note:

> "Flyret og **Flyforsinkelse.dk** oplyser, at de holder salæret uændret."

Dertil: `providers.json:8` og `:10` angiver `"source": "flyforsinkelse.dk og flyjura.dk"` / `"airhelp.dk og flyjura.dk"`. **flyjura.dk er en tredje aktør i samme branche** — en konkurrents markedsføringsside som kilde til en anden konkurrents pris er et reelt dokumentationsproblem.

Markedsføringslovens § 20, stk. 1, og — når affiliate-aftalen er live — § 21, stk. 2, nr. 1 og 3 (sammenligningen skal ske objektivt på egenskaber, der kan dokumenteres). [FAST RET]

**Ret:**

1. Sæt `"fee": null` for Flyforsinkelse.dk, så kolonnen viser "Ikke oplyst".
2. Fjern Flyforsinkelse.dk fra FAQ-svaret i `build-pages.mjs:110`.
3. Lad `"source"` kun pege på udbyderens egne sider.

## Brevgeneratoren påstår krav, brugeren ikke har

Overordnet er brevet velskrevet: det truer ikke med inkasso, politianmeldelse, renter eller retssag, sætter en høflig 14-dages frist som en anmodning, og varsler kun det, der kan gennemføres. Ingen bindende udsagn, ingen afkald på rettigheder. Problemerne ligger i regelvurderingen.

**Strukturel årsag:** `letter.js` har sin egen forenklede vurdering i stedet for at kalde `assess()` fra `eu261.mjs`. De to divergerer allerede.

### 13. Brevet kræver EU261-kompensation uden for forordningens område

`src/assets/letter.js:86` giver kun en advarsel; `noComp` på `:92` omfatter ikke tilfældet:

```js
const noComp = (hvad === 'forsinket' && delayMin < 180) || (hvad === 'aflyst' && daysBefore >= 14);
```

Begge lufthavnsvælgere fyldes med alle lufthavne (`letter.js:13-18`) — `airports.json` har 36 med `zone: "other"` og 6 med `zone: "uk"`.

Dubai → København med Emirates producerer et brev, der ordret påstår "Efter forordningens artikel 7 har hver passager derfor krav på 600 €" (`letter.js:111`) og varsler Trafikstyrelsen (`letter.js:129`). Efter art. 3, stk. 1, litra b, er den flyvning ikke omfattet, når selskabet ikke er EF-luftfartsselskab. For UK-afgange påstås ligeledes EU261 og Trafikstyrelsen, hvor det rettelig er UK261 og UK CAA — hvilket sitet selv skriver korrekt i `airlines.json:12`.

**Ret:**

```js
const inScope = from.zone === 'eu' || (al && al.zone === 'eu');
const noComp = !inScope
  || (hvad === 'forsinket' && delayMin < 180)
  || (hvad === 'aflyst' && daysBefore >= 14);
```

Og ved `from.zone === 'uk'`: skift retsgrundlag til UK261 og myndighed til UK Civil Aviation Authority.

### 14. Ombookning indgår ikke i vurderingen

`src/pages/klag-selv.html:49` lader brugeren vælge "Ombookning tæt på det oprindelige tidspunkt". `letter.js:98` læser værdien, men bruger den **kun** til en beskrivende sætning (`:107`) — den påvirker hverken `noComp` eller beløbet.

Efter art. 5, stk. 1, litra c, nr. ii og iii bortfalder kompensationen helt ved tilstrækkeligt tæt omlægning, og efter art. 7, stk. 2, kan selskabet nedsætte med 50 %. [FAST RET] Beregneren håndterer det korrekt via `rerouteH` (`app.js:72`).

Brugeren kan sende et krav på fuldt beløb i en situation, hvor der efter reglerne er nul.

### 15. Frivillighed ved nægtet boarding afdækkes ikke

`src/pages/klag-selv.html:36-41` har tre valg, og brevet skriver ubetinget (`letter.js:108`):

> "Jeg blev nægtet boarding **mod min vilje** ..."

Art. 4, stk. 1, udelukker kompensation for passagerer, der frivilligt afgiver deres plads, og art. 2, litra j, undtager afvisning på rimelige grunde. [FAST RET] Beregneren spørger om frivillighed (`#frivillig`, brugt i `app.js:74`); brevgeneratoren gør det ikke. En frivillig med voucher genererer altså et brev, der erklærer det modsatte over for en modpart, der har dokumentation for aftalen.

### 16. Artikel 9 kræves under artikel 6's tærskler, og artikel 8 kræves efter gennemført ombookning

`src/assets/letter.js:110` (dansk) og `:140` (engelsk). `noComp` er sand for enhver forsinkelse under 180 minutter — også 20 minutter, hvor art. 9-forpligtelsen slet ikke er udløst. Samme fejl i advarselsteksten `letter.js:83`.

Og: art. 8, stk. 1, giver et **valg** mellem refusion og omlægning. Har passageren taget imod omlægningen og gennemført rejsen, er valgretten udtømt. Brevet kræver begge dele uanset `ombook`-værdien. [FAST RET]

**Ret:** beregn art. 6-tærsklen ud fra `km`, og betingelsesstyr art. 8-passagen på `ombook === 'ingen'`.

### 17. Ansvarsfraskrivelse mangler ved selve brevet

`src/pages/klag-selv.html:81-91` viser brevet med kopiér-, mailto- og printknapper. Der er advarselsboksen `#b-advarsel`, men ingen tekst om, at brugeren selv står inde for indholdet. Footeren (`template.html:37`) står langt nede og er generisk.

[VURDERING] Sitet leverer et færdigt juridisk dokument, brugeren sætter sit navn under. Ansvarsgrundlaget er almindelig culpa for mangelfuld rådgivning. En generel ansvarsfraskrivelse afskærer ikke ansvar for konkret urigtig information (og kan tilsidesættes efter aftalelovens § 36), men den påvirker adressatens berettigede forventning — og den hører hjemme ved brevet.

**Foreslået tekst over `<h3>Dit klagebrev</h3>`:**

> **Læs brevet igennem, før du sender det.** Teksten er et forslag, bygget på det, du har tastet, og på EU-forordning 261/2004. Det er dig, der står inde for indholdet over for flyselskabet. Tjek især tider, bookingnummer og passagernavne. Tjek dit fly yder vejledning, ikke juridisk rådgivning, og kan ikke vurdere din konkrete sag.

## Formelt

### 18. Identitetsoplysninger mangler helt

E-handelslovens § 7, stk. 1, kræver **navn, geografisk adresse, e-mailadresse og CVR-nummer**, og stk. 3 kræver "let tilgængelig og vedvarende adgang". [FAST RET]

I dag: `om.html:9` kun navn og e-mail; `kontakt.html:14` kun "Ansvarlig for siden"; `privatliv.html:7` navn og mail. **Intet CVR og ingen geografisk adresse nogen steder.**

Sitet skriver selv i nutid "Den er finansieret af annoncelinks" (`index.html:71`, `om.html:9`), så pligten er reelt udløst. [VURDERING]

**Tilføj nederst på `/om/` og `/kontakt/`:**

> **Udgiver**
> Tjek dit fly · Rasmus Pedersen
> [Vej og nr., postnr. by]
> CVR-nr. [xxxxxxxx]
> kontakt@tjekditfly.dk
> Ansvarlig for indholdet: Rasmus Pedersen

Ønskes bopælen ikke offentliggjort, brug en c/o- eller kontorfællesskabsadresse. Overvej `address` og `vatID` i `Organization`-objektet (`build-pages.mjs:38`).

### 19. Småsagsprocessen findes ikke under det navn længere

Ved lov af 12. juni 2024, i kraft **15. juni 2024**, blev retsplejelovens kapitel 39 omdøbt til **"den forenklede proces"**, og beløbsgrænsen i § 400, stk. 1, hævet fra 50.000 til **100.000 kr**. Retsafgiften på 750 kr er stadig korrekt, og der er ingen hovedforhandlingsafgift til og med 100.000 kr. [FAST RET]

| Fil:linje | Ret til |
|---|---|
| `src/pages/klag-selv.html:8` | "Sidste udvej er **den forenklede proces** ved byretten." |
| `src/pages/klag-selv.html:104` | "Krav på **højst 100.000 kr** kan køres efter **den forenklede proces** uden advokat. Retsafgiften er 750 kr, og retten pålægger **som udgangspunkt** modparten at betale den, hvis du vinder." |
| `scripts/build-pages.mjs:104` | Samme rettelse |
| `scripts/build-pages.mjs:126` | "småsagsprocessen" i meta-description |

"Som du får tilbage, hvis du vinder" er for kategorisk — sagsomkostninger fastsættes af retten efter retsplejelovens § 312, som kan fravige.

### 20. Privatlivspolitikken nævner ikke brevgeneratoren

`src/pages/privatliv.html:9-10` omtaler kun beregneren. Brevgeneratoren behandler navn, adresse, e-mail, telefon, bookingreference, flynummer, rejsedata, **medrejsendes fulde navne** (tredjepersoners personoplysninger) og eventuelt **reg.nr. og kontonummer** (`klag-selv.html:75`). GDPR art. 13.

Dertil: `mailto:`-linket i `letter.js:167` lægger hele brevet i en URL. Ved almindelig mailklient sker alt lokalt, men er der registreret en webmail-handler, sendes hele strengen som query-parametre til tredjemands server. Det står i modstrid med `klag-selv.html:13` ("Intet sendes til os eller gemmes"), som brugeren læser som "ingen steder hen".

**Foreslået afsnit efter `privatliv.html:10`:**

> **Brevgeneratoren på Klag selv**
> Når du udfylder brevgeneratoren, behandles alt — navn, adresse, e-mail, telefon, bookingnummer, flynummer, rejsedata, medrejsendes navne og et eventuelt kontonummer — udelukkende i din egen browser. Oplysningerne sendes ikke til os og gemmes ikke. Lukker du fanen, er de væk. Vi er derfor ikke dataansvarlige for de oplysninger, du taster.
> Bruger du knappen "Åbn i dit mailprogram", overføres brevteksten til det program eller den webmail, din browser er sat op til. Har du valgt en webmail, sendes teksten til den tjeneste. Vil du undgå det, så brug "Kopiér teksten" i stedet.
> Skriver du medrejsendes navne, er det dig, der behandler deres oplysninger. Aftal med dem, at du kræver på deres vegne.

### 21. "Uafhængig" kan ikke bæres efter aktivering af affiliate-aftalen

Ordet står i `src/template.html:32` (**footeren på hver eneste side**), `index.html:71`, `om.html:3`, `build-pages.mjs:372` (llms.txt), `README.md:3`, `package.json:5`.

I dag er `affiliates.json:3` sat til `"affiliate": false`, og knappen mærkes "Almindeligt link. Vi har ingen aftale med Flyhjælp endnu." Det er usædvanligt redeligt. Men `sammenlign.html:39` skriver selv "Vi arbejder på en annonceaftale med dem", og Flyhjælp er samtidig **én af de otte virksomheder, sitet sammenligner**, og placeres i ~320 CTA-bokse som den eneste anbefalede.

Markedsføringslovens § 6, stk. 4 (klar oplysning om kommerciel hensigt), § 5, stk. 1, nr. 4 (vildledning om tilknytning), § 3. [FAST RET]

[VURDERING] Ordet bruges i to betydninger, der glider sammen: *ikke ejet af branchen* (sandt) og *uden økonomisk interesse i, hvem du vælger* (ikke sandt fra aktiveringen). Ikke en klar overtrædelse i dag, men en påviselig risiko dagen efter godkendelsen.

**Foreslået footer:**

> "Tjek dit fly
> Ikke ejet af flyselskaber eller kompensationsselskaber. Finansieret af annoncelinks — [sådan tjener siden penge](/annoncelinks/).
> Reglerne er gennemgået {{rulesDate}}."

---

# BØR RETTES KORT EFTER

## Jura

### 22. Aflysning: kun ankomstvinduet modelleres, ikke afgangsvinduet

`src/lib/eu261.mjs:88, 91` og `src/pages/beregn.html:29-30`.

Art. 5, stk. 1, litra c, nr. ii og iii, kræver **to** betingelser opfyldt samtidig: nr. ii (7-13 dage) afgang højst 2 timer før **og** ankomst højst 4 timer efter; nr. iii (under 7 dage) afgang højst 1 time før **og** ankomst højst 2 timer efter. Koden ser kun på `rerouteH`. Fortegn og retning er i øvrigt korrekte.

En bruger, hvis erstatningsfly afgik 6 timer tidligere men ankom 3 timer senere, får "nej". Han har krav på fuld kompensation, fordi afgangsbetingelsen ikke er opfyldt.

**Ret:** tilføj feltet "Hvor meget tidligere end planlagt afgik erstatningsflyet?" og gør fritagelsen betinget af begge grænser.

**[UVERIFICERET randtilfælde]** Den engelske version siger "less than four hours" / "less than two hours", hvilket betyder, at der **er** kompensation ved præcis 4t00 og 2t00. Sitet og koden bruger "højst", som matcher den danske sprogversion. Tjek den officielle danske tekst på EUR-Lex før ændring — kendt oversættelsesuoverensstemmelse i 261/2004. EUR-Lex afviste automatiseret hentning under gennemgangen.

### 23. Forkert sagshenvisning ved no-show

`scripts/build-pages.mjs:201` henviser til C-321/11 for no-show-annullering. Konklusionen er rigtig, men sagen er **C-238/22, FW mod LATAM Airlines Group SA** (26. oktober 2023). C-321/11 (*Rodríguez Cachafeiro mod Iberia*, 4. oktober 2012) handler om at blive nægtet boarding på et tilslutningsfly efter forsinkelse på første led. [FAST RET]

### 24. London–København: regelsiden modsiger motoren

`src/pages/regler.html:16` siger "Fly fra London til København er dækket af UK261". Motoren siger EU261 — og motoren har ret efter art. 3, stk. 1, litra b (ankomst til EU fra tredjeland med EF-luftfartsselskab). Sandheden: **begge regelsæt gælder** på LHR→CPH med et EU-selskab. Med British Airways gælder kun UK261, hvilket koden også håndterer rigtigt.

Beløbsforskellen er reel: 250 € = 1.865 kr mod 220 £ = 1.915 kr; 600 € = 4.475 kr mod 520 £ = 4.525 kr. UK261 giver lidt mere i kroner.

**Ret:** "Fly fra London til København er dækket af UK261. Er selskabet et EU-selskab (fx SAS), er flyvningen **også** dækket af EU261, og du kan vælge det regelsæt, der passer dig bedst."

### 25. Ret til udbetaling i kroner mangler

I **Delfly mod Smartwings Poland, C-356/19** (3. september 2020) fastslog EU-Domstolen, at en passager kan kræve kompensationen i valutaen på sit bopælssted, og at selskabet ikke kan afvise kravet med, at det ikke er opgjort i euro. [FAST RET] Det **styrker** sitets kronebeløb.

**Tilføj under "Beløbene" på `regler.html`:**

> "Beløbene står i euro i forordningen, men du har ret til at kræve dem udbetalt i kroner. EU-Domstolen afgjorde det i sagen Delfly mod Smartwings (C-356/19, 2020). Kronebeløbene her er vejledende; det præcise beløb afhænger af kursen på betalingsdagen."

Kurserne er i øvrigt retvisende: EUR_DKK 7,46 mod faktisk ca. 7,475 (0,2 % under, dækket af "cirka"); GBP 8,7 mod ca. 8,72.

### 26. Forældelsesloven § 21, stk. 2, mangler helt

Indbringes sagen for et administrativt organ inden fristens udløb, indtræder forældelse tidligst 1 år efter, at organet har meddelt sin afgørelse. Trafikstyrelsen oplyser selv en sagsbehandlingstid på **9-12 måneder**. [FAST RET] Sitet lover tre år og fortæller hverken om ventetiden eller om, at klagen skal være indgivet **før** de tre år er gået.

**Tilføj til `regler.html:67`:**

> "Klager du til Trafikstyrelsen, inden de 3 år er gået, forældes kravet tidligst 1 år efter deres afgørelse (forældelsesloven § 21, stk. 2). Men klagen skal være indgivet inden fristen — og Trafikstyrelsens sagsbehandlingstid er typisk 9 til 12 måneder. Vent derfor ikke til sidste år."

### 27. Færøerne og Grønland er ikke omfattet af EU261

Art. 355, stk. 5, litra a, TEUF og bilag II; Kommissionens fortolkningsretningslinjer nævner udtrykkeligt Færøerne som tredjeland. CPH→Vagar er dækket som EU-afgang, men **Vagar→CPH med Atlantic Airways er ikke**. Relevante ruter for danske brugere, men hverken i lufthavnsdata eller tekst.

`airports.json` er i øvrigt korrekt: Kanarieøerne er `zone: 'eu'` (yderregioner), og ingen færøske/grønlandske lufthavne er fejlagtigt markeret som EU.

### 28. Trafikstyrelsens kompetence beskrevet for snævert

`src/pages/regler.html:76`: "den danske klagemyndighed for fly, der afgår fra Danmark". Styrelsen er også kompetent for ankomster til Danmark fra lande uden for EU med EU-selskab. Sitet siger det rigtige andre steder.

### 29. Halvering efter art. 7, stk. 2, bruges skævt

`src/lib/eu261.mjs:109-110`.

- **Nægtet boarding:** art. 4, stk. 3, henviser til både art. 7 og art. 8, så halveringen gælder også her. Koden halverer kun ved aflysning — sitet lover for meget.
- **Ren forsinkelse (`:110`):** koden halverer 600 € til 300 € ved 3-4 timers forsinkelse over 3.500 km uden for EU. Udbredt praksis, men **ikke afgjort af EU-Domstolen**. Ved ren forsinkelse er der ingen omlægning efter art. 8 — passageren fløj med det oprindelige fly. Sturgeon (C-402/07) og Nelson (C-581/10, C-629/10) anvender ikke art. 7, stk. 2, på forsinkelser. **[VURDERING] Omstridt punkt.**

`build-pages.mjs:345` og `regler.html:30` fremstiller halveringen som sikker ret.

**Ret:** behold beregningen (konservativ), men tilføj: "Nogle selskaber halverer til 300 € ved 3 til 4 timers forsinkelse på lange ruter uden for EU. Det er ikke afgjort af EU-Domstolen, og forordningens ordlyd knytter halveringen til en **tilbudt ombookning**. Fløj du med det oprindelige fly, er der gode argumenter for de fulde 600 €." Og indfør halvering ved nægtet boarding med ombookning.

### 30. "Fuld refusion" er for bredt

`src/lib/eu261.mjs:94` og `src/pages/regler.html:37`. Art. 8, stk. 1, litra a, giver refusion for den del af rejsen, der ikke er foretaget, og for allerede foretagne dele kun hvis flyvningen ikke længere tjener noget formål. En passager, der får hjemrejsen aflyst, har ikke krav på udrejsen retur.

**Ret:** "Refusion af den del af rejsen, du ikke fik — og af hele billetten, hvis rejsen dermed har mistet sit formål."

### 31. Artikel 6 måler afgangsforsinkelse, ikke ankomstforsinkelse

`src/lib/eu261.mjs:64, 79-84`. `delayH` er ankomstforsinkelse ved endelig destination — rigtigt for art. 7 efter Sturgeon (C-402/07) og Folkerts (C-11/11), men art. 6's forplejningstærskler måles mod **planlagt afgangstidspunkt**. Samme variabel bruges til begge. Begrebsmæssig sammenblanding, sjældent skadelig.

### 32. Nedgradering: trinene mangler

`src/pages/regler.html:47`, `build-pages.mjs:197`. Art. 10, stk. 2, er trinvis: 30 % (op til 1.500 km), 50 % (inden for EU over 1.500 km og andre 1.500-3.500 km), 75 % (øvrige). Sitet skriver "30 til 75 %" og lader brugeren i uvished om sit eget tal.

### 33. For kategorisk om tekniske fejl

`src/lib/eu261.mjs:43`, `regler.html:54`. Hovedreglen er rigtig (**Wallentin-Hermann C-549/07**, **van der Lans C-257/14**), men undtagelserne er flere, end motoren nævner: skjulte fabrikationsfejl og sabotage (Wallentin-Hermann præmis 26), **ydre skade på flyet** som et fremmedlegeme på landingsbanen, der ødelægger et dæk (**Germanwings C-501/17**, 4. april 2018), brændstof spildt på banen af en anden (**Moens C-159/18**, 26. juni 2019). En bruger med dækskade på banen får et "ja", der ikke holder.

**Ret:** "... heller ikke når de opdages uventet. Undtagelserne er få: skjulte fabrikationsfejl, sabotage og skader påført udefra, fx et fremmedlegeme på landingsbanen (C-501/17)."

### 34. Ekstern strejke og flyvekontrol fremstilles som automatisk fritagende

`eu261.mjs:48, 50`, `regler.html:59-60`, `index.html:37`, `build-pages.mjs:207, 211, 378`. De skarpeste formuleringer på sitet: "kan selskabet ikke gøre noget. Det er en usædvanlig omstændighed, og kompensationen bortfalder", "Nej. Flyvelederstrejke er uden for selskabets kontrol".

Udgangspunktet er rigtigt, men rimelighedsprøven gælder også her, jf. C-399/24. Selskabet skal dokumentere, at netop dets flyvning blev ramt, og at det ikke kunne have ombooket, omdirigeret eller indregnet reservetid. En fransk flyvelederstrejke varslet flere dage i forvejen er noget andet end en pludselig lufthavnsnedlukning. Strejke blandt handling-personale, selskabet selv har kontraheret, er ikke uden videre uden for dets kontrol.

En dansk forbruger vil opgive kravet uden at spørge.

**Ret:** "... er **som regel** en usædvanlig omstændighed. Men selskabet skal både dokumentere, at netop din flyvning blev ramt, og at forsinkelsen ikke kunne være undgået, fx ved ombookning. Var strejken varslet i god tid, er der ekstra grund til at bede om den dokumentation."

### 35. ATC-restriktioner

`eu261.mjs:50`, `regler.html:60`. En dom af **21. januar 2026** støtter, at visse beslutninger fra lufttrafikstyringen i sig selv kan udgøre usædvanlige omstændigheder. **[UVERIFICERET sagsnummer.]** Bekræfter sitets kategori, men ændrer ikke rimelighedsprøven. [VURDERING] Rutinemæssige ATFM-forsinkelser på grund af kendt kapacitetsmangel er stadig omstridte.

### 36. Datterselskabs-strejke

`scripts/build-pages.mjs:208`: "Personale hos et datterselskab ... gælder som egen strejke". **[UVERIFICERET]** — ingen retspraksis fundet, der understøtter påstanden som formuleret. Efter forordningen hæfter det transporterende luftfartsselskab; er datterselskabet selv det transporterende selskab, er dets egne ansattes strejke dets egen — men det er ikke det samme som det, sætningen siger. Blød op eller fjern.

### 37. Fuldmagt mangler ved flere passagerer

`klag-selv.html:33` beder om "Fulde navne, adskilt med komma"; `letter.js:66-67` ganger beløbet, og brevet kræver det samlede beløb udbetalt til **én** konto (`letter.js:127`). Kompensationskravet tilkommer den enkelte passager personligt. Trafikstyrelsen stiller selv en fuldmagtsskabelon til rådighed. [FAST RET, forvaltningspraksis]

**Tilføj i brevet ved `pax.length > 1`:**

> "Jeg er bemyndiget af de øvrige passagerer i bookingen til at fremsætte kravet og modtage betalingen på deres vegne. Fuldmagt kan fremsendes på anmodning."

Og et hint under feltet: "Skriv kun medrejsende, du har aftalt at kræve på vegne af. Er de voksne, bør du have en kort skriftlig fuldmagt — selskabet kan bede om den."

### 38. Forkert myndighed ved udenlandsk afgang

`src/assets/letter.js:129`. Myndighedsnavnet **Trafikstyrelsen** er korrekt og aktuelt (verificeret 22.09.2026; den forbrugerrettede side er flypassager.dk, engelsk navn "Danish Civil Aviation and Railway Authority" i `klag-selv.html:159` er rigtigt). Der findes **intet dansk "Flyklagenævn"**.

Men kompetencen er forkert gengivet: ved afgang fra fx Málaga har Trafikstyrelsen ingen kompetence — det er spanske AESA. Brevet nævner alligevel Trafikstyrelsen først og den udenlandske myndighed som et "eller".

```js
const neb = from.cc === 'DK' ? 'Trafikstyrelsen'
  : from.zone === 'uk' ? 'den britiske Civil Aviation Authority'
  : `den kompetente nationale håndhævelsesinstans i ${from.country}`;
```

### 39. For kategorisk om usædvanlige omstændigheder i brevet

`letter.js:112, 142` og skabelonerne i `klag-selv.html:129, 157`. Sagshenvisningerne C-549/07, C-195/17 og C-28/20 er **korrekte** og god praksis at citere. Men udsagnet er for bredt, jf. punkt 33.

**Foreslået:** "Jeg gør opmærksom på, at tekniske fejl, der opstår som led i den normale drift, manglende besætning og strejke blandt selskabets eget personale efter EU-Domstolens praksis som udgangspunkt ikke er usædvanlige omstændigheder (bl.a. C-549/07, C-195/17 og C-28/20). Påberåber I jer en undtagelse hertil, beder jeg om dokumentationen."

### 40. Renter — en mulighed, brevet ikke udnytter

Renteloven § 3, stk. 2: rente fra **30 dage** efter afsendt påkrav. § 5, stk. 1: referencesatsen plus 8 procentpoint. [FAST RET]

**Faldgrube:** brevet sætter en frist på 14 dage (`letter.js:127`). En sætning om renter efter 14 dage ville være retligt forkert — kreditor kan ikke afkorte 30-dagesfristen ensidigt.

**Valgfri tilføjelse:** "Betales beløbet ikke, beregner jeg renter efter rentelovens § 3, stk. 2, jf. § 5, det vil sige referencesatsen med tillæg af 8 procentpoint, fra 30 dage efter dette brevs dato."

Behold som frivillig afkrydsning. Tilføj ikke noget om inkasso — mod et flyselskab er det uden effekt og svækker brevets troværdighed.

## Markedsføring og teknik

### 41. Annoncemarkeringen står under knappen

Forbrugerombudsmandens vejledning: markeringen skal stå "oven over eller i direkte forlængelse af linket", må ikke stå til sidst, og modtageren skal blive klar over det "inden eller samtidig med, at de ser linket". [FAST RET, forvaltningspraksis]

I dag er `.cta-actions{display:grid;gap:10px}` (`style.css:96`), så noten står **under** knappen.

Vurderet i øvrigt: **ordvalget "Annoncelink" er præcis FO's anviste ord** (`build-pages.mjs:76`), `rel="nofollow sponsored noopener"` sættes automatisk (`:75`), og kontrasten `--muted:#4a5a70` på `--accent-soft:#e8eff9` er ca. 5,9:1, over WCAG AA. Alt sammen i orden.

**Ret:** byt rækkefølgen i `build-pages.mjs:78` og `app.js:80`, så markeringen står før knappen, og fjern `muted` fra netop den span — markeringen må ikke være mindre fremtrædende end det kommercielle budskab. Bemærk også, at `sammenlign.html:8` og `:39` fremhæver Flyhjælp uden markering i nærheden.

### 42. Flyhjælps 30 % er hardkodet på ~320 sider

`scripts/build-pages.mjs:78, 80, 278, 298, 362` indeholder alle strengen "De tager 30 % af kompensationen inkl. moms" som hardkodet tekst — ikke læst fra `providers.json`. `README.md:53` instruerer i månedlig opdatering af `providers.json`, men det opdaterer **kun tabellen på `/sammenlign/`**. Ændrer Flyhjælp sit salær, vil ~320 sider fortsat påstå 30 %.

Markedsføringslovens § 5, stk. 1, og § 20, stk. 1 — det er sitets eget udsagn om en tredjeparts pris.

```js
const FHP = providersFile.providers.find((p) => p.slug === 'flyhjaelp');
const FH_FEE = `${FHP.fee} %`;
```

Tilføj samtidig datering i `ctaBox()`: "Salær aflæst på flyhjaelp.dk den {{CHECKED}}."

### 43. Udbydertabellen viser ingen kilder

`build-pages.mjs:133-139` renderer hverken `priceUrl` eller `source` — læseren kan ikke verificere et eneste tal, selvom dokumentationen findes i data. § 21, stk. 2, nr. 3, kræver dokumenterbarhed. Tilføj en kildekolonne. Billigste forsvar mod hele § 20-komplekset.

Samme gælder `providers.json:9` om Flypenge: påstanden om TV 2's omtale 7. maj 2026 er **verificeret korrekt**, men `"source"` peger på flypenge.dk/prices, og kilden vises ikke. Tilføj et `extrasSource`-felt med TV 2-URL'en — med kilden på plads er sandhedsbeviset ført på forhånd.

### 44. Schema.org-entiteter for tredjeparter

`build-pages.mjs:272` udgiver `{'@type': 'Airline', name, legalName, url}` for tredjeparts virksomheder på sitets egne sider. [VURDERING] Kan få søgemaskiner til at knytte indholdet til selskabet. Erstat med `about: {'@type': 'Airline', ...}` på `WebPage`, som udtrykker "siden handler om" i stedet for "siden er".

Tilsvarende `build-pages.mjs:130`: sidetitlen "Sammenlign Flyhjælp, AirHelp og 6 andre på salær" bruger en konkurrents kendetegn i titlen på en side, der bærer affiliate-linket til rivalen — § 21, stk. 2, nr. 7, efter aktivering. Neutralisér til fx "Sammenlign 8 selskaber, der henter flykompensation".

### 45. Privatlivspolitikken mangler elementer efter GDPR art. 13

| Mangler | Hjemmel |
|---|---|
| Behandlingsgrundlag for mailkorrespondance (art. 6, stk. 1, litra f) | art. 13, stk. 1, litra c |
| Dataansvarliges fulde identitet — adresse mangler | art. 13, stk. 1, litra a |
| Tredjelandsoverførsel — Cloudflare nævnes, men ikke overførsel til USA og grundlaget | art. 13, stk. 1, litra f |
| Databehandleraftale med Cloudflare | art. 28, stk. 3 |
| Ret til indsigelse og dataportabilitet — kun indsigt/rettelse/sletning nævnt | art. 13, stk. 2, litra b |
| Datatilsynets kontaktoplysninger — nævnes uden link | art. 13, stk. 2, litra d |
| Opbevaringsperiode for logdata hos Cloudflare | art. 13, stk. 2, litra a |

Myndighedsnavnet **Datatilsynet** er korrekt.

### 46. Småting

| Fil:linje | Fund |
|---|---|
| `providers.json:11` | `"based": "Aarhus"` — inkonsistent med øvrige rækker, der angiver land. Ret til "Danmark (Aarhus)" |
| `providers.json:5-12` | `feeNote` og `extras` blandes i samme tabelcelle (`build-pages.mjs:138`), så faktuelle prisoplysninger og evaluerende råd står uadskilt. Svækker objektivitetskravet i § 21, stk. 2, nr. 3 |
| `sammenlign.html:8` | "De danske selskaber tager typisk 30 % af kompensationen inkl. moms" — momsangivelsen er ikke verificeret for alle otte |
| `letter.js:73-76` | Forsinkelsen beregnes uden rimelighedskontrol. Advar ved `delayMin > 1440` eller `< 0` uden "næste dag"-markering |

---

# HVAD DER ER RIGTIGT

Væsentligt for en kvalitetssikring, da meget er præcist:

- **Artikel 7, stk. 1, herunder det svære tilfælde:** flyvninger inden for EU over 3.500 km giver **400 €**. Verificeret: CPH–Las Palmas 3.805 km → 400 €; CPH–Tenerife 3.849 km → 400 €; Helsinki–Las Palmas 4.696 km → 400 €. `regler.html:26` og `beregn.html:63` forklarer det korrekt. **Dette er den hyppigste fejl på danske kompensationssider — her er den ikke.**
- **Artikel 3, stk. 1:** afgang fra EU altid dækket uanset selskab; ankomst til EU fra tredjeland kun med EF-luftfartsselskab. Verificeret: Bangkok→København med Thai Airways → "ikke dækket". Håndteringen af `airlineZone === 'unknown'` med verdict `null` er en god løsning.
- **Nægtet boarding har ingen undtagelse for usædvanlige omstændigheder** — implementeret korrekt i `eu261.mjs:102` (`situation !== 'naegtet-boarding'`).
- **Forplejningspligten bortfalder aldrig** (McDonagh C-12/11) — korrekt på `regler.html:64`, og motoren pusher rettighederne selv når `eligible === false`.
- **Korrekt citerede sager:** Sturgeon C-402/07, Folkerts C-11/11, Krijgsman C-302/16, Krüsemann C-195/17, Airhelp mod SAS C-28/20, Pešková C-315/15, Wallentin-Hermann C-549/07, van der Lans C-257/14, TAP C-156/22 til C-158/22 (11. maj 2023).
- **Artikel 3, stk. 2 og 3:** check-in 45 minutter, gratis og ikke-offentligt tilgængelige billetter undtaget, bonuspointbilletter dækket. Korrekt på `regler.html:17`.
- **UK261-beløbene 220/350/520 £** — verificeret mod den britiske udgave af artikel 7.
- **Forældelse i Danmark:** 3 år efter forældelsesloven § 3, stk. 1, regnet fra flyvningen (§ 2, stk. 1). Montreal-konventionens 2-årsfrist gælder ikke for kompensation efter 261/2004 (Cuadrench Moré C-139/11).
- **Storcirkelberegningen** (haversine) svarer til artikel 7, stk. 4. Afrunding til nærmeste 5 kr er fornuftig.
- **"Ingen cookies" holder.** Scanning af `src/assets/*.js`, `style.css`, `template.html` og hele det byggede `public/`: ingen `document.cookie`, `localStorage`, `sessionStorage` eller `indexedDB`. Ingen eksterne ressourcer — `style.css:5` bruger kun systemskrifter, ingen Google Fonts, CDN, analytics eller tag manager. Alle eksterne `https://`-URL'er er links i `<a>`, ikke ressourcer. Eneste netværkskald er samme oprindelse. **Intet samtykkekrav efter cookiebekendtgørelsens § 3.** Sjældent, at et site kan sige det med rette.
- **Brevgeneratoren behandler personoplysninger udelukkende lokalt.** `letter.js:165` skriver til `textContent` og sender intet. Ingen `fetch`/XHR med formulardata. Verificeret.
- **`letter.js` er sitets mest afbalancerede tekst.** Linje 87 ("Vejr og strejke uden for selskabet er **som regel** usædvanlige omstændigheder ... vær forberedt på et nej") og linje 112 (beder om dokumentation for begge led af art. 5, stk. 3) rammer nuancen langt bedre end regelmotoren. **Brug den formulering som forbillede for de øvrige tekster.**
- **Brevet truer ikke med noget, det ikke kan gennemføre.** Ingen inkasso, ingen politianmeldelse, ingen retssag, ingen urigtige rentepåstande. Fristen er en høflig anmodning. Ingen bindende udsagn eller afkald på rettigheder.
- **`/annoncelinks/` er usædvanligt ærlig**, og `om.html:7` ("Jeg er tekniker, ikke jurist") er stærk og korrekt disclosure. Juridisk vejledning er i øvrigt ikke et lovreguleret monopol i Danmark — retsplejelovens § 260 angår mødeberettigelse — så der er ingen hindring for at drive sitet.
- **`airports.json`** er korrekt: Kanarieøerne `zone: 'eu'` (yderregioner), ingen færøske/grønlandske lufthavne fejlagtigt som EU.

---

# GENNEMGÅENDE MØNSTRE

**1. Regelmotoren er mere kategorisk end sitets egne prosatekster.** `build-pages.mjs:166`, `regler.html:50` og `letter.js:87` har den rigtige nuance; `eu261.mjs` har den ikke. Mange rettelser handler om at bringe motoren op på niveau med teksterne — ikke om at ændre jura.

**2. Brevgeneratoren duplikerer regelvurderingen i forenklet form.** Punkt 13-16 løses bedst strukturelt: lad `letter.js` kalde `assess()` fra `eu261.mjs` i stedet for at have sin egen logik. Så arver brevet automatisk rettelserne i punkt 2, 7 og 8, og de to kan ikke divergere fremover.

**3. Påstande om navngivne virksomheder mangler kilder.** Punkt 9-12 og 43. Dokumentationen findes delvis allerede i data — den renderes bare ikke. En kildekolonne og et `sourceUrl`-felt fjerner det meste af risikoen.

---

# SAMLET VURDERING

Fundamentet er intakt: 3-timers-grænsen og 250/400/600 € gælder i dag og frem til omkring midten af 2027, anvendelsesområdet i artikel 3 er rigtigt implementeret, det vanskelige 400 €-bånd for lange EU-ruter er rigtigt, retspraksis er overvejende korrekt citeret, cookie-påstanden holder, og brevet er klogt skrevet. Fagligt ligger niveauet over de fleste danske kompensationssider.

De alvorlige fund er koncentreret i fire ting:

1. **Motoren afgør usædvanlige omstændigheder på én betingelse i stedet for to** (punkt 7) — den fejl koster brugere berettigede krav.
2. **Brevgeneratoren påstår krav uden for forordningens område og ignorerer ombookning** (punkt 13-16).
3. **Urigtige eller ukildede udsagn om navngivne virksomheder** (punkt 9-12).
4. **Forældede tal:** Montreal 1.288 SDR (punkt 1) og småsagsgrænsen 50.000 kr (punkt 19).

Sitet bør ikke publiceres, som det står — men det er tæt på.

---

## Kilder

Europa-Kommissionen om aftalen 15.6.2026 · Europa-Parlamentets Legislative Train · Forordning 261/2004 art. 6 og 7 · Kommissionens fortolkningsretningslinjer 2016/C 214/04 · ICAO om de reviderede Montreal-grænser · C-399/24 AirHelp mod Austrian Airlines · C-238/22 LATAM Airlines · C-356/19 Delfly · C-22/11 Finnair mod Lassooy · Dawson v Thomson Airways [2014] EWCA Civ 845 · Forbrug.dk om flyklager · Trafikstyrelsens flypassager.dk · Forældelsesloven § 21 · Markedsføringsloven §§ 5, 6, 20 og 21 · E-handelsloven § 7 · Renteloven §§ 3 og 5 · Retsafgiftsloven · Advokatsamfundet om de advokatetiske regler 2022 · Forbrugerombudsmanden om skjult reklame og affiliate-markering · Datatilsynet
