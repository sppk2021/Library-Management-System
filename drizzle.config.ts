import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/librarydb.ts",
  out: "./drizzle",
  dbCredentials: {
    url: (process.env.DATABASE_URL || "mysql://root:password@localhost:3306/library").replace("?ssl-mode=REQUIRED", ""),
  },
});
