"""Escreve src/telas.json com a dimensão real de cada captura.

O componente Tablet calcula a rolagem a partir daí. Antes as alturas viviam soltas nas
cenas, e recapturar em outra densidade quebrava tudo em silêncio.

    python3 video/scripts/dimensoes-das-telas.py
"""

import glob
import json
import os

from PIL import Image

telas = {}
for arquivo in sorted(glob.glob("video/public/telas/*.png")):
    largura, altura = Image.open(arquivo).size
    telas[f"telas/{os.path.basename(arquivo)}"] = {"largura": largura, "altura": altura}

with open("video/src/telas.json", "w") as saida:
    saida.write(json.dumps(telas, indent=2) + "\n")
print(f"{len(telas)} telas em video/src/telas.json")
