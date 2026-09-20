import Link from "next/link";
import { LEAGUE_LOGO } from "./ui";

const links = [
  { href: "/", label: "Home" },
  { href: "/table", label: "Table" },
  { href: "/fixtures", label: "Matches" },
  { href: "/teams", label: "Teams" },
  { href: "/admin", label: "Admin" },
];

export default function NavBar() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-border bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft ring-1 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LEAGUE_LOGO} alt="Vipers League" className="h-full w-full object-cover" />
            </span>
            <span className="text-neon">VIPERS</span>
            <span className="hidden text-white/70 text-sm font-body font-medium sm:inline">Fantasy League</span>
          </Link>
          <nav className="hidden gap-6 font-display text-sm font-semibold uppercase tracking-wide sm:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-white/80 transition hover:text-neon">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-border bg-ink-soft/95 backdrop-blur sm:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex-1 py-3 text-center font-display text-xs font-semibold uppercase tracking-wide text-white/70 active:text-neon"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
