import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Finmig — Gerador de posts LinkedIn",
  description: "Gerador de posts LinkedIn com curadoria de estilo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <AuthGate>
          <NavBar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthGate>
      </body>
    </html>
  );
}
