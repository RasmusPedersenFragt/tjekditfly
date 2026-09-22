# Sproglig gennemgang, 22. september 2026

Korrekturlæsning af alle brugervendte danske tekster (grammatik, kommatering efter det traditionelle grammatiske komma, stavning, formulering, konsekvens). 14 filer rettet, 86 linjer ændret. Ingen tal, beløb, frister, artikel- eller sagsnumre er ændret, og det juridiske indhold er ikke blødt op eller skærpet.

## Systematiske valg

- **Startkomma** konsekvent: komma foran ledsætninger (også efter "kun", "efter", "alt efter", "se/ved/læse"), og komma fjernet foran "og"/"eller"/"samt" mellem sideordnede led.
- **"selv om"** i to ord overalt. **"e-mail"** i stedet for "mail" om breve og adresser ("mailprogram" og "webmail" bevaret som faste sammensætninger). **"uanset"** ikke længere som selvstændigt adverbium; nu "under alle omstændigheder".
- **Ejefald af navne på s**: ny hjælper `gen()` i build-pages.mjs giver "SAS' eget personale" i stedet for "SASs". Hvor det kunne undgås, er ejefaldet omskrevet ("kundeservice hos SAS").
- **Beregnerens overskrifter**: "Sandsynligvis, kræv den" er blevet "Sandsynligvis. Kræv den alligevel"; "Sandsynligvis ikke, men bed om dokumentation" er blevet "Sandsynligvis ikke. Bed om dokumentation"; "Nej, ikke kompensation i denne situation" er blevet "Nej, der er ikke kompensation i denne situation".

## Udvalgte rettelser

| Fil | Før | Efter | Type |
|---|---|---|---|
| eu261.mjs | både beviser den usædvanlige omstændighed og at forsinkelsen | …omstændighed, og at forsinkelsen | komma |
| eu261.mjs | 1 år efter deres afgørelse | 1 år efter afgørelsen | kongruens |
| regler.html | Beløb og 3 timer er uændret | Beløbene og grænsen på 3 timer er uændrede | kongruens |
| regler.html | Reglerne er revideret, og gælder fra 2027 | Reglerne er revideret og gælder fra 2027 | komma |
| index.html | vores skabelon, det er gratis og virker ofte | vores skabelon. Det er gratis og virker ofte | kommasplejsning |
| klag-selv.html | Svarer de ikke …, klag til Trafikstyrelsen | …, så klag til Trafikstyrelsen | grammatik |
| nye-regler-2027.html | Ombookning med tænder | Skærpede krav til ombookning | formulering |
| nye-regler-2027.html | derefter hvert 5. time | derefter hver 5. time | genus |
| privatliv.html | ingen cookiebanner | intet cookiebanner | genus |
| letter.js | 1 minutter / 1 minutes | 1 minut / 1 minute | bøjning |
| letter.js | Der er ikke et krav at skrive brev om | Der er ikke noget krav at skrive brev om | grammatik |
| build-pages.mjs | kun hvis du får pengene (7 steder) | kun, hvis du får pengene | komma |
| build-pages.mjs | Så har du ingen krav | Så har du intet krav | genus |
| build-pages.mjs | 21 dage fra du fik den | 21 dage fra den dag, du fik den | grammatik |
| providers.json | Går sagen i retten, i alt 45 % | Går sagen i retten, er det i alt 45 % | grammatik |
| airlines.json | krav sendes via deres egen formular | via sin egen formular | kongruens |

## Overvejet, men ladt stå

- Lille bogstav efter kolon i overskrifter og titler: tilladt og konsekvent på sitet.
- "handlingpersonale" uden fuge-s: branchens gængse skrivemåde, konsekvent på sitet.
- "check-in": står i Retskrivningsordbogen; "tjek" bruges om sitets egen handling.
- "vouchers": fagterm, brugt konsekvent.
- Den engelske brevtekst: kun to tydelige fejl rettet (komma efter indledende ledsætning, "1 minutes").

Build efter gennemgangen: 336 sider bygget, regelmotorens tests bestået, 337 sider testet uden fejl.
