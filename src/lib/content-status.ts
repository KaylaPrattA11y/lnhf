import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

type EntryWithStatus = {
  data: {
    status?: 'draft' | 'published';
  };
};

const isPublished = <T extends EntryWithStatus>(entry: T) => entry.data.status !== 'draft';

export const getPublishedCollection = async <T extends CollectionKey>(collection: T): Promise<CollectionEntry<T>[]> => {
  const entries = await getCollection(collection);
  return entries.filter((entry) => isPublished(entry as CollectionEntry<T> & EntryWithStatus));
};

export { isPublished };