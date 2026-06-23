/**
 * MapMyIndia (Mappls) credentials.
 *
 * Phase 8 decision: the Mappls REST key returns HTTP 412 on every tile request
 * (tested with multiple tile coordinates, zoom levels, and Referer headers).
 * The key is rejected by the Mappls CDN — this is NOT a CORS issue. Per the
 * project rule "a broken map is worse than no map", the ResultCard now ALWAYS
 * renders the Corridor Snapshot card and does NOT attempt to load Mappls tiles.
 *
 * EventMap.tsx is kept on disk (unused) so it can be re-enabled if a valid key
 * is rotated in. To do so: (1) set VITE_MAPPLS_REST_KEY in frontend/.env to the
 * new key, (2) re-enable the EventMap import in ResultCard.tsx.
 *
 * No other tile source (CartoDB, OSM, Google) is permitted.
 */
export const MAPPLS_REST_KEY: string =
  import.meta.env.VITE_MAPPLS_REST_KEY ?? ''
export const MAPPLS_CLIENT_ID: string =
  import.meta.env.VITE_MAPPLS_CLIENT_ID ?? ''
export const MAPPLS_CLIENT_SECRET: string =
  import.meta.env.VITE_MAPPLS_CLIENT_SECRET ?? ''

/** Mappls raster tile style. still_mode = standard map. */
export const MAPPLS_TILE_STYLE = 'still_mode'

/** True when the Mappls REST key is configured. Currently unused since the map
 *  is disabled (Phase 8), but kept for potential future re-enablement. */
export const MAPPLS_LIVE = MAPPLS_REST_KEY.trim().length > 0

export const APP_NAME = 'EventReady AI'
export const APP_TAGLINE = 'Decision-grade readiness for any event — backed by 8,057 historical incidents'
