import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import neo4j from "neo4j-driver";
import * as schema from "./src/db/schema";
import "dotenv/config";

// Postgres Connection
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
	throw new Error("POSTGRES_URL is missing from environment variables");
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Memgraph Connection
const memgraphUrl = process.env.MEMGRAPH_URL || "bolt://localhost:7687";
const memgraphUser = process.env.MEMGRAPH_USER || "memgraph";
const memgraphPassword = process.env.MEMGRAPH_PASSWORD || "memgraph";

export const memgraphDriver = neo4j.driver(
	memgraphUrl,
	neo4j.auth.basic(memgraphUser, memgraphPassword),
);

export const verifyConnections = async () => {
	try {
		// Test Postgres
		await client`SELECT 1`;
		console.log("✅ Postgres connected");

		// Test Memgraph
		const session = memgraphDriver.session();
		await session.run("RETURN 1");
		await session.close();
		console.log("✅ Memgraph connected");
	} catch (error) {
		console.error("❌ Database connection failed:", error);
	}
};
