import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import yeskunallumami from '@yeskunall/astro-umami';

import partytown from '@astrojs/partytown';

export default defineConfig({
  site: 'https://lowernotleyhallfarm.netlify.app/',
  integrations: [
    react(), 
    mdx(), 
    sitemap(), 
    icon(), 
    yeskunallumami({ 
      id: '82637cef-cb45-4868-9db0-8e287014695d',
      withPartytown: true, 
    }), 
    partytown()
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