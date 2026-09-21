# Tjek dit fly (tjekditfly.dk)

Uafhængig dansk guide til flykompensation efter EU-forordning 261/2004. Statisk site, ingen framework, ingen cookies.

## Struktur

- `src/template.html` – skabelonen (head, header, footer). `{{}}`-pladsholdere udfyldes af build.
- `src/pages/*.html` – de faste sider (kun `<main>`-indholdet). Rediger her.
- `src/lib/eu261.mjs` – regelmotoren: afstand, beløb, dækning, undtagelser. Bruges både ved build og i browserens beregner.
- `src/data/airports.json` – lufthavne med koordinater og ruter (genereres af `scripts/make-airports.mjs` fra OurAirports).
- `src/data/airlines.json` – de 19 selskaber med hjemland, licenszone og kontaktvej.
- `src/data/providers.json` – kompensationsselskabernes salær til `/sammenlign/`. Opdatér `checked`, når du tjekker igen.
- `src/data/affiliates.json` – **her indsættes Flyhjælps tracking-link, når Adtraction har godkendt.** Sæt `affiliate: true`, `url` og `since`; build mærker knapperne "Annoncelink" og sætter `rel="nofollow sponsored"`.
- `scripts/build-pages.mjs` – genererer alle sider, sitemap.xml og llms.txt.
- `scripts/test-rules.mjs` – regressionstest af regelmotoren mod kendte afgørelser. `scripts/test-pages.mjs` – kvalitetstest af hver bygget side.
- `public/` – det færdige site. Det er denne mappe, Cloudflare skal servere.

## Byg og kør lokalt

```bash
bash build.sh
node serve.cjs
```

Siden kører så på http://localhost:9000. Kræver Node 18+ og Git Bash (til `build.sh`).

## Deploy på Cloudflare Pages (gratis)

1. Opret et repo på GitHub (fx `RasmusPedersenFragt/tjekditfly`) og push hele mappen inkl. `public/`.
2. På https://dash.cloudflare.com vælg **Workers & Pages → Create → Pages → Connect to Git**, vælg repoet og branch `main`.
3. Build settings: *Framework preset* = None, *Build command* = tom, *Build output directory* = `public`.
4. Under **Custom domains** tilføj `tjekditfly.dk` og `www.tjekditfly.dk`.
5. Hos registraren: skift domænets navneservere til de to, Cloudflare angiver. Tager op til 24 timer.

Herefter deployer Cloudflare automatisk ved hvert push til `main`. Husk `bash build.sh` før commit, så `public/` er opdateret. Alternativt kan `wrangler deploy` bruges med `wrangler.jsonc` (Workers med statiske assets).

## Sidetyper

| Type | Antal | URL |
|---|---|---|
| Faste sider | 10 | `/`, `/beregn/`, `/regler/`, `/klag-selv/`, `/sammenlign/`, `/om/`, `/annoncelinks/`, `/privatliv/`, `/kontakt/`, `/404.html` |
| Situationer | 5 + oversigt | `/situation/forsinket/` osv. |
| Flyselskaber | 19 + oversigt | `/flyselskab/sas/` |
| Selskab × situation | 76 | `/flyselskab/sas/aflyst/` |
| Lufthavne | 4 + oversigt | `/lufthavn/koebenhavn/` |
| Ruter | 219 | `/rute/koebenhavn-london-heathrow/` |

## Næste skridt

1. Opret `kontakt@tjekditfly.dk` (mailadressen står på alle trust-sider).
2. Søg Flyhjælps program på Adtraction (kanaltype Content Marketing), og indsæt tracking-linket i `src/data/affiliates.json`.
3. Tilmeld sitet Google Search Console og Bing Webmaster Tools, indsend `sitemap.xml`.
4. Tjek `providers.json` hver måned og opdatér `checked`.
5. Hold øje med EU's revision af forordningen; grænser og beløb ligger samlet i `src/lib/eu261.mjs`.
