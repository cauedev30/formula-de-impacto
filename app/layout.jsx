import { IBM_Plex_Sans } from "next/font/google";

import RegistrarServiceWorker from "@/components/RegistrarServiceWorker";
import Tranca from "@/components/Tranca";
import "./globals.css";

const fonte = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--fonte",
  display: "swap",
});

export const metadata = {
  title: "CAIXA Fórmula de Impacto",
  description: "Dados, pessoas e sustentabilidade: diagnóstico territorial em campo",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#0054a2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={fonte.variable}>
      <body>
        <RegistrarServiceWorker />
        <Tranca>{children}</Tranca>
      </body>
    </html>
  );
}
