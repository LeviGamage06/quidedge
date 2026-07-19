import { getCollection } from "astro:content";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET(context) {
  const site = context.site ? context.site.href : "https://www.quidedge.com/";
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const items = posts
    .map(
      (p) =>
        `\n    <item>` +
        `\n      <title>${esc(p.data.title)}</title>` +
        `\n      <link>${site}blog/${p.id}</link>` +
        `\n      <guid>${site}blog/${p.id}</guid>` +
        `\n      <category>${esc(p.data.category)}</category>` +
        `\n      <pubDate>${p.data.pubDate.toUTCString()}</pubDate>` +
        `\n      <description>${esc(p.data.description)}</description>` +
        `\n    </item>`
    )
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `\n<rss version="2.0"><channel>` +
    `\n  <title>QuidEdge Blog</title>` +
    `\n  <link>${site}blog</link>` +
    `\n  <description>Insights on personal branding, viral engineering, and content strategy.</description>` +
    `\n  <language>en</language>` +
    items +
    `\n</channel></rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
