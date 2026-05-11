import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    showOnHomepage: z.boolean().default(false),
    author: z.string().optional(),
    featuredImage: z.string().optional(),
    photoGallery: z.array(z.string()).optional(),
    excerpt: z.string().optional(),
  }),
});

const faqCollection = defineCollection({
  type: 'content',
  schema: z.object({
    question: z.string(),
    sortOrder: z.number().default(99),
  }),
});

export const collections = {
  blog: blogCollection,
  faqs: faqCollection,
};
