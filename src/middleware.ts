import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;

  // Tina Visual Editor may request Astro pages using static-style /index.htm paths.
  // Normalize those requests to the canonical trailing-slash route.
  if (pathname.endsWith('/index.htm')) {
    const normalizedPath = pathname.slice(0, -'index.htm'.length);
    const targetPath = normalizedPath === '' ? '/' : normalizedPath;
    return context.redirect(`${targetPath}${search}`, 307);
  }

  return next();
});
