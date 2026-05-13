/// <reference types="astro/client" />
/// <reference path="../node_modules/astro/astro-jsx.d.ts" />

// Bridge Astro's HTML element types to the global JSX namespace.
// @types/react v19 removed global JSX.IntrinsicElements; the Astro language
// server (v2.16+) injects astro-jsx.d.ts but no longer bridges astroHTML.JSX
// to the global JSX namespace. Without this, every HTML element in .astro
// templates produces: "JSX element implicitly has type 'any'".
declare namespace JSX {
  interface IntrinsicElements extends astroHTML.JSX.IntrinsicElements {}
  interface IntrinsicAttributes extends astroHTML.JSX.IntrinsicAttributes {}
}

interface Window {
  netlifyIdentity?: {
    init(options?: { APIUrl?: string }): void;
    open(modal?: 'login' | 'signup'): void;
    close(): void;
    logout(): void;
    currentUser(): import('netlify-identity-widget').User | null;
    on(event: 'init', cb: (user: import('netlify-identity-widget').User | null) => void): void;
    on(event: 'login', cb: (user: import('netlify-identity-widget').User) => void): void;
    on(event: 'logout' | 'open' | 'close', cb: () => void): void;
    on(event: 'error', cb: (err: Error) => void): void;
  };
}

interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly TINA_PUBLIC_CLIENT_ID: string;
  readonly TINA_TOKEN: string;
  readonly NETLIFY_IDENTITY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
