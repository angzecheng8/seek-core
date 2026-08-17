// Malaysian state reference data — slug, label, region.
//
// Facts only. Each site supplies its own `blurb` per state: 16 hub paragraphs
// repeated verbatim across 12 domains would be duplicate content on pages the
// network is trying to rank (plan §4).
//
// Order is meaningful — it drives state hub ordering and getStaticPaths output.

export type Region =
  | 'Klang Valley'
  | 'Northern'
  | 'Southern'
  | 'East Coast'
  | 'East Malaysia';

export interface StateBase {
  /** Display label, English-primary. e.g. "Kuala Lumpur" */
  name: string;
  /** URL slug. e.g. "kuala-lumpur" */
  slug: string;
  /** Bahasa Malaysia label where useful. e.g. "Pulau Pinang" */
  bahasa?: string;
  region: Region;
}

export const STATES_BASE: StateBase[] = [
  { name: 'Selangor', slug: 'selangor', region: 'Klang Valley' },
  { name: 'Kuala Lumpur', slug: 'kuala-lumpur', bahasa: 'Wilayah Persekutuan Kuala Lumpur', region: 'Klang Valley' },
  { name: 'Penang', slug: 'penang', bahasa: 'Pulau Pinang', region: 'Northern' },
  { name: 'Johor', slug: 'johor', region: 'Southern' },
  { name: 'Perak', slug: 'perak', region: 'Northern' },
  { name: 'Melaka', slug: 'melaka', bahasa: 'Melaka', region: 'Southern' },
  { name: 'Pahang', slug: 'pahang', region: 'East Coast' },
  { name: 'Sarawak', slug: 'sarawak', region: 'East Malaysia' },
  { name: 'Sabah', slug: 'sabah', region: 'East Malaysia' },
  { name: 'Kedah', slug: 'kedah', bahasa: 'Kedah Darul Aman', region: 'Northern' },
  { name: 'Perlis', slug: 'perlis', bahasa: 'Perlis Indera Kayangan', region: 'Northern' },
  { name: 'Negeri Sembilan', slug: 'negeri-sembilan', bahasa: 'Negeri Sembilan Darul Khusus', region: 'Southern' },
  { name: 'Terengganu', slug: 'terengganu', bahasa: 'Terengganu Darul Iman', region: 'East Coast' },
  { name: 'Kelantan', slug: 'kelantan', bahasa: 'Kelantan Darul Naim', region: 'East Coast' },
  { name: 'Putrajaya', slug: 'putrajaya', bahasa: 'Wilayah Persekutuan Putrajaya', region: 'Klang Valley' },
  { name: 'Labuan', slug: 'labuan', bahasa: 'Wilayah Persekutuan Labuan', region: 'East Malaysia' },
];

export const STATE_BASE_BY_SLUG: Record<string, StateBase> = Object.fromEntries(
  STATES_BASE.map((s) => [s.slug, s])
);

export const STATE_BASE_BY_NAME: Record<string, StateBase> = Object.fromEntries(
  STATES_BASE.map((s) => [s.name, s])
);

export function stateNameToSlug(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return STATE_BASE_BY_NAME[name]?.slug;
}
