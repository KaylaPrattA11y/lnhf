/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly TINA_PUBLIC_CLIENT_ID: string;
  readonly TINA_TOKEN: string;
  readonly NETLIFY_IDENTITY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
