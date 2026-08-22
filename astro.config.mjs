import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://lowernotleyhallfarm.com/',
  integrations: [
    react(), 
    mdx(), 
    sitemap(), 
    icon()
  ],
  output: 'static',
  trailingSlash: 'always',
  vite: {
  optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', '@tanstack/react-table'],
    },
  },
  image: {
    // Enable built-in image optimization
    domains: ['lowernotleyhallfarm.com', 'www.lowernotleyhallfarm.com', 'lowernotleyhallfarm.netlify.app', 'www.lowernotleyhallfarm.netlify.app' ],
  },
});