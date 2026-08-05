import { requestWithMetadata } from '@tinacms/astro/data';
import { getCollection } from 'astro:content';
import { readdir } from 'node:fs/promises';
import client from '../../../tina/__generated__/client';

type EntryStatusData = {
  status?: string;
  sortOrder?: number;
  showOnHomepage?: boolean;
  pubDate?: Date;
  tourStart?: string;
};

const isPublished = (status?: string) => status === 'published';

const normalizeRelativePath = (value?: string | null) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

const entryIdFromRelativePath = (value?: string | null) => {
  const normalized = normalizeRelativePath(value);
  if (!normalized) return '';
  const fileName = normalized.split('/').pop() ?? normalized;
  const stem = fileName.replace(/\.(md|mdx)$/i, '');
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

type EntryWithPath = { id: string; filePath?: string };

const collectionContentDirs = {
  faqs: 'faqs',
  vendors: 'vendors',
  carousel: 'carousel',
  testimonials: 'testimonials',
  gallery: 'gallery',
  pricing: 'pricing',
  tourTimeSlots: 'tour-time-slots',
} as const;

type CollectionKey = keyof typeof collectionContentDirs;
const collectionFileNameCache = new Map<CollectionKey, Map<string, string>>();

const getCollectionFileNameMap = async (collection: CollectionKey) => {
  const cached = collectionFileNameCache.get(collection);
  if (cached) return cached;

  const directory = new URL(`../../content/${collectionContentDirs[collection]}/`, import.meta.url);
  const files = await readdir(directory, { withFileTypes: true });
  const map = new Map<string, string>();

  for (const file of files) {
    if (!file.isFile()) continue;
    if (!file.name.endsWith('.md') && !file.name.endsWith('.mdx')) continue;
    map.set(file.name.toLowerCase(), file.name);
  }

  collectionFileNameCache.set(collection, map);
  return map;
};

const resolveEntryRelativePath = async (collection: CollectionKey, entry: EntryWithPath) => {
  const fromFilePath = entry.filePath?.split('/').pop();
  const fallback = fromFilePath ?? `${entry.id}.mdx`;
  const fileNameMap = await getCollectionFileNameMap(collection);
  return fileNameMap.get(fallback.toLowerCase()) ?? fallback;
};

const prioritizeSelectedEntry = <T extends EntryWithPath>(entries: T[], selectedRelativePath?: string | null) => {
  const selected = normalizeRelativePath(selectedRelativePath);
  const selectedId = entryIdFromRelativePath(selected);
  const selectedName = (selected.split('/').pop() ?? selected).toLowerCase();
  if (!selectedId && !selectedName) return entries;
  return [...entries].sort((a, b) => {
    const aName = (a.filePath?.split('/').pop() ?? `${a.id}.mdx`).toLowerCase();
    const bName = (b.filePath?.split('/').pop() ?? `${b.id}.mdx`).toLowerCase();
    const aSelected = a.id === selectedId || aName === selectedName;
    const bSelected = b.id === selectedId || bName === selectedName;
    if (aSelected && !bSelected) return -1;
    if (bSelected && !aSelected) return 1;
    return 0;
  });
};

const isSelectedEntry = (entry: EntryWithPath, selectedRelativePath?: string | null) => {
  const selected = normalizeRelativePath(selectedRelativePath);
  if (!selected) return false;

  const selectedId = entryIdFromRelativePath(selected);
  const selectedName = (selected.split('/').pop() ?? selected).toLowerCase();
  const entryName = (entry.filePath?.split('/').pop() ?? `${entry.id}.mdx`).toLowerCase();

  return entry.id === selectedId || entryName === selectedName;
};

const blogPathsFromSlug = (slug: string): string[] => {
  const normalized = slug.trim().replace(/^\/+|\/+$/g, '');
  return [`${normalized}.mdx`, `${normalized}.md`];
};

export const getBlogPost = async (slug: string) => {
  const candidates = blogPathsFromSlug(slug);
  let lastError: unknown;

  for (const relativePath of candidates) {
    try {
      return await requestWithMetadata(
        client.queries.blog({ relativePath }),
        { priority: 'primary' },
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to load blog post for slug: ${slug}`);
};

export const getAllFaqs = async ({ preview = false, selectedRelativePath }: { preview?: boolean; selectedRelativePath?: string | null } = {}) => {
  const entries = await getCollection('faqs', ({ data }) =>
    preview || (data as { status?: string }).status === 'published'
  );
  const sorted = prioritizeSelectedEntry(
    [...entries].sort((a, b) => ((a.data as { sortOrder?: number }).sortOrder ?? 99) - ((b.data as { sortOrder?: number }).sortOrder ?? 99)),
    selectedRelativePath,
  );
  const results = await Promise.all(
    sorted.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('faqs', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.faqs({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { faqs?: unknown } }) => r.data?.faqs).filter(Boolean);
};

export const getAllVendors = async ({ preview = false, selectedRelativePath }: { preview?: boolean; selectedRelativePath?: string | null } = {}) => {
  const entries = await getCollection('vendors', ({ data }) =>
    preview || (data as { status?: string }).status === 'published'
  );
  const prioritizedEntries = prioritizeSelectedEntry(entries, selectedRelativePath);
  const results = await Promise.all(
    prioritizedEntries.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('vendors', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.vendors({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { vendors?: unknown } }) => r.data?.vendors).filter(Boolean);
};

export const getHomeCarouselSlides = async ({ preview = false, selectedRelativePath }: { preview?: boolean; selectedRelativePath?: string | null } = {}) => {
  const entries = await getCollection('carousel', ({ data }) =>
    preview || isPublished((data as EntryStatusData).status)
  );
  const sorted = prioritizeSelectedEntry(
    [...entries]
      .sort((a, b) => ((a.data as EntryStatusData).sortOrder ?? 99) - ((b.data as EntryStatusData).sortOrder ?? 99))
      .slice(0, 5),
    selectedRelativePath,
  );
  const results = await Promise.all(
    sorted.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('carousel', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.carousel({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { carousel?: unknown } }) => r.data?.carousel).filter(Boolean);
};

export const getHomepageTestimonials = async ({ preview = false, selectedRelativePath }: { preview?: boolean; selectedRelativePath?: string | null } = {}) => {
  const entries = await getCollection('testimonials', ({ data }) => {
    const testimonialData = data as EntryStatusData;
    if (!preview && !testimonialData.showOnHomepage) return false;
    return preview || isPublished(testimonialData.status);
  });
  const sorted = prioritizeSelectedEntry(
    [...entries]
      .sort((a, b) => ((a.data as EntryStatusData).sortOrder ?? 99) - ((b.data as EntryStatusData).sortOrder ?? 99)),
    selectedRelativePath,
  );
  const results = await Promise.all(
    sorted.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('testimonials', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.testimonials({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { testimonials?: unknown } }) => r.data?.testimonials).filter(Boolean);
};

export const getAboutGalleryItems = async ({
  preview = false,
  selectedRelativePath,
  metadataScope = 'all',
}: {
  preview?: boolean;
  selectedRelativePath?: string | null;
  metadataScope?: 'all' | 'selected';
} = {}) => {
  const entries = await getCollection('gallery', ({ data }) =>
    preview || isPublished((data as EntryStatusData).status)
  );
  const sorted = prioritizeSelectedEntry(
    [...entries]
      .sort((a, b) => ((b.data as EntryStatusData).pubDate?.valueOf() ?? 0) - ((a.data as EntryStatusData).pubDate?.valueOf() ?? 0)),
    selectedRelativePath,
  );

  if (metadataScope === 'selected') {
    const selectedIndex = sorted.findIndex((entry) => isSelectedEntry(entry as EntryWithPath, selectedRelativePath));
    const metadataIndex = selectedIndex >= 0 ? selectedIndex : 0;

    const results = await Promise.all(
      sorted.map(async (entry, index) => {
        if (index !== metadataIndex) {
          return (entry.data as unknown) ?? null;
        }

        const relativePath = await resolveEntryRelativePath('gallery', entry as EntryWithPath);
        const result = await requestWithMetadata(
          client.queries.gallery({ relativePath }),
          { priority: 'primary' },
        );
        return (result as { data?: { gallery?: unknown } }).data?.gallery ?? null;
      })
    );

    return results.filter(Boolean);
  }

  const results = await Promise.all(
    sorted.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('gallery', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.gallery({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { gallery?: unknown } }) => r.data?.gallery).filter(Boolean);
};

export const getPricingEntries = async ({ preview = false, selectedRelativePath }: { preview?: boolean; selectedRelativePath?: string | null } = {}) => {
  const entries = await getCollection('pricing', ({ data }) =>
    preview || isPublished((data as EntryStatusData).status)
  );
  const sorted = prioritizeSelectedEntry(
    [...entries]
      .sort((a, b) => ((a.data as EntryStatusData).sortOrder ?? 99) - ((b.data as EntryStatusData).sortOrder ?? 99)),
    selectedRelativePath,
  );
  const results = await Promise.all(
    sorted.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('pricing', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.pricing({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { pricing?: unknown } }) => r.data?.pricing).filter(Boolean);
};

export const getTourTimeSlots = async ({ preview = false, selectedRelativePath }: { preview?: boolean; selectedRelativePath?: string | null } = {}) => {
  const entries = await getCollection('tourTimeSlots', ({ data }) =>
    preview || isPublished((data as EntryStatusData).status)
  );
  const sorted = prioritizeSelectedEntry(
    [...entries]
      .sort((a, b) => ((a.data as EntryStatusData).tourStart ?? '').localeCompare((b.data as EntryStatusData).tourStart ?? '')),
    selectedRelativePath,
  );
  const results = await Promise.all(
    sorted.map(async (entry) => {
      const relativePath = await resolveEntryRelativePath('tourTimeSlots', entry as EntryWithPath);
      return requestWithMetadata(
        client.queries.tourTimeSlots({ relativePath }),
        isSelectedEntry(entry as EntryWithPath, selectedRelativePath) ? { priority: 'primary' } : undefined,
      );
    })
  );
  return results.map((r: { data?: { tourTimeSlots?: unknown } }) => r.data?.tourTimeSlots).filter(Boolean);
};
