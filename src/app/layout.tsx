import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AgroAppProvider } from "@/context/AgroAppContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroZap",
  description: "Gestão rural simples e organizada.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AgroAppProvider>
          <AppShell>{children}</AppShell>
        </AgroAppProvider>
      </body>
    </html>
  );
}
