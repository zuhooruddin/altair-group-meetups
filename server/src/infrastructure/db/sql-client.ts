/**
 * The slice of node-postgres the infrastructure uses. pg.Pool satisfies it
 * as-is; tests can supply another Postgres (e.g. PGlite) behind the same shape.
 */
export interface SqlClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

export interface PooledSqlClient extends SqlClient {
  release(error?: Error | boolean): void;
}

export interface SqlPool {
  connect(): Promise<PooledSqlClient>;
}
