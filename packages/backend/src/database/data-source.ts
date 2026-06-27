import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false, // NEVER use synchronize in production
  logging: process.env.LOG_LEVEL === 'debug',
  migrations: [join(__dirname, './migrations/*.{ts,js}')],
  entities: [join(__dirname, '../modules/**/*.entity.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  poolSize: process.env.NODE_ENV === 'production' ? 20 : 5,
  maxQueryExecutionTime: 30000, // Log queries taking >30s
  timezone: 'UTC',
});

// Initialize data source
export async function initializeDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}

// Run migrations on startup
export async function runMigrations() {
  await initializeDataSource();
  await AppDataSource.runMigrations();
}
