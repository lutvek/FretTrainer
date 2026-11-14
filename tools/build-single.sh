#!/bin/sh
# Bygger hela appen till en enda fristående HTML-fil (för delning/publicering som en sida).
# Användning: tools/build-single.sh [utfil]   (kräver Node/npx)
set -e
cd "$(dirname "$0")/.."
OUT="${1:-dist/frettrainer.html}"
mkdir -p "$(dirname "$OUT")"
JS=$(npx --yes esbuild@0.24.0 js/app.js --bundle --format=iife --minify --charset=utf8)
{
  echo '<title>FretTrainer</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo '<style>'
  cat css/style.css
  # En-sides-varianten ligger i en ram som redan hanterar säkra ytor upptill/nedtill.
  cat <<'CSS'
:root { color-scheme: dark; }
html, body { height: 100%; }
.screen {
  min-height: 100%;
  padding-block: 12px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
#play { height: 100%; }
CSS
  echo '</style>'
  sed -n '/<body>/,/<script/p' index.html | sed '1d;$d'
  echo '<script>'
  printf '%s\n' "$JS"
  echo '</script>'
} > "$OUT"
echo "Skrev $OUT"
