# Vídeo de apresentação

Vídeo narrado de ~64 s apresentando o Fórmula de Impacto. Projeto Remotion separado do
aplicativo: as dependências de render não entram nas do app, que precisa continuar sendo um
export estático leve.

```bash
npm install
npm run narrar    # gera a narração e mede a duração de cada trecho
npm run render    # 1920x1080
npm run render:4k # 3840x2160, quadros PNG, CRF 12
```

O render precisa de um Chromium. Se o download automático falhar:

```bash
npx remotion render ... --browser-executable=<caminho do chrome-headless-shell>
```

## Como as cenas se organizam

O tempo sai do áudio, não de números escolhidos à mão. `scripts/narrar.mjs` mede a duração de
cada trecho de narração e escreve `src/narracao.json`; `src/roteiro.ts` deriva dali a duração
de cada cena, e cada cena calcula seus cortes internos como fração da própria duração.

Trocar de voz muda o ritmo da fala e o vídeo se reorganiza sozinho. Antes disso, cada troca
obrigava a recalibrar dezenas de números de quadro à mão — e cortava no meio da frase quando
alguém esquecia um.

## Narração

Três motores, escolhidos por variável. Medido com o mesmo texto:

| Motor | Pausas na frase | Faixa de tom |
|---|---|---|
| `piper` | 12 | 32% |
| `kokoro` | 9 | 71% |
| `eleven` | 1 | 61% |

Contar pausa foi o que separou os motores: Piper e Kokoro picotam a frase em pedaços, e é
isso que soa robótico. O ElevenLabs fraseia inteiro.

```bash
MOTOR=eleven VOZ_ELEVEN=bIHbv24MWmeRgasZH58o npm run narrar   # Will
MOTOR=kokoro VOZ_KOKORO=pm_santa npm run narrar                # local, sem chave
MOTOR=piper VOZ=cadu npm run narrar                            # local, mais leve
```

O ElevenLabs lê a chave de `~/.elevenlabs/key`. Cada voz guarda sua narração em
`.narracoes/`, então re-renderizar não gasta cota. `REFAZER=1` força gerar de novo.

## Imagens

As telas do tablet são capturas reais da produção, não mockup:

```bash
DENSIDADE=2 node ../scripts/capturar-telas.mjs   # grava em public/telas/
python3 scripts/dimensoes-das-telas.py           # atualiza src/telas.json
```

Para 4K a densidade 2 é obrigatória: com as capturas a 1x o vídeo só amplia pixel borrado.

A folha do logo é uma camada separada, animada com pivô no talo:

```bash
python3 scripts/extrair-folha.py
```
