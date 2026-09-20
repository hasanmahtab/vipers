"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEAGUE_LOGO } from "./ui";

const links = [
  { href: "/", label: "Home" },
  { href: "/table", label: "Table" },
  { href: "/fixtures", label: "Matches" },
  { href: "/teams", label: "Teams" },
  { href: "/admin", label: "Admin" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-border bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft shadow-sm ring-2 ring-[#ffffff] ring-offset-1 ring-offset-neon/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LEAGUE_LOGO} alt="Vipers League" className="h-full w-full object-cover" />
            </span>
            <span className="bg-gradient-to-r from-neon to-[#0453e0] bg-clip-text text-transparent">
              VIPERS
            </span>
            <span className="hidden text-white/70 text-sm font-body font-medium sm:inline">Fantasy League</span>
          </Link>
          <nav className="hidden gap-6 font-display text-sm font-semibold uppercase tracking-wide sm:flex">
            {links.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative py-1 transition hover:text-neon ${
                    active ? "text-neon" : "text-white/80"
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-gradient-to-r from-neon to-[#0453e0]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-border bg-ink-soft/90 backdrop-blur-md sm:hidden">
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex-1 py-3 text-center font-display text-xs font-semibold uppercase tracking-wide transition ${
                active ? "text-neon" : "text-white/70"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
