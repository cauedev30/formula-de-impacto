const NOME = "entrevista-campo";
const VERSAO = 1;

let conexao;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME, VERSAO);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains("entrevistas")) {
        db.createObjectStore("entrevistas", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("audios")) {
        db.createObjectStore("audios", { keyPath: "id" }).createIndex("entrevistaId", "entrevistaId");
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
  return conexao;
}

async function transacao(stores, modo, tarefa) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, modo);
    const pedido = tarefa(...stores.map((nome) => tx.objectStore(nome)));

    // O valor do pedido é lido em `onsuccess`, que sempre precede `oncomplete`. Ler dentro
    // do `oncomplete` devolvia o próprio IDBRequest, e quem esperava o dado ficava preso.
    let valor;
    if (pedido instanceof IDBRequest) pedido.onsuccess = () => (valor = pedido.result);

    // Só `oncomplete` garante gravação em disco; `onsuccess` do pedido ainda pode abortar.
    tx.oncomplete = () => resolve(valor);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const novoId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const salvarEntrevista = (entrevista) =>
  transacao(["entrevistas"], "readwrite", (store) => store.put(entrevista));

export const obterEntrevista = (id) => transacao(["entrevistas"], "readonly", (store) => store.get(id));

export const listarEntrevistas = () =>
  transacao(["entrevistas"], "readonly", (store) => store.getAll()).then((lista) =>
    (lista ?? []).sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm)),
  );

export const salvarAudio = (audio) => transacao(["audios"], "readwrite", (store) => store.put(audio));

export const obterAudio = (id) => transacao(["audios"], "readonly", (store) => store.get(id));

export const audiosDaEntrevista = (entrevistaId) =>
  transacao(["audios"], "readonly", (store) => store.index("entrevistaId").getAll(entrevistaId));

export const apagarEntrevista = (id) =>
  transacao(["entrevistas", "audios"], "readwrite", (entrevistas, audios) => {
    entrevistas.delete(id);
    const busca = audios.index("entrevistaId").getAllKeys(id);
    busca.onsuccess = () => busca.result.forEach((chave) => audios.delete(chave));
  });
