import Link from "next/link";
import { Position, POSITION_LABEL } from "@/lib/scoring";

export function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl border border-ink-border bg-ink-card p-4 shadow-lg shadow-black/30 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <h2
      className={`mb-3 font-display text-lg font-bold uppercase tracking-wide ${
        accent ? "text-neon" : "text-white"
      }`}
    >
      {children}
    </h2>
  );
}

const POSITION_COLORS: Record<Position, string> = {
  GK: "bg-blood/20 text-blood border-blood/40",
  DEF: "bg-neon/10 text-neon border-neon/40",
  MID: "bg-sky-500/10 text-sky-300 border-sky-500/40",
  FWD: "bg-yellow-500/10 text-yellow-300 border-yellow-500/40",
};

export function PositionBadge({ position }: { position: Position }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wide ${POSITION_COLORS[position]}`}
      title={POSITION_LABEL[position]}
    >
      {position}
    </span>
  );
}

export function TeamDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

const TEAM_LOGOS: Record<string, string> = {
  "Blackouts FC": "/logos/blackouts-fc.jpg",
  "Darkstar FC": "/logos/darkstar-fc.jpg",
  Showstoppers: "/logos/showstoppers.jpg",
  "Goli Underdogs": "/logos/goli-underdogs.jpg",
};

export const LEAGUE_LOGO = "/logos/league.jpg";

export function getTeamLogo(name: string): string | undefined {
  return TEAM_LOGOS[name];
}

const BADGE_SIZES = {
  xs: "h-4 w-4",
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

/** A team's crest if we have one on file, falling back to their color dot. */
export function TeamBadge({
  name,
  color,
  size = "xs",
}: {
  name: string;
  color: string;
  size?: keyof typeof BADGE_SIZES;
}) {
  const logo = getTeamLogo(name);
  if (!logo) return <TeamDot color={color} />;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${BADGE_SIZES[size]}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={`${name} crest`} className="h-full w-full object-cover" />
    </span>
  );
}

export function PlayerLink({
  id,
  name,
  className = "",
}: {
  id: number;
  name: string;
  className?: string;
}) {
  return (
    <Link href={`/players/${id}`} className={`transition hover:text-neon hover:underline ${className}`}>
      {name}
    </Link>
  );
}

export function TeamLink({
  id,
  name,
  color,
  className = "",
  logoSize = "xs",
}: {
  id: number;
  name: string;
  color: string;
  className?: string;
  logoSize?: "xs" | "sm" | "md" | "lg";
}) {
  return (
    <Link href={`/teams/${id}`} className={`inline-flex items-center gap-1.5 transition hover:text-neon ${className}`}>
      <TeamBadge name={name} color={color} size={logoSize} />
      {name}
    </Link>
  );
}

export function StatPill({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "neon" | "blood" }) {
  const toneClasses =
    tone === "neon"
      ? "text-neon"
      : tone === "blood"
      ? "text-blood"
      : "text-white";
  return (
    <div className="flex flex-col items-center rounded-lg border border-ink-border bg-ink-soft px-3 py-2 min-w-[72px]">
      <span className={`font-display text-xl font-bold ${toneClasses}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
    </div>
  );
}

export function formatMoney(value: number): string {
  return `£${value.toFixed(1)}M`;
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}
