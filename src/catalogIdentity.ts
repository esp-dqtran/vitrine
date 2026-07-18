export interface CatalogIdentityJob {
  mobbinId: string;
  slug: string;
  platform: string;
  status?: string;
  repair?: unknown;
}

const key = (slug: string, platform: string) => `${slug}\u0000${platform}`;

export function disambiguateCatalogSlugs<T extends CatalogIdentityJob>(jobs: readonly T[]): T[] {
  const result = jobs.map((job) => ({ ...job }));
  const groups = new Map<string, T[]>();
  for (const job of result) {
    const groupKey = key(job.slug, job.platform);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), job]);
  }
  const reserved = new Set<string>();

  for (const group of groups.values()) {
    group.sort((left, right) => {
      const leftImported = left.status !== "pending" || left.repair != null;
      const rightImported = right.status !== "pending" || right.repair != null;
      return Number(rightImported) - Number(leftImported) || left.mobbinId.localeCompare(right.mobbinId);
    });
    reserved.add(key(group[0]!.slug, group[0]!.platform));
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const base = group[0]!.slug;
    for (const job of group.slice(1)) {
      let attempt = 1;
      let slug: string;
      do {
        const suffix = attempt === 1 ? job.mobbinId : `${job.mobbinId}-${attempt}`;
        slug = `${base.slice(0, Math.max(1, 79 - suffix.length))}-${suffix}`;
        attempt++;
      } while (reserved.has(key(slug, job.platform)));
      job.slug = slug;
      reserved.add(key(slug, job.platform));
    }
  }

  return result;
}
