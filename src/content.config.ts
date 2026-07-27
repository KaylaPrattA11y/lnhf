import { defineCollection } from "astro:content";
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const statusSchema = z.enum(['draft', 'published']).optional().default('draft');

const galleryItemSchema = z.object({
  image: z.string(),
  pubDate: z.coerce.date().default(new Date()),
  title: z.string(),
  caption: z.string().optional(),
  credit: z.string().optional(),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    title: z.string(),
    pubDate: z.coerce.date().default(new Date()),
    showOnHomepage: z.boolean().optional().default(false),
    author: z.string().optional(),
    excerpt: z.string().optional(),
    featuredImage: z.string().optional(),
    photoGallery: z.array(z.union([z.string(), galleryItemSchema])).optional(),
  }),
});

const gallery = defineCollection({
  loader: glob({ base: './src/content/gallery', pattern: '**/*.{md,mdx}' }),
  schema: galleryItemSchema.extend({
    status: statusSchema,
  }),
});

const carousel = defineCollection({
  loader: glob({ base: './src/content/carousel', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    image: z.string(),
    title: z.string(),
    caption: z.string(),
    sortOrder: z.number().optional().default(99),
  }),
});

const faqs = defineCollection({
  loader: glob({ base: './src/content/faqs', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    question: z.string(),
    sortOrder: z.number().optional().default(99),
  }),
});

const tourTimeSlots = defineCollection({
  loader: glob({ base: './src/content/tour-time-slots', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    tourStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'tourStart must use HH:mm 24-hour format'),
    tourEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'tourEnd must use HH:mm 24-hour format'),
    seedSlotOnDay: z
      .array(z.string().regex(/^[0-6]$/, 'seedSlotOnDay must be a string representing a day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)'))
      .optional()
      .default([]),
  }),
});

const vendors = defineCollection({
  loader: glob({ base: './src/content/vendors', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    name: z.string(),
    vendorServices: z
      .union([
        z.enum(['Bartending', 'Catering', 'Decor', 'DJs and Entertainment', 'Florist', 'Photography', 'Transportation', 'Wedding Coordination', 'Other']),
        z.array(z.enum(['Bartending', 'Catering', 'Decor', 'DJs and Entertainment', 'Florist', 'Photography', 'Transportation', 'Wedding Coordination', 'Other'])),
      ])
      .optional()
      .transform((value) => {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
      }),
    logo: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    sortOrder: z.number().optional().default(99),
  }),
});

const pricing = defineCollection({
  loader: glob({ base: './src/content/pricing', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    name: z.string(),
    description: z.string().optional(),
    billingTreatment: z.enum(['includedInTotals', 'returnedLater', 'informationalOnly']).optional().default('includedInTotals'),
    feeType: z.enum(['static', 'dynamic']).default('static'),
    isChecked: z.boolean().optional().default(false),
    adjustment: z.number().optional(),
    perUnit: z.boolean().optional().default(false),
    maxUnits: z.number().optional(), // only used if perUnit is true
    sortOrder: z.number().optional().default(99),
  }),
});


const testimonials = defineCollection({
  loader: glob({ base: './src/content/testimonials', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    status: statusSchema,
    names: z.string().max(100, 'Names cannot exceed 100 characters'),
    testimonial: z.string().max(250, 'Testimonial text cannot exceed 250 characters'),
    date: z.string().optional().default(new Date().toISOString()),
    photo: z.string().optional(),
    showOnHomepage: z.boolean().optional().default(false),
    sortOrder: z.number().optional().default(99),
  }),
});

export const collections = {
  blog,
  carousel,
  gallery,
  faqs,
  vendors,
  pricing,
  testimonials,
  tourTimeSlots,
};
