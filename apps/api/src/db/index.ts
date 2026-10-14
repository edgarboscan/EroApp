import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'erp_admin',
  password: process.env.DB_PASSWORD || 'SecurePassword_2026!',
  database: process.env.DB_NAME || 'ero_erp_db',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 20),
  queueLimit: 0,
  namedPlaceholders: true,
  dateStrings: true,
});

/**
 * Ejecuta una consulta SQL type-safe
 */
export async function query<T = any>(sql: string, params?: any): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/**
 * Ejecuta una transacción multi-consulta con rollback automático en caso de error
 */
export async function withTransaction<T>(callback: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
