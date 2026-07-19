// ── QuidEdge social profiles ─────────────────────────────────────────────────
// Paste your real profile URLs here. Any left blank simply won't render — so
// nothing is ever broken. These also feed the site's Organization structured
// data (sameAs), which strengthens how Google recognises your brand.
export interface Social { platform: string; href: string; }

export const socials: Social[] = [
  { platform: "Instagram", href: "" }, // e.g. https://instagram.com/quidedge
  { platform: "YouTube",   href: "" }, // e.g. https://youtube.com/@quidedge
  { platform: "TikTok",    href: "" }, // e.g. https://tiktok.com/@quidedge
  { platform: "LinkedIn",  href: "" }, // e.g. https://linkedin.com/company/quidedge
];

export const activeSocials = socials.filter((s) => s.href.trim().length > 0);
