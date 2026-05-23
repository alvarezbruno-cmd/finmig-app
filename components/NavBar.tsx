"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Gerar" },
  { href: "/library", label: "Referências" },
  { href: "/history", label: "Histórico" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Finmig<span className="text-[var(--color-accent)]">.</span>
        </Link>
        <div className="flex gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "rounded-md px-3 py-1.5 text-sm transition " +
                  (active
                    ? "bg-[var(--color-surface-2)] text-white"
                    : "text-[var(--color-text-dim)] hover:text-white")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
