// Site identity. Every consumer of the shared data layer supplies one of these.
//
// This is what makes one 11,295-row foundation render as a different directory on
// each domain: same records, different vertical slice, different brand, different
// voice. See spinoff-network-plan.md §3.

import type { Listing } from './types.js';

/**
 * Per-site copy templates. This is the uniqueness layer — see plan §4.
 *
 * Every spin-off surfaces businesses that also appear on seekbusiness.my, and each
 * spin-off self-canonicals, so the copy has to genuinely differ rather than being
 * the same sentence with the brand swapped. Selection within a slot is seeded by
 * `hash(slug + domain)` so a given listing renders the same text on every build —
 * copy that churns per build reads as instability and makes diffs unreviewable.
 *
 * Optional for now: sites without a pack fall back to the shared generators.
 */
export interface VoicePack {
  opener?: string[];
  reviewFrame?: string[];
  breadthFrame?: string[];
  scheduleFrame?: string[];
  closer?: string[];
  metaFrame?: string[];
}

export interface SiteContext {
  /** Bare production host, no protocol. e.g. "seekfactory.my" */
  domain: string;
  /** Display name. e.g. "Seek Factory" */
  brand: string;
  /** Appended to SERP titles when it still fits the ~60 char target. */
  brandSuffix: string;

  /**
   * The verticals this site surfaces, in display order.
   *
   * Drives every query, every hub page, and the industry×state combo set. A
   * spin-off lists one or two; seekbusiness.my lists all thirteen. Order matters —
   * it determines hub ordering and the sitemap's combo sequence.
   */
  verticals: string[];

  /** Absolute path to this site's normalized listings JSON. */
  dataPath: string;

  /** Vertical slug → display label, for copy that names the trade. */
  verticalLabels: Record<string, string>;

  /**
   * Buyer guidance for one listing, written in THIS site's voice.
   *
   * A resolver rather than a map, because the useful key is the **sub-vertical**,
   * not the industry: keying on the 13 industries gave every manufacturing listing
   * the same paragraph and left four industries with none. Implementations
   * typically try `industry:subcategory`, then `sub_verticals[]`, then fall back to
   * the vertical. See `src/lib/guidance.ts` for the seekbusiness.my implementation.
   *
   * `vertical` is the site-resolved vertical (see `siteVertical`), so a spin-off's
   * fallback never reaches for another site's trade.
   *
   * Part of the uniqueness layer — seekfactory's manufacturing advice must not be
   * the same paragraph seekbusiness.my serves for the same listing (plan §4).
   */
  guidance: (l: Listing, vertical: string) => string | undefined;

  voice?: VoicePack;
}
