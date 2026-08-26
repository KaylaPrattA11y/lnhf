import React from 'react';
import { defineConfig, type TinaCMS, useCMS } from 'tinacms';

type DraftCollection = {
  name: string;
  label: string;
  connectionField: string;
};

type DraftDocument = {
  collectionName: string;
  collectionLabel: string;
  title: string;
  filename: string;
  relativePath: string;
  breadcrumbs: string[];
};

const draftCollections: DraftCollection[] = [
  { name: 'blog', label: 'Blog Posts', connectionField: 'blogConnection' },
  { name: 'carousel', label: 'Home Page Slide Show', connectionField: 'carouselConnection' },
  { name: 'gallery', label: 'About Page Gallery', connectionField: 'galleryConnection' },
  { name: 'faqs', label: 'FAQs', connectionField: 'faqsConnection' },
  { name: 'vendors', label: 'Vendors', connectionField: 'vendorsConnection' },
  { name: 'testimonials', label: 'Testimonials', connectionField: 'testimonialsConnection' },
  { name: 'pricing', label: 'Pricing', connectionField: 'pricingConnection' },
  { name: 'tourTimeSlots', label: 'Tour Time Slots', connectionField: 'tourTimeSlotsConnection' },
  { name: 'offerings', label: 'What We Offer', connectionField: 'offeringsConnection' },
];

const buildDraftsQuery = (connectionField: string) => `#graphql
  query DraftDocuments {
    ${connectionField}(first: 200, filter: { status: { eq: "draft" } }) {
      edges {
        node {
          ... on Document {
            _sys {
              title
              filename
              relativePath
              breadcrumbs
            }
            _values
          }
        }
      }
    }
  }
`;

const DraftsIcon = () => React.createElement(
  'svg',
  {
    viewBox: '0 0 24 24',
    width: '1.5em',
    height: '1.5em',
    style: {
      marginInlineEnd: '0.5em',
    },
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
  React.createElement('path', { d: 'M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2' }),
  React.createElement('path', { d: 'M9 12h6' }),
  React.createElement('path', { d: 'M9 16h4' }),
  React.createElement('path', { d: 'M14 4h6v6' }),
  React.createElement('path', { d: 'M20 4 12 12' }),
);

const fetchDraftDocuments = async (cms: TinaCMS): Promise<DraftDocument[]> => {
  const tinaApi = cms.api.tina;

  if (!tinaApi) {
    throw new Error('Tina API is unavailable.');
  }

  const results = await Promise.all(
    draftCollections.map(async (collection) => {
      const response = await tinaApi.request(buildDraftsQuery(collection.connectionField), { variables: {} }) as Record<string, {
        edges?: Array<{
          node?: {
            _sys?: {
              title?: string;
              filename?: string;
              relativePath?: string;
              breadcrumbs?: string[];
            };
            _values?: {
              status?: string;
            };
          };
        }>;
      }>;

      return (response[collection.connectionField]?.edges ?? [])
        .filter((edge) => edge.node?._sys && edge.node._values?.status === 'draft')
        .map((edge) => ({
          collectionName: collection.name,
          collectionLabel: collection.label,
          title: edge.node?._sys?.title?.trim() || edge.node?._sys?.filename || 'Untitled draft',
          filename: edge.node?._sys?.filename || '',
          relativePath: edge.node?._sys?.relativePath || '',
          breadcrumbs: edge.node?._sys?.breadcrumbs || [],
        }));
    }),
  );

  return results
    .flat()
    .sort((left, right) => left.collectionLabel.localeCompare(right.collectionLabel) || left.title.localeCompare(right.title));
};

const DraftsScreen = () => {
  const cms = useCMS();
  const [drafts, setDrafts] = React.useState<DraftDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDrafts = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextDrafts = await fetchDraftDocuments(cms);
      setDrafts(nextDrafts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load drafts.');
    } finally {
      setLoading(false);
    }
  }, [cms]);

  React.useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  return React.createElement(
    'div',
    {
      style: {
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '2rem',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        },
      },
      React.createElement(
        'div',
        null,
        React.createElement('h1', { style: { fontSize: '2rem', margin: '0 0 0.5rem', color: '#1f2937' } }, 'Drafts Queue'),
        React.createElement(
          'p',
          { style: { margin: 0, color: '#4b5563', maxWidth: '60ch', lineHeight: 1.5 } },
          'This dashboard shows every content entry that is still in draft status so editors can review, finish, and publish work from one place.'
        ),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => {
            void loadDrafts();
          },
          style: {
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            background: '#fff',
            color: '#374151',
            padding: '0.7rem 1rem',
            fontWeight: 600,
            cursor: 'pointer',
          },
        },
        'Refresh list',
      ),
    ),
    error && React.createElement(
      'div',
      {
        style: {
          marginBottom: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: '0.75rem',
          border: '1px solid #fecaca',
          background: '#fef2f2',
          color: '#991b1b',
        },
      },
      error,
    ),
    loading
      ? React.createElement('p', { style: { color: '#6b7280' } }, 'Loading draft entries...')
      : drafts.length === 0
        ? React.createElement(
            'div',
            {
              style: {
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                border: '1px solid #bbf7d0',
                background: '#f0fdf4',
                color: '#166534',
              },
            },
            'No drafts are waiting for review.',
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'p',
              { style: { margin: '0 0 1rem', color: '#6b7280', fontWeight: 600 } },
              `${drafts.length} draft${drafts.length === 1 ? '' : 's'} waiting for review`,
            ),
            React.createElement(
              'div',
              {
                style: {
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.9rem',
                  overflow: 'hidden',
                  background: '#fff',
                },
              },
              React.createElement(
                'table',
                {
                  style: {
                    width: '100%',
                    borderCollapse: 'collapse',
                  },
                },
                React.createElement(
                  'thead',
                  { style: { background: '#f9fafb' } },
                  React.createElement(
                    'tr',
                    null,
                    ['Title', 'Collection', 'Path', ''].map((heading) => React.createElement(
                      'th',
                      {
                        key: heading || 'actions',
                        style: {
                          padding: '0.85rem 1rem',
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: '#6b7280',
                          borderBottom: '1px solid #e5e7eb',
                        },
                      },
                      heading,
                    )),
                  ),
                ),
                React.createElement(
                  'tbody',
                  null,
                  drafts.map((draft) => React.createElement(
                    'tr',
                    { key: `${draft.collectionName}:${draft.relativePath}` },
                    React.createElement(
                      'td',
                      { style: { padding: '1rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' } },
                      React.createElement('div', { style: { fontWeight: 600, color: '#1f2937', marginBottom: '0.35rem' } }, draft.title),
                      React.createElement(
                        'span',
                        {
                          style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: '999px',
                            padding: '0.2rem 0.55rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: '#fff7ed',
                            border: '1px solid #fdba74',
                            color: '#9a3412',
                          },
                        },
                        'Draft',
                      ),
                    ),
                    React.createElement('td', { style: { padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'top' } }, draft.collectionLabel),
                    React.createElement('td', { style: { padding: '1rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', verticalAlign: 'top', fontFamily: 'monospace', fontSize: '0.9rem' } }, draft.relativePath),
                    React.createElement(
                      'td',
                      { style: { padding: '1rem', borderBottom: '1px solid #f3f4f6', textAlign: 'right', verticalAlign: 'top' } },
                      React.createElement(
                        'a',
                        {
                          href: `#/collections/edit/${draft.collectionName}/~/${draft.breadcrumbs.join('/')}`,
                          style: {
                            display: 'inline-block',
                            borderRadius: '0.5rem',
                            background: '#c2410c',
                            color: '#fff',
                            textDecoration: 'none',
                            padding: '0.65rem 0.95rem',
                            fontWeight: 600,
                          },
                        },
                        'Open draft',
                      ),
                    ),
                  )),
                ),
              ),
            ),
          ),
  );
};

const withDraftsScreen = (cms: TinaCMS) => {
  cms.plugins.add({
    __type: 'screen',
    name: 'Drafts Queue',
    Component: DraftsScreen,
    Icon: DraftsIcon,
    layout: 'fullscreen',
    navCategory: 'Dashboard',
  });

  return cms;
};

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

const statusFieldInput = (props: any) => {
  const value = props.input.value === 'published' ? 'published' : 'draft';
  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '0.2rem 0.55rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    background: value === 'published' ? '#e6f8eb' : '#fff1d6',
    color: value === 'published' ? '#17663a' : '#8a4b00',
    border: `1px solid ${value === 'published' ? '#9dd3ad' : '#f0c36d'}`,
  };

  const select = React.createElement(
    'select',
    {
      value,
      onBlur: props.input.onBlur,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
        props.input.onChange(event.target.value);
      },
      id: props.input.name,
      style: {
        display: 'block',
        width: '100%',
        padding: '0.5rem 0.65rem',
        border: '1px solid #d0d0d0',
        borderRadius: '4px',
        background: '#fff',
        color: '#111',
      },
    },
    React.createElement('option', { value: 'draft' }, 'Draft'),
    React.createElement('option', { value: 'published' }, 'Published'),
  );

  const label = props.field.label
    ? React.createElement('label', { className: 'form-label', htmlFor: props.input.name }, props.field.label)
    : null;
  const badge = React.createElement(
    'span',
    { style: badgeStyles },
    value === 'published' ? 'Published' : 'Draft',
  );
  const helper = React.createElement(
    'p',
    {
      style: {
        margin: '0.5rem 0 0',
        fontSize: '0.875rem',
        color: '#555',
      },
    },
    value === 'published'
      ? 'This entry is live on the website. (Please wait 5-10 minutes for changes to appear on the live site.)'
      : 'This entry is hidden from the public website until you switch it to Published. (Please wait 5-10 minutes for changes to appear on the live site.)',
  );

  return React.createElement(
    'div',
    { className: 'form-group' },
    label,
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.5rem',
        },
      },
      badge,
    ),
    select,
    helper,
  );
};

const galleryFields = [
  {
    type: 'image',
    label: 'Image',
    name: 'image',
    required: true,
    description:
      'Upload the image file for the gallery. Recommended dimensions: 1200x630px',
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

const statusField = {
  name: 'status',
  label: 'Status',
  type: 'string' as const,
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
  ],
  required: true,
  description: 'Draft entries stay hidden from the public website until you change them to Published. (Please wait 5-10 minutes for changes to appear on the live site.)',
  ui: {
    component: statusFieldInput,
  },
};

const blogFigureTemplate = {
  name: 'BlogFigure',
  label: 'Image with Caption',
  fields: [
    {
      name: 'image',
      label: 'Image',
      type: 'image',
      required: true,
    },
    {
      name: 'caption',
      label: 'Caption',
      type: 'string',
    },
    {
      name: 'float',
      label: 'Float',
      type: 'string',
      required: true,
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    {
      name: 'alt',
      label: 'Alt Text',
      type: 'string',
      description: 'Describe the image for screen readers. Leave blank only for decorative images.',
    },
  ],
};

export default defineConfig({
  branch: process.env.HEAD || process.env.BRANCH || "main",
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  cmsCallback: withDraftsScreen,
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
          status: 'draft',
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
          statusField,
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
            templates: [
              blogFigureTemplate as any,
            ],
            description: 'The main content of the article. Supports text formatting, links, and embedded media.',
          },
        ],
      },
      {
        label: 'Home Page Slide Show (5 max)',
        name: 'carousel',
        path: 'src/content/carousel',
        format: 'mdx',
        defaultItem: () => ({
          status: 'draft',
          sortOrder: 99,
        }),
        fields: [
          statusField,
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
          status: 'draft',
          pubDate: new Date().toISOString(),
        }),
        fields: [statusField, ...(galleryFields as any)],
      },
      {
        name: 'faqs',
        label: 'FAQs',
        path: 'src/content/faqs',
        format: 'mdx',
        defaultItem: () => ({
          status: 'draft',
          sortOrder: 99,
        }),
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
        },
        fields: [
          statusField,
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
          status: 'draft',
          sortOrder: 99,
        }),
        ui: {
          allowedActions: {
            create: true,
            delete: true,
          },
        },
        fields: [
          statusField,
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
            name: 'logo',
            label: 'Logo',
            type: 'image',
            description: 'Upload the vendor logo. Recommended dimensions: 400x400px.',
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
          status: 'draft',
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
          statusField,
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
          status: 'draft',
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
          statusField,
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
        name: 'offerings',
        label: 'What We Offer',
        path: 'src/content/offerings',
        format: 'mdx',
        defaultItem: () => ({
          status: 'draft',
          sortOrder: 99,
        }),
        fields: [
          statusField,
          {
            name: 'offering',
            label: 'Offering',
            type: 'string',
            required: true,
            isTitle: true,
          },
          {
            name: 'body',
            label: 'Body',
            type: 'rich-text',
            isBody: true,
            templates: [
              blogFigureTemplate as any,
            ],
            description: 'Describe the product or service. Supports text formatting, links, and embedded media.',
          },
          {
            name: 'photoGallery',
            label: 'Photo Gallery',
            type: 'object',
            list: true,
            description: 'Attach photos related to this offering.',
            ui: {
              defaultItem: () => ({
                pubDate: new Date().toISOString(),
              }),
            },
            fields: galleryFields as any,
          },
          {
            name: 'sortOrder',
            label: 'Sort Order',
            type: 'number',
            ui: {
              description: 'Lower numbers appear first. Default: 99.',
            },
          }
        ]
      },
      {
        name: 'tourTimeSlots',
        label: 'Tour Time Slots',
        path: 'src/content/tour-time-slots',
        format: 'mdx',
        defaultItem: () => ({
          status: 'draft',
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
          statusField,
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
