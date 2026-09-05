# Vídeo de apresentação do Fórmula de Impacto

## Intenção

Um vídeo narrado de cerca de 90 segundos apresentando o Fórmula de Impacto como instrumento
da Caixa para diagnóstico territorial e apoio à sustentabilidade de agricultores familiares,
quilombolas e assentados. Mostra a dor que existe hoje, o que o instrumento resolve, como
funciona em campo e por que funciona sem sinal.

Público: quem decide dentro da instituição e os parceiros que vão operar o método. Vai ser
apresentado pela própria Caixa — a autorização de uso da marca vem da gestão de
desenvolvimento e sustentabilidade, que encomendou o material.

## Critério de aceite

```bash
cd video && npx remotion render src/index.ts Apresentacao out/formula-de-impacto.mp4
# arquivo mp4, 1920x1080, entre 85 e 100 segundos, com narração audível em pt-BR

ffprobe -v error -show_entries format=duration -show_entries stream=width,height,codec_name out/formula-de-impacto.mp4
# width=1920 height=1080 codec_name=h264 + faixa de áudio aac
```

Verificação visual obrigatória: extrair quadros nos pontos de virada de cada cena e olhar
cada um antes de entregar. Render sem inspeção não conta como pronto.

## Fora de escopo

- Locução humana. A narração é sintética (Piper, voz pt-BR), o que é bom o bastante para
  apresentar e evita depender de estúdio.
- Legendas embutidas. Entram depois se o vídeo for para rede social sem som.
- Versão vertical 9:16. Este é para tela e projetor.
- Números de resultado de campo. O instrumento ainda não rodou um ciclo completo de
  diagnóstico, e prometer efeito que não foi medido tira a credibilidade do resto.
