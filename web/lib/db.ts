import { Pool, type QueryResult, type QueryResultRow } from "pg";
import type { PoolClient } from "pg";

export type { PoolClient };

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const { getConfig } = require("./config");
  const config = getConfig();
  const connectionString = config.DATABASE_URL.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
  pool = new Pool({
    connectionString,
    ssl: config.DATABASE_URL_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

export function closePool(): void {
  if (pool) {
    pool.end();
    pool = null;
  }
}

export type QueryConfig = {
  text: string;
  values?: unknown[];
};

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  client?: PoolClient
): Promise<T[]> {
  const target = client || (await getPool().connect());
  const ownClient = !client;
  try {
    const result: QueryResult<T> = await target.query(sql, params);
    return result.rows as unknown as T[];
  } finally {
    if (ownClient) target.release();
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  client?: PoolClient
): Promise<T | null> {
  const rows = await query<T>(sql, params, client);
  return rows.length > 0 ? (rows[0] as T) : null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
