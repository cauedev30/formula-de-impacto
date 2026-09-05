#!/usr/bin/env bash
# Renderiza o vídeo inteiro com cada voz, para comparar de ouvido. Sequencial de propósito:
# as narrações compartilham public/narracao/, então rodar em paralelo misturaria as vozes.
set -euo pipefail
cd "$(dirname "$0")/.."

SHELL_BIN=/home/dvdev/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
DESTINO=/home/dvdev/Downloads/formula-de-impacto-video
mkdir -p "$DESTINO"

vozes=(
  "George:JBFqnCBsd6RMkjVDRZzb"
  "Brian:nPczCjzI2devNBz1zQrb"
  "Sarah:EXAVITQu4vr4xnSDxMaL"
)

for par in "${vozes[@]}"; do
  nome=${par%%:*}
  id=${par##*:}
  echo "=== $nome ==="
  MOTOR=eleven VOZ_ELEVEN="$id" node scripts/narrar.mjs
  npx remotion render src/index.ts Apresentacao "out/voz-$nome.mp4" \
    --codec h264 --crf 17 --browser-executable="$SHELL_BIN" --concurrency 6
  cp "out/voz-$nome.mp4" "$DESTINO/voz-$nome.mp4"
  echo "--> $DESTINO/voz-$nome.mp4"
done

cp out/formula-de-impacto-final.mp4 "$DESTINO/voz-Will.mp4"
echo "todas prontas"
