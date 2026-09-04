# Formulário dinâmico de entrevista de campo

## Intenção

O entrevistador escolhe quem está na frente dele — prefeito, secretário, agricultor, quilombola ou
assentado, cruzado com gênero e faixa etária — e o tablet monta na hora um formulário só com as
perguntas que fazem sentido para aquele agente. Ele marca as respostas objetivas com o polegar e grava
em áudio o que for aberto demais para digitar. Tudo funciona sem sinal de celular; no fim do dia ele
exporta as entrevistas e gera a ficha de cada entrevistado e o consolidado que alimenta o workshop.

## Critério de aceite

```bash
npm run test
```

Esperado: todos os casos passam, incluindo os três que sustentam a regra de montagem —

1. Perfil `{categoria: "agricultor", faixa: "jovem"}` inclui `jovem_permanencia`.
2. Perfil `{categoria: "poder_publico", cargo: "prefeito"}` não inclui `jovem_permanencia`.
3. Pergunta condicional `escoamento_obstaculo` só aparece depois de `escoamento` responder algo
   diferente de `Sim, toda`.

```bash
npm run build
```

Esperado: build conclui e `out/index.html` existe (export estático pronto para o Cloudflare Pages).

Verificação manual, no tablet, com o aparelho em modo avião:

- abrir a URL já visitada uma vez: o formulário carrega e aceita resposta;
- gravar um áudio, fechar a aba e reabrir: o áudio continua anexado à resposta;
- exportar o ZIP e rodar `vox transcribe` em um `.ogg` de dentro dele: sai texto em pt-BR.

## Fora de escopo

- Backend, VPS, banco na nuvem e sincronização entre aparelhos. Um entrevistador, um tablet.
- Transcrição dentro do app. O áudio é gravado e transcrito depois, no PC, pelo `vox`.
- Login, contas e permissões.
- Edição das perguntas pela interface. O banco é um JSON versionado no repositório.
