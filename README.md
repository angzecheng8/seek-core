# @seek/core

Shared data layer for the Seek directory network. Consumed by seekbusiness.my and
every spin-off (seekfactory, seekbuild, seektraining, seektech, seekmarketing).

One Supabase-derived foundation renders as a different directory on each domain.
A site supplies a `SiteContext`; this package supplies everything that reads from
it — query, copy generation, JSON-LD, state reference data.

**Nothing visual lives here.** No components, no palette, no editorial copy, so
each site's design and voice can diverge completely. That separation is
deliberate: twelve sites off one database sharing a page tree and a country would
read as a doorway network if they also shared type and palette.

## Install

```
npm install github:Osp-Digital/seek-core#v0.1.0
```

`prepare` runs `tsc` on install, so consumers get `dist/` without it being
committed.

## Use

```ts
import { createDataLayer } from '@seek/core';
import { site } from '../../site.config';

const layer = createDataLayer(site);
export const { getAllListings, getListingsByIndustry, oneLiner } = layer;
```

## The one rule

`getListingsByIndustry` filters on `industries[]` containment, never the scalar
`industry`. The scalar holds only the primary vertical and hides every
multi-vertical business from all but one site — 3,228 lost listing-appearances
across the network when this was last wrong.
