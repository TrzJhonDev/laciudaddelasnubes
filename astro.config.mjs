// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// TODO(F7): reemplazar por el dominio definitivo.
const SITE = process.env.SITE_URL ?? 'https://laciudaddelasnubes.pages.dev';

export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  // Genera texto.html (no texto/index.html) para que Cloudflare Pages sirva /texto sin redirigir a /texto/.
  build: { format: 'file' },
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Solo en desarrollo: build.protomaps.com no envía CORS, así que el mapa base se pide
      // a través del servidor de Vite. En producción se usará el recorte alojado en R2 (F2.1).
      proxy: {
        '/remote/protomaps': {
          target: 'https://build.protomaps.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/remote\/protomaps/, ''),
        },
      },
    },
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: ['300 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
});
