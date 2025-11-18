import {
	pgTable,
	text,
	timestamp,
	uuid,
	integer,
	doublePrecision,
	jsonb,
	boolean,
	bigserial,
	numeric,
} from "drizzle-orm/pg-core";

// 2.1. Episodes & messages

export const agent = pgTable("agent", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

export const episode = pgTable("episode", {
	id: uuid("id").primaryKey().defaultRandom(),
	agentId: uuid("agent_id").references(() => agent.id),
	startedAt: timestamp("started_at").defaultNow(),
	endedAt: timestamp("ended_at"),
	kind: text("kind"), // "chat", "task", "reflection_cycle"
	summary: text("summary"),
	moodVector: doublePrecision("mood_vector").array(), // [valence, arousal]
});

export const message = pgTable("message", {
	id: uuid("id").primaryKey().defaultRandom(),
	episodeId: uuid("episode_id").references(() => episode.id),
	role: text("role"), // "user", "assistant", "system", "tool"
	createdAt: timestamp("created_at").defaultNow(),
	content: text("content"),
	tokenCount: integer("token_count"),
	meta: jsonb("meta"), // arbitrary extra info
});

// 2.2. Reflections & "lessons"

export const reflection = pgTable("reflection", {
	id: uuid("id").primaryKey().defaultRandom(),
	episodeId: uuid("episode_id").references(() => episode.id),
	createdAt: timestamp("created_at").defaultNow(),
	title: text("title"),
	body: text("body"),
	qualityScore: numeric("quality_score"), // 0–1: internal self-rating
	tags: text("tags").array(),
	meta: jsonb("meta"),
});

export const lesson = pgTable("lesson", {
	id: uuid("id").primaryKey().defaultRandom(),
	reflectionId: uuid("reflection_id").references(() => reflection.id),
	statement: text("statement"), // “When X happens, I should Y”
	status: text("status"), // "proposed", "adopted", "deprecated"
	createdAt: timestamp("created_at").defaultNow(),
});

// 2.3. Behavior monitoring

export const behaviorEvent = pgTable("behavior_event", {
	id: uuid("id").primaryKey().defaultRandom(),
	episodeId: uuid("episode_id").references(() => episode.id),
	createdAt: timestamp("created_at").defaultNow(),
	kind: text("kind"), // "overlong_response", "tool_fail", "toxicity_flag"
	severity: integer("severity"), // 1–5
	detector: text("detector"), // "self", "rule", "human"
	description: text("description"),
	meta: jsonb("meta"),
});

export const behaviorMetric = pgTable("behavior_metric", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	agentId: uuid("agent_id").references(() => agent.id),
	ts: timestamp("ts").defaultNow(),
	name: text("name"), // "tool_success_rate", "avg_tokens"
	value: numeric("value"),
	window: text("window"), // "episode", "1h", "24h"
	meta: jsonb("meta"),
});

// 4.1. Meta-schema tables

export const schemaObject = pgTable("schema_object", {
	id: uuid("id").primaryKey().defaultRandom(),
	kind: text("kind"), // "pg_table", "pg_column", "mg_label", "mg_rel_type"
	name: text("name"), // e.g. "behavior_event", "Message"
	parentName: text("parent_name"), // e.g. table name for a column
	version: integer("version").default(1),
	spec: jsonb("spec"), // shape, constraints, examples
	createdAt: timestamp("created_at").defaultNow(),
	createdBy: text("created_by"), // "slopbot", "human"
	status: text("status"), // "active", "deprecated"
});

export const schemaProposal = pgTable("schema_proposal", {
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at").defaultNow(),
	createdBy: text("created_by"), // "slopbot"
	motivation: text("motivation"), // natural language explanation
	impactSummary: text("impact_summary"),
	pgSql: text("pg_sql"), // proposed migration(s)
	mgCypher: text("mg_cypher"), // proposed label/rel changes
	status: text("status"), // "draft", "pending_review", "approved", "rejected", "applied"
	reviewNotes: text("review_notes"),
});

export const schemaMigrationLog = pgTable("schema_migration_log", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	proposalId: uuid("proposal_id").references(() => schemaProposal.id),
	appliedAt: timestamp("applied_at").defaultNow(),
	appliedBy: text("applied_by"), // "slopbot", "human"
	success: boolean("success"),
	errorMessage: text("error_message"),
});
