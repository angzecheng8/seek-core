// Shared build-time data layer. Reads a normalized listings JSON and exposes
// filter/sort/search/copy helpers bound to one SiteContext.
//
// Every function that used to read the scalar `l.industry` now resolves the
// vertical through the site's context instead — see `siteVertical` below. That is
// what lets the same records render as a manufacturing directory on one domain and
// a construction directory on another.

import { readFileSync } from 'node:fs';
import type { Listing, StateBucket } from './types.js';
import type { SiteContext } from './site.js';
import { stateNameToSlug } from './states.js';

// ============================================================================
// Context-free helpers
// ============================================================================

// State normalization — merge duplicates that came out of Google Maps with
// different spellings/forms. KL has two source labels; Melaka has two spellings.
const STATE_MAP: Record<string, string> = {
  'Federal Territory of Kuala Lumpur': 'Kuala Lumpur',
  'Wilayah Persekutuan': 'Kuala Lumpur',
  'Wilayah Persekutuan Kuala Lumpur': 'Kuala Lumpur',
  'Malacca': 'Melaka',
};

function normalizeState(s: string | undefined): string {
  if (!s) return '';
  return STATE_MAP[s] || s;
}

// Region grouping for editorial geographic context.
const REGIONS: Record<string, string> = {
  'Selangor': 'the Klang Valley',
  'Kuala Lumpur': 'Kuala Lumpur',
  'Putrajaya': 'the Klang Valley',
  'Penang': 'northern Malaysia',
  'Kedah': 'northern Malaysia',
  'Perak': 'northern Malaysia',
  'Johor': 'southern Malaysia',
  'Melaka': 'southern Malaysia',
  'Negeri Sembilan': 'southern Malaysia',
  'Pahang': 'the East Coast',
  'Terengganu': 'the East Coast',
  'Kelantan': 'the East Coast',
  'Sabah': 'East Malaysia',
  'Sarawak': 'East Malaysia',
};

// Words that read as broken when a description ends on them ("…concentrated around the…").
const DANGLING_TAIL =
  /(?:\s+(?:a|an|the|and|or|but|of|in|on|at|to|for|with|from|by|as|into|than|that|which|while|where|when|is|are|was|were|its|their|our|your|most|more|some|such|these|those|this|it|—|–|-))+$/i;

/**
 * Truncate a description to ≤160 chars at a graceful boundary (end-of-sentence preferred).
 * Used for industry/state hub meta descriptions where the blurb can run long.
 */
export function truncateMeta(text: string, max = 160): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  // Prefer end-of-sentence cut within the last 40 chars
  const lastPeriod = slice.lastIndexOf('. ', max);
  if (lastPeriod >= max - 40) return slice.slice(0, lastPeriod + 1);
  // Otherwise cut at last word boundary, then peel off trailing connective words so
  // the snippet doesn't end mid-thought on a preposition or article.
  const lastSpace = slice.lastIndexOf(' ');
  let out = slice.slice(0, lastSpace > 0 ? lastSpace : max - 1).trim();
  out = out.replace(DANGLING_TAIL, '');
  // Drop any punctuation now left stranded at the end.
  out = out.replace(/[\s,;:—–-]+$/, '');
  return out + '…';
}

/**
 * Lowercase an industry label for mid-sentence use, preserving acronyms.
 * "Architecture & Interior" → "architecture & interior", but
 * "IT & Cybersecurity" → "IT & cybersecurity" (not "it & cybersecurity").
 */
export function lowerIndustry(name: string): string {
  return name
    .split(' ')
    .map((word) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      // All-caps run of 2+ letters is an acronym — leave it alone.
      if (letters.length >= 2 && letters === letters.toUpperCase()) return word;
      return word.toLowerCase();
    })
    .join(' ');
}

// Consonants whose *letter name* opens with a vowel sound, so an acronym starting
// with one takes "an" (an HR agency, an IT firm).
const VOWEL_SOUND_LETTERS = new Set(['A', 'E', 'F', 'H', 'I', 'L', 'M', 'N', 'O', 'R', 'S', 'X']);

/**
 * Pick "a" or "an" for a phrase. Handles acronyms by letter name.
 */
export function indefiniteArticle(phrase: string): string {
  const first = phrase.trim().replace(/[^A-Za-z]/g, '').charAt(0);
  if (!first) return 'a';
  const word = phrase.trim().split(/\s+/)[0].replace(/[^A-Za-z]/g, '');
  const isAcronym = word.length >= 2 && word === word.toUpperCase();
  if (isAcronym) return VOWEL_SOUND_LETTERS.has(first.toUpperCase()) ? 'an' : 'a';
  return 'aeiou'.includes(first.toLowerCase()) ? 'an' : 'a';
}

/**
 * Join a list of names into readable prose: "A, B and C".
 */
export function proseList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Build a wa.me URL for a listing's phone number.
 * Returns null if no valid digits.
 */
export function buildWhatsappUrl(phone: string | undefined, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;
  // Ensure MY country code prefix
  const normalized = digits.startsWith('60') ? digits : `60${digits.replace(/^0/, '')}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${text}`;
}

export function buildGoogleMapsUrl(lat?: number, lng?: number, name?: string): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (name) {
    return `https://www.google.com/maps?q=${encodeURIComponent(name)}`;
  }
  return null;
}

export function formatRating(rating?: number): string {
  if (rating == null) return '—';
  return rating.toFixed(1);
}

export function formatReviewCount(count?: number): string {
  if (!count) return '';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/**
 * Top cities within an arbitrary set of listings, biggest first.
 * Drives the "browse by city" blocks and the FAQ copy on hub pages.
 */
export function topCities(listings: Listing[], limit = 6): { city: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const l of listings) {
    if (l.city) counts[l.city] = (counts[l.city] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([city, count]) => ({ city, count }));
}

/**
 * Aggregate stats for a set of listings. Everything here is derived from real
 * records so it can be stated as fact in on-page copy and FAQ schema.
 */
export function listingStats(listings: Listing[]) {
  const rated = listings.filter((l) => (l.rating ?? 0) > 0);
  const withPhone = listings.filter((l) => !!l.phone);
  const withSite = listings.filter((l) => !!l.website);
  const avg = rated.length
    ? rated.reduce((sum, l) => sum + (l.rating ?? 0), 0) / rated.length
    : 0;
  const reviews = listings.reduce((sum, l) => sum + (l.review_count ?? 0), 0);
  return {
    total: listings.length,
    rated: rated.length,
    avgRating: Number(avg.toFixed(1)),
    totalReviews: reviews,
    withPhone: withPhone.length,
    withSite: withSite.length,
    topRated: [...rated]
      .sort((a, b) => (b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1)
                    - (a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1))
      .slice(0, 3),
  };
}

/**
 * Does this listing belong to a vertical? Checks `industries[]` rather than the
 * scalar `industry` — a business belongs to every vertical its tags resolve to,
 * and the scalar holds only the primary one. Falls back to the scalar for rows
 * that predate the taxonomy pass.
 *
 * This is the containment check every spin-off site filters on. Using the scalar
 * here hides the multi-vertical businesses from every site but one.
 */
export function inIndustry(l: Listing, industrySlug: string): boolean {
  return (l.industries ?? [l.industry]).includes(industrySlug);
}

/**
 * Which vertical does this listing occupy *on this site*?
 *
 * The primary wins whenever the site covers it — that keeps a broad directory
 * framing each business by its main trade. Only when the site does NOT cover the
 * primary (a spin-off surfacing a business whose main trade lives elsewhere) does
 * it fall back to the first covered vertical.
 *
 * Without this, a construction-primary business on seekfactory.my would be framed
 * as a construction firm and handed construction buying advice, on a manufacturing
 * site.
 */
export function siteVertical(l: Listing, ctx: SiteContext): string {
  if (ctx.verticals.includes(l.industry)) return l.industry;
  const owned = l.industries ?? [];
  return ctx.verticals.find((v) => owned.includes(v)) ?? l.industry;
}

// Listings are cached per data file, not globally — a build could load more than one.
const _cache = new Map<string, Listing[]>();

function loadAll(ctx: SiteContext): Listing[] {
  const hit = _cache.get(ctx.dataPath);
  if (hit) return hit;
  const raw = JSON.parse(readFileSync(ctx.dataPath, 'utf-8')) as Listing[];
  const rows = raw
    .filter((l) => l.active !== false && l.slug && l.name)
    .map((l) => ({
      ...l,
      state: normalizeState(l.state),
    }));
  _cache.set(ctx.dataPath, rows);
  return rows;
}

// ============================================================================
// Context-bound layer
// ============================================================================

export function createDataLayer(ctx: SiteContext) {
  const all = () => loadAll(ctx);

  /** Label for the vertical this listing occupies on this site. */
  const verticalName = (l: Listing): string =>
    ctx.verticalLabels[siteVertical(l, ctx)] ?? '';

  function getAllListings(): Listing[] {
    return all();
  }

  function getListingBySlug(slug: string): Listing | undefined {
    return all().find((l) => l.slug === slug);
  }

  function getListingsByIndustry(industry: string): Listing[] {
    return all().filter((l) => inIndustry(l, industry));
  }

  /**
   * Synthesize "featured" listings from rating + review_count signal.
   * Used until real `featured` flags are set in the admin layer.
   */
  function getFeaturedListings(limit = 9): Listing[] {
    return all()
      .filter((l) => (l.rating ?? 0) >= 4.5 && (l.review_count ?? 0) >= 20 && l.image_url)
      .sort((a, b) => {
        const aScore = (a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1);
        const bScore = (b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1);
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  /**
   * Top-rated listings for an industry — used for industry hub feature slot.
   */
  function getTopListingsForIndustry(industry: string, limit = 6): Listing[] {
    return getListingsByIndustry(industry)
      .filter((l) => l.image_url)
      .sort((a, b) => {
        const aScore = (a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1);
        const bScore = (b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1);
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  function getIndustryCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const l of all()) {
      // Count a business under every vertical it belongs to, not just the primary.
      // Restricted to this site's verticals so a vertical it doesn't surface never
      // produces a phantom entry.
      for (const v of l.industries ?? [l.industry]) {
        if (ctx.verticals.includes(v)) counts[v] = (counts[v] || 0) + 1;
      }
    }
    return counts;
  }

  function getStateBuckets(): StateBucket[] {
    const counts: Record<string, number> = {};
    for (const l of all()) {
      if (l.state) counts[l.state] = (counts[l.state] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([state, count]) => ({ state, count }));
  }

  function getStatesForIndustry(industry: string): StateBucket[] {
    const counts: Record<string, number> = {};
    for (const l of getListingsByIndustry(industry)) {
      if (l.state) counts[l.state] = (counts[l.state] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([state, count]) => ({ state, count }));
  }

  /**
   * Listings for a specific industry + state combination.
   * Used by the /industries/[industry]/[state] combo pages.
   */
  function getListingsByIndustryAndState(industry: string, stateName: string): Listing[] {
    return all().filter((l) => inIndustry(l, industry) && l.state === stateName);
  }

  /**
   * Every industry+state pair that actually has at least one listing.
   * Single source of truth for the combo pages' getStaticPaths and for the sitemap —
   * guarantees we never generate (or list) an empty combo page.
   */
  function getIndustryStateCombos(): { industrySlug: string; stateSlug: string; count: number }[] {
    const combos: { industrySlug: string; stateSlug: string; count: number }[] = [];
    for (const industrySlug of ctx.verticals) {
      for (const bucket of getStatesForIndustry(industrySlug)) {
        const stateSlug = stateNameToSlug(bucket.state);
        if (stateSlug) combos.push({ industrySlug, stateSlug, count: bucket.count });
      }
    }
    return combos;
  }

  /**
   * Append the site's brand suffix only if the result still fits within the ~60-char
   * SERP title target. Long business/article names would otherwise push well past
   * the limit once the suffix is tacked on.
   */
  function withBrandSuffix(base: string, suffix = ctx.brandSuffix, targetMax = 60): string {
    return base.length + suffix.length <= targetMax ? base + suffix : base;
  }

  // -------- Editorial copy generators ---------------------------------------
  // Grounded in observable signals only — never claims first-hand knowledge.

  /**
   * One-line summary for the listing header and meta description.
   * Target: 15–25 words. Uses Google's category (richer than our verticals) when available.
   */
  function oneLiner(l: Listing): string {
    const gmCat = (l.meta as Record<string, any> | undefined)?.gm_category;
    const cat = gmCat ? String(gmCat).toLowerCase() : (verticalName(l).toLowerCase() || 'B2B supplier');
    const article = /^[aeiou]/i.test(cat) ? 'an' : 'a';
    const locale =
      l.city && l.state && l.city !== l.state
        ? `${l.city}, ${l.state}`
        : (l.city || l.state || 'Malaysia');
    return `${l.name} is ${article} ${cat} based in ${locale}.`;
  }

  /**
   * Generate a meta-description-friendly one-liner with extra signal.
   * Target: 120-160 chars.
   */
  function metaDescription(l: Listing): string {
    const base = oneLiner(l);
    if (l.rating && l.review_count && l.review_count >= 5) {
      const extra = ` ${l.rating.toFixed(1)}★ across ${l.review_count.toLocaleString()} Google reviews — verified by ${ctx.brand}.`;
      if ((base + extra).length <= 160) return base + extra;
    }
    const fallback = ` Verified Malaysian B2B supplier on ${ctx.brand}.`;
    return base.length + fallback.length <= 160 ? base + fallback : base;
  }

  function reviewSignalSentence(l: Listing): string | null {
    const r = l.rating;
    const c = l.review_count;
    if (!r || !c) {
      return "There's no Google review signal on this listing yet — either they're newer to Google's index or they operate in a niche where customers don't review publicly.";
    }

    const region = l.state ? REGIONS[l.state] : null;
    const industryName = verticalName(l).toLowerCase() || 'B2B supplier';
    const ctxPhrase = region ? `for ${industryName} in ${region}` : `for ${industryName} in Malaysia`;

    if (c < 5) {
      return `Their Google profile shows ${c} review${c === 1 ? '' : 's'} at ${r.toFixed(1)}★ — too thin a sample ${ctxPhrase} to draw firm conclusions from.`;
    }
    if (r >= 4.7 && c >= 100) {
      return `Their Google profile carries ${c.toLocaleString()} reviews at ${r.toFixed(1)}★ — an unusually strong signal ${ctxPhrase}, with consistent feedback over a deep history.`;
    }
    if (r >= 4.5 && c >= 50) {
      return `${c.toLocaleString()} Google reviews at ${r.toFixed(1)}★ — a solid track record ${ctxPhrase}.`;
    }
    if (r >= 4.5) {
      return `${r.toFixed(1)}★ across ${c} Google reviews — small sample but consistently positive ${ctxPhrase}.`;
    }
    if (r >= 4.0) {
      return `${r.toFixed(1)}★ across ${c.toLocaleString()} Google reviews — mostly positive but worth reading the recent ones before contracting.`;
    }
    return `${r.toFixed(1)}★ across ${c.toLocaleString()} Google reviews — mixed feedback, read recent reviews and verify directly before committing.`;
  }

  function serviceBreadthSentence(l: Listing): string | null {
    const tags = (l.tags || []).filter((t) => t && t.trim());
    if (tags.length === 0) return null;
    if (tags.length === 1) {
      return `Their Google listing is filed specifically under "${tags[0]}" — narrow specialisation.`;
    }
    if (tags.length === 2) {
      return `Listed under "${tags[0]}" and "${tags[1]}" — moderate service breadth.`;
    }
    const head = tags.slice(0, 2).map((t) => `"${t}"`).join(', ');
    const restCount = tags.length - 2;
    return `Filed under ${head}, and ${restCount} more category${restCount === 1 ? '' : ' tags'} — broader service mix than typical for the vertical.`;
  }

  function schedulePatternSentence(hours?: { day: string; hours: string }[]): string | null {
    if (!hours || hours.length === 0) return null;
    const closedDays = hours.filter((h) => /closed/i.test(h.hours || ''));
    if (closedDays.length === 0) return 'Open seven days a week — operational schedule, not professional-services.';
    if (closedDays.length === 1) return 'Six-day operation, closed Sundays.';
    if (
      closedDays.length === 2 &&
      closedDays.some((h) => /saturday/i.test(h.day)) &&
      closedDays.some((h) => /sunday/i.test(h.day))
    ) {
      return 'Standard weekday hours — Mon to Fri.';
    }
    if (closedDays.length >= 3) {
      return 'Limited operating days — check the hours table below before visiting.';
    }
    return null;
  }

  /**
   * Editorial paragraph(s) for the "Why consider them" section.
   * Returns 1–2 paragraphs, ~80–150 words total. Composed from real signals only.
   */
  function editorialAngle(l: Listing): string[] {
    const paragraphs: string[] = [];

    // -------- Paragraph 1: review signal + service breadth + schedule
    const p1: string[] = [];
    const reviewLine = reviewSignalSentence(l);
    if (reviewLine) p1.push(reviewLine);

    const breadthLine = serviceBreadthSentence(l);
    if (breadthLine) p1.push(breadthLine);

    const scheduleLine = schedulePatternSentence(l.meta?.opening_hours);
    if (scheduleLine) p1.push(scheduleLine);

    if (p1.length > 0) paragraphs.push(p1.join(' '));

    // -------- Paragraph 2: practical guidance + provenance
    const p2: string[] = [];
    // Resolved against the vertical this listing occupies ON THIS SITE, so a
    // spin-off never hands out another vertical's buying advice.
    const guidance = ctx.guidance(l, siteVertical(l, ctx));
    if (guidance) p2.push(guidance);

    if (l.website) {
      p2.push("Their own website is the best source for current capability — the link is in the contact block on the right.");
    } else {
      p2.push("No public website on record — phone or WhatsApp is the primary route to confirm services and pricing.");
    }

    if (p2.length > 0) paragraphs.push(p2.join(' '));

    return paragraphs;
  }

  /**
   * Single-string blurb — used as fallback for places that need flat text
   * (LocalBusiness schema description, OG description, etc.).
   */
  function autoBlurb(l: Listing): string {
    const parts: string[] = [oneLiner(l)];
    const angle = editorialAngle(l);
    if (angle.length > 0) parts.push(angle.join(' '));
    return parts.join(' ');
  }

  return {
    getAllListings,
    getListingBySlug,
    getListingsByIndustry,
    getFeaturedListings,
    getTopListingsForIndustry,
    getIndustryCounts,
    getStateBuckets,
    getStatesForIndustry,
    getListingsByIndustryAndState,
    getIndustryStateCombos,
    withBrandSuffix,
    oneLiner,
    metaDescription,
    editorialAngle,
    autoBlurb,
    siteVertical: (l: Listing) => siteVertical(l, ctx),
  };
}
