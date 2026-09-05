# Validação robusta do app de entrevista de campo

## Intenção

O app já tinha teste de unidade do motor de montagem e bateria de usabilidade cross-device,
mas nenhum dos dois toca os caminhos que só existem no navegador: gravar áudio, transcrever,
enfileirar a transcrição sem sinal, abrir sem rede pelo service worker, recuperar o banco
depois de perder um store. Esta validação cobre esses caminhos em três camadas — unidade,
bateria funcional em Chrome real com microfone falso, e agente da TestSprite na nuvem.

## Critério de aceite

```bash
npm test
# tests 31 · pass 31 · fail 0

# Chrome com microfone falso alimentado por um .wav de fala em português:
#   chrome --headless=new --remote-debugging-port=9223 \
#     --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
#     --use-file-for-fake-audio-capture=<arquivo.wav>
CDP_PORT=9223 npm run validar
# 40 verificações · 40 passaram · 0 falharam

npm run test:ui
# 9 aparelhos · 5 telas cada · nenhum problema de usabilidade encontrado

testsprite testlist run <id> --wait
# 10 casos · 10 passaram

npm run comparar
# 12 falas × 3 vozes, erro medido contra o texto que gerou o áudio
```

## Fora de escopo

- Criptografar o IndexedDB. A entrevista guarda nome, comunidade e renda de quilombolas e
  assentados, e a tranca por código não protege nada disso: quem tem o aparelho lê o banco
  pelo devtools. O conserto é derivar chave do código com PBKDF2 e cifrar com AES-GCM, e
  isso é trabalho próprio, não um item de bateria de teste.
- Teste em Safari e em aparelho físico. A bateria mede intenção de layout que o Safari
  respeita e o Chromium esconde, mas não substitui abrir no iPhone.
- Carga e concorrência. Um operador, um aparelho.
- Robustez a ruído de campo. `npm run comparar` usa voz sintética, que é limpa: mede o
  caminho e o vocabulário, não vento, distância do microfone nem sotaque regional.
