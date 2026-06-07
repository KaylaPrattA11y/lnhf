import React from 'react';
import { defineConfig } from 'tinacms';

const toTimeValue = (raw: unknown): string => {
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  const trimmed = raw.trim();

  // Accept already-normalized HH:mm values.
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return trimmed;

  // Gracefully read legacy datetime values and present only time.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const timeOnlyInput = (props: any) => {
  const value = toTimeValue(props.input.value);
  const input = React.createElement('input', {
    type: 'time',
    value,
    step: 60,
    onBlur: props.input.onBlur,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      props.input.onChange(event.target.value);
    },
    id: props.input.name,
    style: {
      display: 'block',
      padding: '0.5rem 0.65rem',
      border: '1px solid #d0d0d0',
      borderRadius: '4px',
      background: '#fff',
      color: '#111',
    },
  });
  const label = props.field.label ? React.createElement('label', { className: 'form-label', htmlFor: props.input.name }, props.field.label) : null;
  return React.createElement('div', { className: 'form-group' }, label, input);
};

const galleryFields = [
  {
    type: 'string',
    label: 'Media type',
    name: 'mediaType',
    options: ['photo', 'video'],
    required: true,
    description:
      'Select whether this gallery item is a photo or video.',
  },
  {
    type: 'image',
    label: 'Image',
    name: 'image',
    description:
      'Upload the image file for the gallery. Recommended dimensions: 1200x630px',
  },
  {
    type: 'string',
    label: 'Vimeo video URL',
    name: 'vimeoUrl',
    description:
      "Paste the Vimeo video URL (e.g., 'https://vimeo.com/1110587814')",
  },
  {
    type: 'datetime',
    label: 'Publish Date',
    name: 'pubDate',
    required: true,
    description:
      'This is the date that will be used to sort your images in the gallery. It does not have to be the date the photo was taken.',
  },
  {
    type: 'string',
    label: 'Title',
    name: 'title',
    isTitle: true,
    required: true,
    description:
      'A short title for this gallery item.',
  },
  {
    type: 'string',
    label: 'Caption',
    name: 'caption',
    description:
      'A brief description shown below the image or video.',
  },
  {
    type: 'string',
    label: 'Credit',
    name: 'credit',
    description:
      'Attribution for the photographer or videographer.',
  },
];

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
          showOnHomepage: false,
          pubDate: new Date().toISOString(),
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
            description: 'The headline for this article. Appears at the top of the page and in search results.',
          },
          {
            name: 'pubDate',
            label: 'Publish Date',
            type: 'datetime',
            required: true,
            description: 'The date and time this article was published. Used for sorting and display purposes.',
          },
          {
            name: 'showOnHomepage',
            label: 'Show on Homepage',
            type: 'boolean',
            description: 'If selected, this article will be featured on the homepage.',
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
            type: 'object',
            list: true,
            description: 'Additional media for this article.',
            ui: {
              defaultItem: () => ({
                mediaType: 'photo',
                pubDate: new Date().toISOString(),
              }),
            },
            fields: galleryFields as any,
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
        label: 'Home Page Slide Show',
        name: 'carousel',
        path: 'src/content/carousel',
        format: 'mdx',
        defaultItem: () => ({
          sortOrder: 99,
        }),
        fields: [
          {
            type: 'image',
            label: 'Image',
            name: 'image',
            required: true,
            description: 'Hero image slide. Recommended dimensions: at least 1920x1280.',
          },
          {
            type: 'string',
            label: 'Title',
            name: 'title',
            required: true,
            isTitle: true,
            description: 'Internal title for this slide.',
          },
          {
            type: 'string',
            label: 'Caption',
            name: 'caption',
            required: true,
            description: 'Describe what is visible in the image for screen reader users.',
          },
          {
            type: 'number',
            label: 'Sort Order',
            name: 'sortOrder',
            description: 'Lower numbers appear first. The homepage shows a maximum of 5 slides.',
          },
        ],
      },
      {
        label: "About Page: Photo/Video Gallery",
        name: "gallery",
        path: "src/content/gallery",
        format: "mdx",
        defaultItem: () => ({
          pubDate: new Date().toISOString(),
        }),
        fields: galleryFields as any,
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
            name: 'vendorServices',
            label: 'Service(s)',
            type: 'string',
            list: true,
            description: 'Select the services this vendor provides.',
            options: [
              { label: 'Bartending', value: 'Bartending' },
              { label: 'Catering', value: 'Catering' },
              { label: 'Decor', value: 'Decor' },
              { label: 'DJs and Entertainment', value: 'DJs and Entertainment' },
              { label: 'Florist', value: 'Florist' },
              { label: 'Photography', value: 'Photography' },
              { label: 'Transportation', value: 'Transportation' },
              { label: 'Wedding Coordination', value: 'Wedding Coordination' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            name: 'isPreferred',
            label: 'Preferred Vendor',
            type: 'boolean',
            description: 'If true, this vendor will be highlighted as a preferred vendor.',
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
            name: 'body',
            label: 'Additional Details',
            type: 'rich-text',
            isBody: true,
            description: 'Optional information about this vendor, such as services offered, pricing notes, or other relevant points.',
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
            ui: {
              validate: (value) => {
                if (value?.length > 100) {
                  return 'Names cannot exceed 100 characters';
                }
              }
            },
            required: true,
            isTitle: true,
          },
          {
            name: 'testimonial',
            label: 'Testimonial Text',
            type: 'string',
            ui: {
              component: 'textarea',
              validate: (value) => {
                if (value?.length > 250) {
                  return 'Testimonial text cannot exceed 250 characters';
                }
              },
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
      {
        name: 'pricing',
        label: 'Pricing',
        path: 'src/content/pricing',
        format: 'mdx',
        defaultItem: () => ({
          feeType: 'static',
          sortOrder: 99,
          perUnit: false,
          billingTreatment: 'includedInTotals',
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
            name: 'billingTreatment',
            label: 'Billing Treatment',
            type: 'string',
            options: [
              { label: 'Included in totals', value: 'includedInTotals' },
              { label: 'Included now, refundable later', value: 'returnedLater' },
              { label: 'Informational only (excluded from totals)', value: 'informationalOnly' },
            ],
            required: true,
            description: 'Choose how this line item affects totals. Use "Included now, refundable later" for deposits and "Informational only" for items displayed but not billed.',
          },
          {
            name: 'feeType',
            label: 'Fee Type',
            type: 'string',
            options: [
              { label: 'Base (always included, non-negotiable fee)', value: 'static' },
              { label: 'Add-on (based on user selections)', value: 'dynamic' },
            ],
            required: true,
            description: 'Base fees are not selectable by the user and are always included in the quote. Add-on fees can be toggled on/off by the user when generating a custom quote.',
          },
          {
            name: 'isChecked',
            label: 'Checked by Default (for add-on fees)',
            type: 'boolean',
            description: 'If this is a dynamic add-on fee, setting this to true will have it selected by default when generating a custom quote.',
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
        name: 'tourTimeSlots',
        label: 'Tour Time Slots',
        path: 'src/content/tour-time-slots',
        format: 'mdx',
        defaultItem: () => ({
          seedSlotOnDay: ['0'],
        }),
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
          filename: {
            readonly: false,
            slugify: (values: { tourStart?: string; tourEnd?: string }) => {
              const toTwelveHour = (time: string) => {
                const [hourStr, minute] = time.split(':');
                let hour = parseInt(hourStr, 10);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                hour = hour % 12 || 12; // Convert to 12-hour format
                return `${hour}${minute}${ampm}`;
              };
              if (values?.tourStart && values?.tourEnd) {
                return `slot-${toTwelveHour(values?.tourStart?.toString())}-${toTwelveHour(values?.tourEnd?.toString())}`;
              }
              return `slot-undefined`;
            },
          },
        },
        fields: [
          {
            name: 'tourStart',
            label: 'Tour Start Time',
            type: 'string',
            required: true,
            ui: {
              component: timeOnlyInput,
              validate: (value: string, allValues?: { tourStart?: string; tourEnd?: string }) => {
                if (!value) return 'Start time is required.';
                if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) === false) {
                  return 'Use 24-hour time in HH:mm format (example: 10:00).';
                }
                if (allValues?.tourEnd && value === allValues.tourEnd) {
                  return 'Start and end times cannot be identical.';
                }
              },
            },
            description: 'Enter the start time for this tour slot.',
          },
          {
            name: 'tourEnd',
            label: 'Tour End Time',
            type: 'string',
            required: true,
            ui: {
              component: timeOnlyInput,
              validate: (value: string, allValues?: { tourStart?: string; tourEnd?: string }) => {
                if (!value) return 'End time is required.';
                if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) === false) {
                  return 'Use 24-hour time in HH:mm format (example: 11:00).';
                }
                if (allValues?.tourStart && value === allValues.tourStart) {
                  return 'Start and end times cannot be identical.';
                }
              },
            },
            description: 'Enter the end time for this tour slot.',
          },
          {
            name: 'seedSlotOnDay',
            label: 'Automatically Seed Slot On Day(s)',
            type: 'string',
            list: true,
            options: [
              { label: 'Sunday', value: '0' },
              { label: 'Monday', value: '1' },
              { label: 'Tuesday', value: '2' },
              { label: 'Wednesday', value: '3' },
              { label: 'Thursday', value: '4' },
              { label: 'Friday', value: '5' },
              { label: 'Saturday', value: '6' },
            ],
            description: 'Choose which weekday(s) should automatically receive this time slot when the monthly seeded-slot sync runs. The sync looks 12 months ahead, adds missing future slots, and removes future unbooked slots for weekdays you uncheck. Booked slots are never removed. Leave this empty to keep this time slot manual-only.',
          }
        ]
      }
    ],
  },
});
