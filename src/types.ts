// Shared record shapes for the Seek directory network.
//
// Only what every site needs. Deliberately excluded: IndustryMeta's `blurb` and
// `tints`, and StateMeta's `blurb` — those are editorial copy and palette, which
// must differ per site or the network duplicates itself. See plan §4.

export interface Listing {
  slug: string;
  name: string;
  description?: string;
  excerpt?: string;
  category?: string;
  /** Primary sub-vertical, e.g. "commercial-printing". From scripts/taxonomy.yaml. */
  subcategory?: string;
  /** Primary vertical. Always an `status: active` vertical — drives page routing. */
  industry: string;
  /**
   * Every vertical this business belongs to, primary first. A print shop that
   * also does signage and graphic design carries several. This is the field a
   * spin-off site (seekfactory, seekmarketing) filters on — `industry` alone
   * would hide the business from every site but one.
   */
  industries?: string[];
  /** Matched "vertical:sub_vertical" pairs, e.g. ["printing-media:signage"]. */
  sub_verticals?: string[];
  tags?: string[];
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  images?: string[];
  rating?: number;
  review_count?: number;
  featured?: boolean;
  verified?: boolean;
  active?: boolean;
  sponsored?: boolean;
  sponsored_order?: number | null;
  meta?: {
    opening_hours?: { day: string; hours: string }[];
    gm_descrip?: string;
    [k: string]: any;
  };
}

export interface StateBucket {
  state: string;
  count: number;
}
