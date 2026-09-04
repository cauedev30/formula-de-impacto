// Traço 2.5 e ponta arredondada em todos: um só peso de ícone em todo o app.
const TRACOS = {
  voltar: "M15 5 L8 12 L15 19",
  feito: "M5 12.5 L10 17.5 L19 7",
  microfone: "M12 4 v8 M12 4 a2.6 2.6 0 0 1 2.6 2.6 v3.4 a2.6 2.6 0 0 1 -5.2 0 V6.6 A2.6 2.6 0 0 1 12 4 Z",
  parar: "M8 8 h8 v8 h-8 Z",
  imprimir: "M7 9 V4 h10 v5 M7 17 H5 V9 h14 v8 h-2 M7 14 h10 v6 H7 Z",
  apagar: "M5 7 h14 M10 7 V4.6 h4 V7 M7 7 l1 13 h8 l1 -13",
  baixar: "M12 4 v11 M7.5 11 L12 15.5 L16.5 11 M5 19.5 h14",
};

export default function Icone({ nome, tamanho = 22, className = "icone" }) {
  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACOS[nome]} />
    </svg>
  );
}
