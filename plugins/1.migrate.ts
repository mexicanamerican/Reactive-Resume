import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { definePlugin } from "nitro";
import { Pool } from "pg";
import pino from "pino";

const log = pino({ name: "migrate" });

async function migrateDatabase() {
  log.info("Running database migrations...");

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    log.info("Database migrations completed");
  } catch (error) {
    log.error({ err: error }, "Database migrations failed");
    throw error;
  } finally {
    await pool.end();
  }
}

export default definePlugin(async () => {
  await migrateDatabase();
});
