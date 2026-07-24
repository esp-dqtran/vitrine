export interface RecordedQuery {
  sql: string;
  params: readonly unknown[];
}

export interface ScriptedResult {
  rows?: unknown[];
  rowCount?: number | null;
  error?: Error;
}

export function createRecordingDatabase(script: ScriptedResult[]) {
  const calls: RecordedQuery[] = [];
  let releases = 0;

  const query = async <Row>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: Row[]; rowCount: number | null }> => {
    calls.push({ sql, params });
    if (/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    const next = script.shift() ?? { rows: [], rowCount: 0 };
    if (next.error) throw next.error;
    return {
      rows: (next.rows ?? []) as Row[],
      rowCount: next.rowCount ?? next.rows?.length ?? 0,
    };
  };

  const client = {
    query,
    release: () => {
      releases += 1;
    },
  };
  const pool = {
    query,
    connect: async () => client,
  };

  return {
    calls,
    query,
    client,
    pool,
    get releases() {
      return releases;
    },
  };
}
