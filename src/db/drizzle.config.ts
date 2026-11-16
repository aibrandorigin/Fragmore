import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Cloud SQL is disabled — Firebase Firestore is the primary persistence database.
// This schema definition file is retained for TypeScript schema metadata only.
dotenv.config();

const sqlHost = process.env.SQL_HOST || "disabled";
const sqlDbName = process.env.SQL_DB_NAME || "disabled";
const user = process.env.SQL_ADMIN_USER || "disabled";
const password = process.env.SQL_ADMIN_PASSWORD || "";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: sqlHost,
    user,
    password,
    database: sqlDbName,
    ssl: false,
  },
  verbose: false,
});

