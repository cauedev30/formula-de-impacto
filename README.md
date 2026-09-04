# CAIXA Fórmula de Impacto

Formulário de entrevista de campo para diagnóstico territorial. O entrevistador escolhe quem está na
frente dele e o aparelho monta na hora só as perguntas daquele agente — prefeito e secretários, ou
agricultor, quilombola e assentado cruzados com gênero e faixa etária.

Funciona sem sinal de celular: é onde a entrevista acontece.

```
$ npm test
# tests 23
# pass 23
# fail 0

$ npm run test:ui
7 aparelhos · 5 telas cada · telas em telas/
nenhum problema de usabilidade encontrado
```

## Como funciona

| Peça | Arquivo |
|---|---|
| Banco de perguntas com tags de perfil | `data/perguntas.json` |
| Montagem do formulário a partir do perfil | `lib/montar-formulario.mjs` |
| Persistência local (IndexedDB) | `lib/db.mjs` |
| Gravação de áudio e transcrição no aparelho | `components/GravadorAudio.jsx`, `lib/transcrever.mjs` |
| Exportação em ZIP e consolidado | `lib/exportar.mjs` |
| Funcionamento offline | `public/sw.js` |

Uma pergunta pertence a um perfil por tag, não por formulário separado:

```json
{
  "id": "jovem_permanencia",
  "texto": "Depois de terminar o ensino médio, você pretende continuar morando na zona rural?",
  "quando": { "faixa": ["jovem"] }
}
```

São 17 perfis possíveis e cada um recebe de 20 a 25 perguntas — um teste prende esse intervalo.

## Transcrição

O áudio é gravado sempre e fica salvo no aparelho. O Whisper roda dentro do navegador
(`@huggingface/transformers`): o modelo baixa uma vez com internet e depois transcreve offline.

Para trocar o modelo num aparelho lento, no console do navegador:

```js
localStorage.setItem("modelo-transcricao", "onnx-community/whisper-tiny");
```

O ZIP exportado traz os `.ogg` originais, então dá para refazer a transcrição no computador com um
modelo maior — o `LEIAME.txt` de dentro do ZIP tem o comando pronto.

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # motor de montagem e exportação
npm run build        # export estático em out/
npm run servir       # serve out/ como o Cloudflare Pages serve
npm run test:ui      # usabilidade em 7 aparelhos (precisa de npm run servir e Chrome com CDP)
```

## Publicação

```bash
npx wrangler login
npm run deploy
```
