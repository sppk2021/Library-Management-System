/**
 * ============================================================================
 * DATABASE BACKUP (export everything as one .sql file)
 * ============================================================================
 *
 * Builds a plain-text SQL script that contains:
 *   1. DROP + CREATE TABLE statements for every table, and
 *   2. an INSERT statement for every row of data.
 *
 * Running this script on any MySQL / MariaDB server (for example with
 * phpMyAdmin → Import) rebuilds the library exactly as it was at backup time.
 * This is how the admin "Download backup" button protects data against loss
 * (proposal objective: "secure data from loss... with backup methods").
 * ============================================================================
 */
import type { Pool } from 'mysql2/promise';
import { TABLE_DEFINITIONS } from './database.js';

export async function buildSqlBackup(pool: Pool): Promise<string> {
  const lines: string[] = [
    '-- ==========================================================',
    '-- Centralized Library Management System - MySQL backup',
    `-- Created: ${new Date().toISOString()}`,
    '-- Restore: phpMyAdmin > select database > Import > choose this file',
    '--      or: mysql -u root -p library_db < this_file.sql',
    '-- ==========================================================',
    '',
    'SET NAMES utf8mb4;',
    "SET time_zone = '+00:00';",
    // Turn foreign key checks off while restoring, so tables can be dropped/filled in any order.
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
  ];

  // Drop tables in reverse order (children first), then create them again.
  for (const table of [...TABLE_DEFINITIONS].reverse()) {
    lines.push(`DROP TABLE IF EXISTS \`${table.name}\`;`);
  }
  lines.push('');
  for (const table of TABLE_DEFINITIONS) {
    lines.push(`${table.sql.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE')};`, '');
  }

  // Copy every row as an INSERT statement.
  for (const table of TABLE_DEFINITIONS) {
    const [rows] = await pool.query(`SELECT * FROM \`${table.name}\``);
    const dataRows = rows as Record<string, unknown>[];
    if (dataRows.length === 0) continue;

    lines.push(`-- Data for table ${table.name} (${dataRows.length} rows)`);
    const columns = Object.keys(dataRows[0]);
    const columnList = columns.map((c) => `\`${c}\``).join(', ');
    for (const row of dataRows) {
      // pool.escape() safely quotes text and formats dates, so names like O'Brien don't break the SQL.
      const values = columns.map((c) => pool.escape(row[c])).join(', ');
      lines.push(`INSERT INTO \`${table.name}\` (${columnList}) VALUES (${values});`);
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;', '');
  return lines.join('\n');
}
