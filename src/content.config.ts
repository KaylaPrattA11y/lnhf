import { defineCollection } from "astro:content";
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    showOnHomepage: z.boolean().optional().default(false),
    author: z.string().optional(),
    excerpt: z.string().optional(),
    featuredImage: z.string().optional(),
    photoGallery: z.array(z.string()).optional(),
  }),
});

const gallery = defineCollection({
  loader: glob({ base: './src/content/gallery', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    mediaType: z.enum(['photo', 'video']),
    image: z.string().optional(),
    vimeoUrl: z.string().optional(),
    pubDate: z.coerce.date(),
    title: z.string(),
    caption: z.string().optional(),
    credit: z.string().optional()
  }),
});

const faqs = defineCollection({
  loader: glob({ base: './src/content/faqs', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    question: z.string(),
    sortOrder: z.number().optional(),
  }),
});

const vendors = defineCollection({
  loader: glob({ base: './src/content/vendors', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    vendorType: z.enum(['Bartending', 'Catering', 'Decor','DJs and Entertainment', 'Florist', 'Photography', 'Transportation', 'Wedding Coordination', 'Other']).optional(),
    isPreferred: z.boolean().optional().default(false),
    website: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    sortOrder: z.number().optional(),
  }),
});

const pricingTableEntries = defineCollection({
  loader: glob({ base: './src/content/pricing-table-entries', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    feeType: z.enum(['static', 'dynamic']).default('static'),
    adjustment: z.number().optional(),
    perUnit: z.boolean().optional().default(false),
    maxUnits: z.number().optional(), // only used if perUnit is true
    omitFromTotal: z.boolean().optional().default(false), // for line items like damage deposit that aren't included in the running total
    sortOrder: z.number().optional().default(99),
  }),
});


const testimonials = defineCollection({
  loader: glob({ base: './src/content/testimonials', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    names: z.string().max(100, 'Names cannot exceed 100 characters'),
    testimonial: z.string().max(250, 'Testimonial text cannot exceed 250 characters'),
    date: z.string().optional(),
    photo: z.string().optional(),
    showOnHomepage: z.boolean().optional().default(false),
    sortOrder: z.number().optional().default(99),
  }),
});

export const collections = { blog, gallery, faqs, vendors, pricingTableEntries, testimonials };
