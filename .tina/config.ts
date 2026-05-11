import { defineConfig } from 'tinacms';

export default defineConfig({
  branch: process.env.HEAD || 'main',
  clientId: process.env.TINA_PUBLIC_CLIENT_ID ?? '',
  token: process.env.TINA_TOKEN ?? '',

  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },

  media: {
    tina: {
      mediaRoot: 'images/uploads',
      publicFolder: 'public',
    },
  },

  schema: {
    collections: [
      {
        name: 'blog',
        label: 'Blog Posts',
        path: 'src/content/blog',
        format: 'mdx',
        ui: {
          filename: {
            readonly: false,
            slugify: values => {
              return values?.title
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '') ?? '';
            },
          },
        },
        fields: [
          {
            name: 'title',
            label: 'Title',
            type: 'string',
            required: true,
            isTitle: true,
          },
          {
            name: 'date',
            label: 'Publish Date',
            type: 'datetime',
            required: true,
          },
          {
            name: 'showOnHomepage',
            label: 'Show on Homepage',
            type: 'boolean',
          },
          {
            name: 'author',
            label: 'Author',
            type: 'string',
          },
          {
            name: 'excerpt',
            label: 'Excerpt',
            type: 'string',
            ui: {
              component: 'textarea',
            },
          },
          {
            name: 'featuredImage',
            label: 'Featured Image',
            type: 'image',
          },
          {
            name: 'photoGallery',
            label: 'Photo Gallery',
            type: 'image',
            list: true,
          },
          {
            name: 'body',
            label: 'Body',
            type: 'rich-text',
            isBody: true,
          },
        ],
      },
      {
        name: 'faqs',
        label: 'FAQs',
        path: 'src/content/faqs',
        format: 'mdx',
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
        },
        fields: [
          {
            name: 'question',
            label: 'Question',
            type: 'string',
            required: true,
            isTitle: true,
          },
          {
            name: 'sortOrder',
            label: 'Sort Order',
            type: 'number',
            ui: {
              description: 'Lower numbers appear first. Default: 99.',
            },
          },
          {
            name: 'body',
            label: 'Answer',
            type: 'rich-text',
            isBody: true,
          },
        ],
      },
    ],
  },
});
