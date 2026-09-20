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
      className={`rounded-xl border border-ink-border bg-ink-card p-4 shadow-lg shadow-[#37003c]/[0.07] ${className}`}
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
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft shadow-sm ring-2 ring-[#ffffff] ring-offset-1 ring-offset-neon/10 transition hover:scale-105 ${BADGE_SIZES[size]}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={`${name} crest`} className="h-full w-full object-cover" />
    </span>
  );
}

const AVATAR_SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-16 w-16 text-lg",
} as const;

// Static name -> photo lookup, same pattern as TEAM_LOGOS: ships with the
// code so player photos show up with no database write needed. A player's
// own photo_url (once the admin UI supports uploading one) always wins.
const PLAYER_PHOTOS: Record<string, string> = {
  "Aafeef Kabir": "/players/aafeef-kabir.jpg",
  "Adeeb Ahmed": "/players/adeeb-ahmed.jpg",
  "Aiman Nawar Chowdhury": "/players/aiman-nawar-chowdhury.jpg",
  "Arafatul Mamur": "/players/arafatul-mamur.jpg",
  "Azmi Hoque": "/players/azmi-hoque.jpg",
  "Faiad Rehman": "/players/faiad-rehman.jpg",
  "Fairooz Abir": "/players/fairooz-abir.jpg",
  "Farhan Labib": "/players/farhan-labib.jpg",
  "Hasan Mahtab": "/players/hasan-mahtab.jpg",
  "Hasnan Siddique Sunve": "/players/hasnan-siddique-sunve.jpg",
  "Hussain Yeasin": "/players/hussain-yeasin.jpg",
  "Ishmam Rahman": "/players/ishmam-rahman.jpg",
  "Jawad Anis": "/players/jawad-anis.jpg",
  "K M Chisty": "/players/k-m-chisty.jpg",
  "Masrur Rahman": "/players/masrur-rahman.jpg",
  "Mirza Mohammed": "/players/mirza-mohammed.jpg",
  "Mubashir Rahman": "/players/mubashir-rahman.jpg",
  "Munem Morshed": "/players/munem-morshed.jpg",
  "Nabil Shahriar": "/players/nabil-shahriar.jpg",
  "Navid Rahman": "/players/navid-rahman.jpg",
  "Md Rafiu Hossain": "/players/md-rafiu-hossain.jpg",
  "Rahmat Ullah": "/players/rahmat-ullah.jpg",
  "Rayhan Hussain": "/players/rayhan-hussain.jpg",
  "Riyad Zaman": "/players/riyad-zaman.jpg",
  "Rishik Roy": "/players/rishik-roy.jpg",
  "Sabit Khan": "/players/sabit-khan.jpg",
  "Rizvi Ibrahim": "/players/rizvi-ibrahim.jpg",
  "Shadman Sakib": "/players/shadman-sakib.jpg",
  "Samin Haque": "/players/samin-haque.jpg",
  "Shahriar Anwar Khan": "/players/shahriar-anwar-khan.jpg",
  "Tahsin Islam": "/players/tahsin-islam.jpg",
  "Taqi Rahman": "/players/taqi-rahman.jpg",
};

export function getPlayerPhoto(name: string): string | undefined {
  return PLAYER_PHOTOS[name];
}

/** A player's photo if one's on file (their own, or a shipped default by name), falling back to initials. */
export function PlayerAvatar({
  name,
  photoUrl,
  size = "sm",
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const sizeClasses = AVATAR_SIZES[size];
  const resolvedPhoto = photoUrl || getPlayerPhoto(name);
  if (resolvedPhoto) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft shadow-sm ring-2 ring-[#ffffff] ring-offset-1 ring-offset-neon/10 transition hover:scale-105 ${sizeClasses}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolvedPhoto} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon to-neon-glow font-display font-bold text-[#ffffff] shadow-sm ring-2 ring-[#ffffff] ring-offset-1 ring-offset-neon/10 ${sizeClasses}`}
    >
      {initials}
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

const MEDAL_STYLES = [
  "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-sm shadow-yellow-500/40",
  "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-sm shadow-gray-400/40",
  "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-50 shadow-sm shadow-amber-600/40",
];

/** Rank 1-3 get a medal-colored badge; everyone else gets a plain number. */
export function RankBadge({ rank, size = "w-5 h-5 text-[11px]" }: { rank: number; size?: string }) {
  const medal = MEDAL_STYLES[rank - 1];
  if (medal) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${size} ${medal}`}>
        {rank}
      </span>
    );
  }
  return <span className={`shrink-0 text-center font-display text-sm text-white/40 ${size.split(" ")[0]}`}>{rank}</span>;
}

export function StatPill({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "neon" | "blood" }) {
  const containerClasses =
    tone === "neon"
      ? "border-neon/25 bg-gradient-to-br from-neon/10 to-[#0453e0]/10 shadow-sm shadow-neon/10"
      : tone === "blood"
      ? "border-blood/25 bg-blood/5"
      : "border-ink-border bg-ink-soft";
  const toneClasses =
    tone === "neon"
      ? "text-neon"
      : tone === "blood"
      ? "text-blood"
      : "text-white";
  return (
    <div className={`flex min-w-[72px] flex-col items-center rounded-lg border px-3 py-2 transition hover:-translate-y-0.5 ${containerClasses}`}>
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
