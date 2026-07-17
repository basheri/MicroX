// Global site navigation (RTL). Makes the top-level areas reachable from every page.
// Server component — plain links, no client state.

import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/programs", label: "البرامج" },
  { href: "/dashboard", label: "المؤشرات" },
  { href: "/settings", label: "الإعدادات" },
];

export function SiteNav() {
  return (
    <nav
      aria-label="التنقّل الرئيسي"
      style={{
        borderBottom: "1px solid #e5e7eb",
        padding: "0.75rem 1rem",
        display: "flex",
        gap: "1.25rem",
        alignItems: "center",
      }}
    >
      <strong style={{ marginInlineEnd: "auto" }}>MicroX</strong>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
