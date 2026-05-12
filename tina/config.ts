import { defineConfig } from 'tinacms';

export default defineConfig({
  branch: process.env.HEAD || process.env.BRANCH || "main",
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  search: {
    tina: {
      indexerToken: process.env.TINA_SEARCH_TOKEN,
      stopwordLanguages: ['eng'],
    },
  },
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "public",
    },
  },
  schema: {
    collections: [
      {
        name: 'blog',
        label: 'Blog Posts',
        path: 'src/content/blog',
        format: 'mdx',
        defaultItem: () => ({
          date: new Date().toISOString(),
          showOnHomepage: false,
        }),
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
            description: 'UsThe headline for this article. Appears at the top of the page and in search results.',
          },
          {
            name: 'date',
            label: 'Publish Date',
            type: 'datetime',
            required: true,
            description: 'The date and time this article was published. Used for sorting and display purposes.',
          },
          {
            name: 'showOnHomepage',
            label: 'Show on Homepage',
            type: 'boolean',
            description: 'If true, this article will be featured on the homepage.',
          },
          {
            name: 'author',
            label: 'Author',
            type: 'string',
            description: 'The name of the author of this article.',
          },
          {
            name: 'excerpt',
            label: 'Excerpt',
            type: 'string',
            ui: {
              component: 'textarea',
            },
            description: 'A short summary of the article. Appears in search results and on the homepage.',
          },
          {
            name: 'featuredImage',
            label: 'Featured Image',
            type: 'image',
            description: 'The main image for this article. Appears at the top of the page and in search results.',
          },
          {
            name: 'photoGallery',
            label: 'Photo Gallery',
            type: 'image',
            list: true,
            description: 'Additional images for this article. Appears in a gallery at the bottom of the page.',
          },
          {
            name: 'body',
            label: 'Body',
            type: 'rich-text',
            isBody: true,
            description: 'The main content of the article. Supports text formatting, links, and embedded media.',
          },
        ],
      },
      {
        label: "Photo/Video Gallery",
        name: "gallery",
        path: "src/content/gallery",
        format: "mdx",
        defaultItem: () => ({
          pubDate: new Date().toISOString(),
        }),
        fields: [
          {
            type: "string",
            label: "Media type",
            name: "mediaType",
            options: ["photo", "video"],
            required: true,
            description:
              "Select whether this gallery item is a photo or video.",
          },
          {
            type: "image",
            label: "Image",
            name: "image",
            description:
              "Upload the image file for the gallery. Recommended dimensions: 1200x630px",
          },
          {
            type: "string",
            label: "Vimeo video URL",
            name: "vimeoUrl",
            description:
              "Paste the Vimeo video URL (e.g., 'https://vimeo.com/1110587814')",
          },
          {
            type: "datetime",
            label: "Publish Date",
            name: "pubDate",
            required: true,
            description:
              "This is the date that will be used to sort your images in the gallery. It does not have to be the date the photo was taken.",
          },
          {
            type: "string",
            label: "Title",
            name: "title",
            isTitle: true,
            required: true,
            description:
              "A short title for this gallery item.",
          },
          {
            type: "string",
            label: "Caption",
            name: "caption",
            description:
              "A brief description shown below the image or video.",
          },
          {
            type: "string",
            label: "Credit",
            name: "credit",
            description:
              "Attribution for the photographer or videographer.",
          },
        ],
      },
      {
        name: 'faqs',
        label: 'FAQs',
        path: 'src/content/faqs',
        format: 'mdx',
        defaultItem: () => ({
          sortOrder: 99,
        }),
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
      {
        name: 'vendors',
        label: 'Vendors',
        path: 'src/content/vendors',
        format: 'mdx',
        defaultItem: () => ({
          sortOrder: 99,
        }),
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
        },
        fields: [
          {
            name: 'name',
            label: 'Vendor Name',
            type: 'string',
            required: true,
            isTitle: true,
          },
          {
            name: 'vendorType',
            label: 'Vendor Type',
            type: 'string',
            description: 'The category or type of vendor (e.g., "Florist", "Caterer").',
          },
          {
            name: 'website',
            label: 'Website URL',
            type: 'string',
          },
          {
            name: 'phone',
            label: 'Phone Number',
            type: 'string',
          },
          {
            name: 'email',
            label: 'Email Address',
            type: 'string',
          },
          {
            name: 'sortOrder',
            label: 'Sort Order',
            type: 'number',
            ui: {
              description: 'Lower numbers appear first. Default: 99.',
            },
          },
        ],
      },
      {
        name: 'pricingTableEntries',
        label: 'Pricing Table Entries',
        path: 'src/content/pricing-table-entries',
        format: 'mdx',
        defaultItem: () => ({
          feeType: 'static',
          sortOrder: 99,
          perUnit: false,
        }),
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
        },
        fields: [
          {
            name: 'name',
            label: 'Entry Name',
            type: 'string',
            required: true,
            isTitle: true,
          },
          {
            name: 'description',
            label: 'Description',
            type: 'string',
            ui: {
              component: 'textarea',
            },
          },
          {
            name: 'feeType',
            label: 'Fee Type',
            type: 'string',
            options: [
              { label: 'Static (always included, non-negotiable fee)', value: 'static' },
              { label: 'Dynamic (based on user selections)', value: 'dynamic' },
            ],
            required: true,
            description: 'Static fees are fixed amounts that are always included in the total price. Dynamic fees can be added or removed based on user selections when generating a custom quote.',
          },
          {
            name: 'adjustment',
            label: 'Adjustment',
            type: 'number',
            description: 'For static fees, enter the fixed amount. For dynamic fees, this can added/subtracted by the user as part of their custom quote. Negative values are discounts, positive values are surcharges.',
          },
          {
            name: 'perUnit',
            label: 'Per Unit',
            type: 'boolean',
            description: 'If true, show a quantity input for this fee when generating a custom quote. The total adjustment will be the value entered here multiplied by the quantity.',
          },
          {
            name: 'maxUnits',
            label: 'Max Units (for per-unit fees)',
            type: 'number',
            description: 'If this is a per-unit fee, you can optionally enter the maximum number of units here. This will limit the quantity input when generating a custom quote.',
          },
          {
            name: 'sortOrder',
            label: 'Sort Order',
            type: 'number',
            ui: {
              description: 'Lower numbers appear first. Default: 99.',
            },
          }
        ],
      },
      {
        name: 'testimonials',
        label: 'Testimonials',
        path: 'src/content/testimonials',
        format: 'mdx',
        defaultItem: () => ({
          sortOrder: 99,
          showOnHomepage: false,
        }),
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
        },
        fields: [
          {
            name: 'names',
            label: 'Guest Name(s)',
            type: 'string',
            required: true,
            isTitle: true,
          },
          {
            name: 'testimonial',
            label: 'Testimonial Text',
            type: 'string',
            ui: {
              component: 'textarea',
            },
            required: true,
          },
          {
            name: 'date',
            label: 'Date',
            type: 'string',
          },
          {
            name: 'photo',
            label: 'Photo',
            type: 'image',
          },
          {
            name: 'showOnHomepage',
            label: 'Show on Homepage',
            type: 'boolean',
            description: 'If true, this testimonial will be featured on the homepage.',
          },
          {
            name: 'sortOrder',
            label: 'Sort Order',
            type: 'number',
            ui: {
              description: 'Lower numbers appear first. Default: 99.',
            },
          },
        ],
      },
    ],
  },
});
