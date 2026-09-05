"""Separa a folha do logo para ela poder balançar sozinha no vídeo.

Recorte por cor não bastava: o miolo da folha tem uma nervura azul que a máscara de verde
não pega, e o preenchimento vazava. Aqui o contorno verde é dilatado até fechar, o fundo é
alcançado a partir da borda da imagem, e tudo que o fundo não alcança é folha.

    python3 video/scripts/extrair-folha.py
"""

from collections import deque

import numpy as np
from PIL import Image

ENTRADA = "video/public/logo-limpo.png"
SAIDA = "video/public/folha.png"


def espalhar(mascara, vezes):
    fora = mascara.copy()
    for _ in range(vezes):
        fora[1:, :] |= fora[:-1, :]
        fora[:-1, :] |= fora[1:, :]
        fora[:, 1:] |= fora[:, :-1]
        fora[:, :-1] |= fora[:, 1:]
    return fora


def main():
    im = Image.open(ENTRADA).convert("RGBA")
    a = np.array(im).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    verde = (al > 40) & (g > r + 18) & (g > b + 30) & (g > 60)
    verde[600:, :] = False  # o broto do rodapé não balança

    fechada = espalhar(verde, 5)
    h, w = fechada.shape
    fundo = np.zeros_like(fechada)
    fila = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not fechada[y, x]:
                fila.append((y, x))
                fundo[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not fechada[y, x]:
                fila.append((y, x))
                fundo[y, x] = True
    while fila:
        y, x = fila.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not fundo[ny, nx] and not fechada[ny, nx]:
                fundo[ny, nx] = True
                fila.append((ny, nx))

    folha = ~fundo
    ys, xs = np.nonzero(folha)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

    capa = np.array(im).copy()
    capa[..., 3] = np.where(folha, capa[..., 3], 0)
    margem = 4
    Image.fromarray(capa[max(0, y0 - margem) : y1 + margem, max(0, x0 - margem) : x1 + margem]).save(SAIDA)

    W, H = im.size
    print(f"{SAIDA} salvo")
    print("números para FOLHA em src/Marca.tsx:")
    print(f"  esquerda {(x0 - margem) / W:.4f} · topo {(y0 - margem) / H:.4f} · largura {(x1 - x0 + 2 * margem) / W:.4f}")


if __name__ == "__main__":
    main()
