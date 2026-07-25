# Random Taxonomy Hover Previews

## Goal

Show a different eligible published example whenever a user hovers an Apps
taxonomy item, without adding polling or a network request to every hover.

## User Experience

- Categories show a randomly selected published app icon.
- Screens show a randomly selected published screen image.
- UI Elements show a randomly selected published component crop.
- Flows show a randomly selected published three-step sequence.
- Returning to the same taxonomy item selects again and avoids the immediately
  previous app when at least two candidates are available.
- A one-candidate pool remains stable. An empty pool shows nothing.
- Existing GSAP entrance, cursor offset, viewport clamping, flow sequencing,
  coarse-pointer behavior, and reduced-motion behavior remain unchanged.

## Architecture

### Public preview API

The public facet-preview endpoint returns a bounded pool of at most six
published candidates for one exact platform, group, and value. Every candidate
uses the existing safe metadata contract:

- kind
- app
- label
- icon URL
- bounded protected media URLs

The endpoint exposes no database IDs, object keys, or storage credentials.
Candidate media continues through the existing app-scoped public facet-media
route.

The store selects a bounded set of distinct eligible apps in a stable order.
Random selection happens in the client and does not require an unbounded
database-wide random sort.

### Client cache and selection

The client performs one lazy request for each platform/group/value key and
caches the resulting promise and candidate pool. It does not preload taxonomy
media and does not poll.

Each pointer entry selects one candidate from the cached pool. Selection uses an
injectable random source in the pure selection helper so behavior is testable.
The helper excludes the immediately previous app when another candidate exists.
The previous app is tracked independently for each platform/group/value key.

The selected candidate is passed to the existing GSAP hover renderer. No motion
or media rendering contract changes are required.

## Failure Handling

- A 404 response becomes an empty cached pool.
- A malformed successful response becomes an empty cached pool.
- Transient request failures are not cached, allowing a later hover to retry.
- A stale request cannot reopen the preview after pointer leave or platform
  change.

## Testing

- Store tests prove bounded distinct candidate selection and safe media counts.
- API tests prove the public pool response and protected media URLs.
- Client tests prove lazy request deduplication, random selection, immediate
  repeat avoidance, single-candidate fallback, and retry after request failure.
- Existing GSAP, viewport clamping, reduced-motion, filtering, and public/private
  route tests remain green.

## Scope

This change affects only Apps taxonomy hover preview selection. It does not
change taxonomy filtering, app publication, catalog pagination, authentication,
detail privacy, or crawler/admin job monitoring.
