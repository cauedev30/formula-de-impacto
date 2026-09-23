"use client";

import { useEffect } from "react";

import { aoVoltarOnline, processarFila } from "@/lib/transcrever.mjs";

// Montado no layout, fora da Tranca: a fila anda em qualquer tela, inclusive antes do PIN.
export default function TarefasDeFundo() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
    processarFila().catch(() => {});
    return aoVoltarOnline(() => processarFila().catch(() => {}));
  }, []);
  return null;
}
