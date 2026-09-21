#!/usr/bin/env bash
# Bygger hele sitet til public/:
#   1. assets fra src/assets og src/lib med versionshash i URL'en
#   2. lufthavnsdata til browseren (public/data/airports.json)
#   3. alle HTML-sider, sitemap.xml og llms.txt (scripts/build-pages.mjs)
#   4. kvalitetstest af hver side og af regelmotoren
# Brug: bash build.sh   (kræver Node 18+)
set -e
cd "$(dirname "$0")"

h() { md5sum "$1" | cut -c1-8; }
mkdir -p public/assets public/data
cp src/lib/eu261.mjs public/assets/eu261.js
RULES_V=$(h public/assets/eu261.js)
sed "s|__RULES_V__|$RULES_V|g" src/assets/app.js > public/assets/app.js
APP_V=$(h public/assets/app.js)
cp src/assets/style.css public/assets/style.css
STYLE_V=$(h public/assets/style.css)
cp src/assets/favicon.svg public/assets/favicon.svg
cp src/data/airports.json public/data/airports.json
echo "Assets: style $STYLE_V, app $APP_V, rules $RULES_V"

node --check public/assets/app.js
node --check public/assets/eu261.js

rm -rf public/rute public/flyselskab public/situation public/lufthavn
STYLE_V="$STYLE_V" APP_V="$APP_V" node scripts/build-pages.mjs
node scripts/test-rules.mjs
node scripts/test-pages.mjs
