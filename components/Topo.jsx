import Link from "next/link";

import Icone from "./Icone";

export default function Topo({ titulo, voltar }) {
  return (
    <header className="topo">
      {voltar ? (
        <Link href={voltar} className="marca" aria-label="Voltar">
          <Icone nome="voltar" tamanho={26} />
        </Link>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="marca-topo" src="/icone-192.png" alt="" width={48} height={48} />
      )}
      <h1>{titulo}</h1>
    </header>
  );
}
