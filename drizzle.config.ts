import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.POSTGRES_URL ||
			"postgres://postgres:postgres@localhost:5433/slopbot",
	},
});
