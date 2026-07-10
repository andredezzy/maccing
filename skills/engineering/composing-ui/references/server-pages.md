# Server pages — composition at page level

React Server Components / Next.js App Router flavored — principles generalize to any server-first framework with a hydration seam.

## The page recipe

A page IS, in order: metadata export; await params and parse search params through the route's colocated definition; resolve ids via request-cached auth helpers; fire-and-forget prefetch of every section's query — never awaited; a hydration boundary wrapping a thin layout that composes named parts from the route's local folder.

```tsx
// app/settings/members/page.tsx
export const metadata = { title: "Members" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = membersSearchParams.parse(await searchParams);
  const { orgId } = await getSessionContext(); // request-cached, not re-checked

  prefetch(trpc.members.list.queryOptions({ ...filters, orgId }));
  prefetch(trpc.members.stats.queryOptions({ orgId }));

  return (
    <HydrateClient>
      <MembersScreen />
    </HydrateClient>
  );
}
```

`MembersScreen` composes `MembersStats`, `MembersFilters`, `MembersTable` — named parts, screen-level composition, same as any other compound.

## The seam

Data crosses server to client through the hydrated query cache, not through props. Props carry only serializable primitives — ids, slugs, enums, parsed filters. A fetched dataset in a prop crossing the seam is the violation: the client part re-reads the SAME query via `queryOptions` inside a suspense query, so the data it renders always comes from its own read, never from a parent's fetch.

Exception: standalone pages outside the app shell — auth, public marketing, onboarding — await fetches directly and pass results as props. They're still server components; there's no hydrated cache to seed because there's no client tree reading it.

## Cache-key parity

HARD invariant: the prefetch's query args byte-match the client's query args — limit, orderBy, every default included. Drift here doesn't error, it silently misses: hydration finds no matching cache entry, the client re-fetches from scratch, and the page double-fetches and flashes. Keep one source of truth for the options object and pass it to both sides instead of reconstructing it twice. Hydration also needs a nonzero `staleTime` — with the default 0 the matched entry is instantly stale and silently refetches on mount.

## Loading granularity

Loading IS a per-section Suspense boundary with a colocated skeleton that mirrors the real component's structure — skeleton the values, never the static labels. Never a route-level `loading.tsx`, never one boundary for the whole screen: either collapses every section to a single flash on any filter or pagination change. Refetches keep the previous data on screen with an overlay; only the very first load shows skeletons. Suspense queries drop `keepPreviousData` in TanStack v5, so query-arg changes must be wrapped in `startTransition` (or `useDeferredValue`) to keep previous data on screen — or the section self-manages with a non-suspense query, `placeholderData: keepPreviousData`, and an overlay.

## Guards live in layouts

Auth redirects, role gates, and inverse guards (a signed-in user hitting `/login`) are layout work — pages never re-check what the layout already enforced. Request-scoped `cache()` dedupes the session/tenant lookup between layout and page into one call.

## Search params

One colocated definition per route, two consumers: the server parses it for prefetch and props, the client reads and writes state through the same parser object — never a second, hand-rolled parse.
