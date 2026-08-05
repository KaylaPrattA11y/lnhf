import { isEditMode } from '@tinacms/astro/is-edit-mode';

export const isEditorRequest = (request: Request): boolean => {
  if (isEditMode(request)) return true;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/tina-island/')) return true;
  if (url.searchParams.has('entry')) return true;

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/x-tina-preview+json')) return true;

  if (request.headers.get('x-tina-prime') === '1') return true;

  const referer = request.headers.get('referer') ?? '';
  return referer.includes('/admin/index.html') || referer.includes('/admin/');
};
