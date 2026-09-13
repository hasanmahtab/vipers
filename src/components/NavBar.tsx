import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/table", label: "Table" },
  { href: "/teams", label: "Teams" },
  { href: "/admin", label: "Admin" },
];

export default function NavBar() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-border bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="text-neon drop-shadow-[0_0_6px_rgba(57,255,20,0.6)]">VIPERS</span>
            <span className="text-white/70 text-sm font-body font-medium">Fantasy League</span>
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
