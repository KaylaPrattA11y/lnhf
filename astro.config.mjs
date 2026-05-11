import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://lowernotleyhallfarm.com',
  integrations: [
    react(),
    sitemap(),
  ],
  output: 'static',
  image: {
    // Enable built-in image optimization
    domains: ['lowernotleyhallfarm.com'],
  },
});
