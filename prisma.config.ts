import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon (via Vercel) adds a direct, unpooled URL; migrations need it.
    url: process.env.DATABASE_URL_UNPOOLED ?? env("DATABASE_URL"),
    // Needed with `prisma dev`, which serves a single database per port.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
