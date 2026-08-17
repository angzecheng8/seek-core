// @seek/core — shared data layer for the Seek directory network.
//
// One Supabase-derived foundation renders as a different directory on each
// domain. A site supplies a SiteContext; this package supplies everything that
// reads from it. Nothing visual lives here — no components, no palette, no
// editorial copy — so each site's design and voice can diverge completely.

export type { Listing, StateBucket } from './types.js';
export type { SiteContext, VoicePack } from './site.js';
export type { Region, StateBase } from './states.js';

export {
  STATES_BASE,
  STATE_BASE_BY_SLUG,
  STATE_BASE_BY_NAME,
  stateNameToSlug,
} from './states.js';

export {
  createDataLayer,
  inIndustry,
  siteVertical,
  truncateMeta,
  lowerIndustry,
  indefiniteArticle,
  proseList,
  buildWhatsappUrl,
  buildGoogleMapsUrl,
  formatRating,
  formatReviewCount,
  topCities,
  listingStats,
} from './data.js';
