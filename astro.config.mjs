import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import tina from '@tinacms/astro/integration';
import { tinaAdminDevRedirect } from '@tinacms/astro/vite';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://lowernotleyhallfarm.com/',
  integrations: [
    tina(),
    react(), 
    mdx(), 
    sitemap(), 
    icon()
  ],
  adapter: netlify(),
  output: 'server',
  trailingSlash: 'always',
  vite: {
    plugins: [tinaAdminDevRedirect()],
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', '@tanstack/react-table'],
    },
  },
  image: {
    // Enable built-in image optimization
    domains: ['lowernotleyhallfarm.com', 'www.lowernotleyhallfarm.com', 'lowernotleyhallfarm.netlify.app', 'www.lowernotleyhallfarm.netlify.app' ],
  },
});