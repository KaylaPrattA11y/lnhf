import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://lowernotleyhallfarm.netlify.app/',
  integrations: [
    react(),
    mdx(),
    sitemap(),
  ],
  output: 'static',
  trailingSlash: 'always',
  vite: {
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
  },
  image: {
    // Enable built-in image optimization
    domains: ['lowernotleyhallfarm.com', 'www.lowernotleyhallfarm.com', 'lowernotleyhallfarm.netlify.app', 'www.lowernotleyhallfarm.netlify.app' ],
  },
});
