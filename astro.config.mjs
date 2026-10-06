import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT TARGET
// Live custom domain: https://www.quidedge.com  (served at the root, so base = '/')
// The domain is pinned by public/CNAME. See DEPLOYMENT.md for the full go-live
// steps (GitHub Pages, DNS, replacing the old site).
// ─────────────────────────────────────────────────────────────────────────────
export default defineConfig({
  site: 'https://www.quidedge.com',
  base: '/',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // Keep error documents out of the XML sitemap. Search engines should only
      // receive canonical, indexable marketing/content URLs here.
      filter: (page) => !page.endsWith('/404'),
      changefreq: 'weekly',
      priority: 0.7,
      // Do not stamp every URL with the build time. A false `lastmod` signal is
      // less useful than omitting it; content-specific dates can be added later
      // when they reflect a real, significant page update.
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
