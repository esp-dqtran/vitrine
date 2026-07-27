import type { QueryResult } from "pg";

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface CategorySummary extends Category {
  appCount: number;
}

export interface CategoryApp {
  id: number;
  slug: string;
  name: string;
}

export type CategoryQuery = (
  sql: string,
  values?: readonly unknown[],
) => Promise<QueryResult<any>>;

export type CategoryTransaction = <T>(
  work: (query: CategoryQuery) => Promise<T>,
) => Promise<T>;

export class CategoryValidationError extends Error {}
export class CategoryConflictError extends Error {}
export class CategoryNotFoundError extends Error {}

function categoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
  };
}

function categorySummaryFromRow(row: Record<string, unknown>): CategorySummary {
  return {
    ...categoryFromRow(row),
    appCount: Number(row.app_count),
  };
}

function slugFromName(name: string): string {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    throw new CategoryValidationError("category name cannot form a slug");
  }
  return slug;
}

function normalizedNames(rawNames: string[]): string[] {
  const names = new Map<string, string>();
  for (const rawName of rawNames) {
    const name = rawName.trim();
    const key = name.toLowerCase();
    if (name && !names.has(key)) names.set(key, name);
  }
  return [...names.values()].sort((left, right) => left.localeCompare(right));
}

function positiveId(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CategoryValidationError(`invalid ${label}`);
  }
  return value;
}

export function parseCategoryInput(
  value: unknown,
): { name: string; slug: string } {
  const input = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (!name || name.length > 100) {
    throw new CategoryValidationError("invalid category name");
  }
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || slug.length > 100
  ) {
    throw new CategoryValidationError("invalid category slug");
  }
  return { name, slug };
}

function conflict(error: unknown): never {
  if ((error as { code?: string }).code === "23505") {
    throw new CategoryConflictError("category name or slug already exists");
  }
  throw error;
}

export function createCategoryStore(
  runQuery: CategoryQuery,
  runTransaction: CategoryTransaction,
) {
  return {
    async list(): Promise<CategorySummary[]> {
      const response = await runQuery(
        `SELECT c.id, c.name, c.slug,
           COUNT(DISTINCT ac.app_id)::integer AS app_count
         FROM categories c
         LEFT JOIN app_categories ac ON ac.category_id = c.id
         GROUP BY c.id, c.name, c.slug
         ORDER BY lower(c.name), c.id`,
      );
      return response.rows.map(categorySummaryFromRow);
    },

    async listPublished(): Promise<CategorySummary[]> {
      const response = await runQuery(
        `SELECT c.id, c.name, c.slug,
           COUNT(DISTINCT published.app_id)::integer AS app_count
         FROM categories c
         JOIN app_categories ac ON ac.category_id = c.id
         JOIN (
           SELECT DISTINCT app_id
           FROM app_versions
           WHERE published_at IS NOT NULL
         ) published ON published.app_id = ac.app_id
         GROUP BY c.id, c.name, c.slug
         HAVING COUNT(DISTINCT published.app_id) > 0
         ORDER BY lower(c.name), c.id`,
      );
      return response.rows.map(categorySummaryFromRow);
    },

    async create(input: { name: string; slug: string }): Promise<Category> {
      const value = parseCategoryInput(input);
      try {
        const response = await runQuery(
          `INSERT INTO categories (name, slug)
           VALUES ($1, $2)
           RETURNING id, name, slug`,
          [value.name, value.slug],
        );
        return categoryFromRow(response.rows[0]);
      } catch (error) {
        return conflict(error);
      }
    },

    async update(
      rawId: number,
      input: { name: string; slug: string },
    ): Promise<Category> {
      const id = positiveId(rawId, "category id");
      const value = parseCategoryInput(input);
      try {
        const response = await runQuery(
          `UPDATE categories
           SET name = $2, slug = $3
           WHERE id = $1
           RETURNING id, name, slug`,
          [id, value.name, value.slug],
        );
        if (!response.rows[0]) {
          throw new CategoryNotFoundError("category not found");
        }
        return categoryFromRow(response.rows[0]);
      } catch (error) {
        if (error instanceof CategoryNotFoundError) throw error;
        return conflict(error);
      }
    },

    async remove(
      rawId: number,
    ): Promise<{ category: Category; removedAppCount: number }> {
      const id = positiveId(rawId, "category id");
      return runTransaction(async (tx) => {
        const existing = await tx(
          `SELECT id, name, slug
           FROM categories
           WHERE id = $1
           FOR UPDATE`,
          [id],
        );
        if (!existing.rows[0]) {
          throw new CategoryNotFoundError("category not found");
        }
        const count = await tx(
          `SELECT count(*)::integer AS app_count
           FROM app_categories
           WHERE category_id = $1`,
          [id],
        );
        await tx("DELETE FROM categories WHERE id = $1", [id]);
        return {
          category: categoryFromRow(existing.rows[0]),
          removedAppCount: Number(count.rows[0]?.app_count ?? 0),
        };
      });
    },

    async listApps(rawCategoryId: number): Promise<CategoryApp[]> {
      const categoryId = positiveId(rawCategoryId, "category id");
      const response = await runQuery(
        `SELECT a.id, a.name AS slug,
           COALESCE(a.display_name, a.name) AS name
         FROM app_categories ac
         JOIN apps a ON a.id = ac.app_id
         WHERE ac.category_id = $1
         ORDER BY lower(COALESCE(a.display_name, a.name)), a.id`,
        [categoryId],
      );
      return response.rows.map((row) => ({
        id: Number(row.id),
        slug: String(row.slug),
        name: String(row.name),
      }));
    },

    async attach(appSlugValue: string, rawCategoryId: number): Promise<void> {
      const appSlug = appSlugValue.trim();
      const categoryId = positiveId(rawCategoryId, "category id");
      if (!appSlug) throw new CategoryValidationError("invalid app slug");
      const parents = await runQuery(
        `SELECT
           (SELECT id FROM apps WHERE name = $1) AS app_id,
           (SELECT id FROM categories WHERE id = $2) AS category_id`,
        [appSlug, categoryId],
      );
      const row = parents.rows[0];
      if (!row?.app_id || !row?.category_id) {
        throw new CategoryNotFoundError("app or category not found");
      }
      await runQuery(
        `INSERT INTO app_categories (app_id, category_id)
         VALUES ($1, $2)
         ON CONFLICT (app_id, category_id) DO NOTHING`,
        [Number(row.app_id), Number(row.category_id)],
      );
    },

    async detach(appSlugValue: string, rawCategoryId: number): Promise<void> {
      const appSlug = appSlugValue.trim();
      const categoryId = positiveId(rawCategoryId, "category id");
      if (!appSlug) throw new CategoryValidationError("invalid app slug");
      const parents = await runQuery(
        `SELECT
           (SELECT id FROM apps WHERE name = $1) AS app_id,
           (SELECT id FROM categories WHERE id = $2) AS category_id`,
        [appSlug, categoryId],
      );
      const row = parents.rows[0];
      if (!row?.app_id || !row?.category_id) {
        throw new CategoryNotFoundError("app or category not found");
      }
      await runQuery(
        `DELETE FROM app_categories
         WHERE app_id = $1 AND category_id = $2`,
        [Number(row.app_id), Number(row.category_id)],
      );
    },

    async replaceAppCategories(
      rawAppId: number,
      rawIds: number[],
    ): Promise<void> {
      const appId = positiveId(rawAppId, "app id");
      const categoryIds = [...new Set(
        rawIds.map((id) => positiveId(id, "category id")),
      )].sort((left, right) => left - right);
      await runTransaction(async (tx) => {
        const existing = categoryIds.length
          ? await tx(
            `SELECT id
             FROM categories
             WHERE id = ANY($1::integer[])
             ORDER BY id`,
            [categoryIds],
          )
          : { rows: [] };
        if (existing.rows.length !== categoryIds.length) {
          throw new CategoryNotFoundError("category not found");
        }
        await tx(
          `DELETE FROM app_categories
           WHERE app_id = $1
             AND category_id <> ALL($2::integer[])`,
          [appId, categoryIds],
        );
        if (categoryIds.length) {
          await tx(
            `INSERT INTO app_categories (app_id, category_id)
             SELECT $1, unnest($2::integer[])
             ON CONFLICT (app_id, category_id) DO NOTHING`,
            [appId, categoryIds],
          );
        }
      });
    },

    async assignNames(
      rawAppId: number,
      rawNames: string[],
      options: { replace: boolean },
    ): Promise<Category[]> {
      const appId = positiveId(rawAppId, "app id");
      const names = normalizedNames(rawNames);
      return runTransaction(async (tx) => {
        const categories: Category[] = [];
        for (const name of names) {
          const found = await tx(
            `SELECT id, name, slug
             FROM categories
             WHERE lower(name) = lower($1)`,
            [name],
          );
          let category = found.rows[0]
            ? categoryFromRow(found.rows[0])
            : undefined;
          if (!category) {
            try {
              const inserted = await tx(
                `INSERT INTO categories (name, slug)
                 VALUES ($1, $2)
                 RETURNING id, name, slug`,
                [name, slugFromName(name)],
              );
              category = categoryFromRow(inserted.rows[0]);
            } catch (error) {
              conflict(error);
            }
          }
          categories.push(category);
        }
        const ids = categories.map(({ id }) => id);
        if (options.replace) {
          await tx(
            `DELETE FROM app_categories
             WHERE app_id = $1
               AND category_id <> ALL($2::integer[])`,
            [appId, ids],
          );
        }
        if (ids.length) {
          await tx(
            `INSERT INTO app_categories (app_id, category_id)
             SELECT $1, unnest($2::integer[])
             ON CONFLICT (app_id, category_id) DO NOTHING`,
            [appId, ids],
          );
        }
        return categories;
      });
    },
  };
}

export type CategoryStore = ReturnType<typeof createCategoryStore>;
