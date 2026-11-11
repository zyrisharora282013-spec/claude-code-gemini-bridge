import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pages = ['index', 'install', 'security', 'faq', 'changelog', 'download'];
// Set SITE_URL at build time (e.g. in the Vercel project settings) to your real domain.
// BASE_PATH is '/' on Vercel/custom domains and '/<repo>/' on GitHub Pages.
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const SITE_URL = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');

// Replaces <!--include:name--> with partials/name.html and fills %SITE_URL% / %PAGE_URL% at build time.
function htmlIncludes() {
  return {
    name: 'html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const path = ctx.path === '/' || ctx.path === '/index.html' ? '/' : ctx.path;
        const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
        return html
          .replace('<!--include:head-common-->', '<!--include:head-common-->\n  <meta property="og:title" content="' + title + '" />\n  <meta property="og:description" content="' + desc + '" />')
          .replace(/<!--include:([\w-]+)-->/g, (_, name) =>
            readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8')
          )
          .replace(/(href|src)="\/(?!\/|src\/)/g, '$1="' + BASE)
          .replaceAll('%SITE_URL%', SITE_URL)
          .replaceAll('%PAGE_URL%', SITE_URL + path);
      },
    },
  };
}

function seoFiles() {
  return {
    name: 'seo-files',
    generateBundle() {
      const urls = pages.map((p) => (p === 'index' ? '/' : `/${p}.html`));
      const sitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n') +
        '\n</urlset>\n';
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [htmlIncludes(), seoFiles()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
