import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AgroAppProvider } from "@/context/AgroAppContext";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AgroZap",
    template: "%s | AgroZap",
  },
  description: "O caderno inteligente do produtor.",
  icons: {
    icon: "/brand/agrozap-symbol-64.png",
    apple: "/brand/agrozap-symbol-192.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={manrope.variable}>
        <AgroAppProvider>
          <AppShell>{children}</AppShell>
        </AgroAppProvider>
      </body>
    </html>
  );
}
