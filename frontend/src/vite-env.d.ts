/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mappls REST API key -- drives the Leaflet raster tile layer. */
  readonly VITE_MAPPLS_REST_KEY?: string
  /** Mappls OAuth client id (reserved for JS SDK; not used by the tile layer). */
  readonly VITE_MAPPLS_CLIENT_ID?: string
  /** Mappls OAuth client secret (reserved for JS SDK; not used by the tile layer). */
  readonly VITE_MAPPLS_CLIENT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
