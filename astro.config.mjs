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
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
