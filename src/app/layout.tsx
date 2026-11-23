import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import { NovaVersao } from "@/components/nova-versao";
import "./globals.css";

const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finbast",
  description: "Sistema financeiro para empresário e contador — Finbast.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // CSP com nonce (src/proxy.ts) só funciona em renderização por requisição: página
  // pré-renderizada no build não recebe o nonce e teria os scripts bloqueados.
  await connection();
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <NovaVersao />
      </body>
    </html>
  );
}
