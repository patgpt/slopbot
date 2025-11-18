"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaMigrationLog = exports.schemaProposal = exports.schemaObject = exports.behaviorMetric = exports.behaviorEvent = exports.lesson = exports.reflection = exports.message = exports.episode = exports.agent = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// 2.1. Episodes & messages
exports.agent = (0, pg_core_1.pgTable)("agent", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)("name").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.episode = (0, pg_core_1.pgTable)("episode", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    agentId: (0, pg_core_1.uuid)("agent_id").references(() => exports.agent.id),
    startedAt: (0, pg_core_1.timestamp)("started_at").defaultNow(),
    endedAt: (0, pg_core_1.timestamp)("ended_at"),
    kind: (0, pg_core_1.text)("kind"), // "chat", "task", "reflection_cycle"
    summary: (0, pg_core_1.text)("summary"),
    moodVector: (0, pg_core_1.doublePrecision)("mood_vector").array(), // [valence, arousal]
});
exports.message = (0, pg_core_1.pgTable)("message", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    episodeId: (0, pg_core_1.uuid)("episode_id").references(() => exports.episode.id),
    role: (0, pg_core_1.text)("role"), // "user", "assistant", "system", "tool"
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    content: (0, pg_core_1.text)("content"),
    tokenCount: (0, pg_core_1.integer)("token_count"),
    meta: (0, pg_core_1.jsonb)("meta"), // arbitrary extra info
});
// 2.2. Reflections & "lessons"
exports.reflection = (0, pg_core_1.pgTable)("reflection", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    episodeId: (0, pg_core_1.uuid)("episode_id").references(() => exports.episode.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    title: (0, pg_core_1.text)("title"),
    body: (0, pg_core_1.text)("body"),
    qualityScore: (0, pg_core_1.numeric)("quality_score"), // 0–1: internal self-rating
    tags: (0, pg_core_1.text)("tags").array(),
    meta: (0, pg_core_1.jsonb)("meta"),
});
exports.lesson = (0, pg_core_1.pgTable)("lesson", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    reflectionId: (0, pg_core_1.uuid)("reflection_id").references(() => exports.reflection.id),
    statement: (0, pg_core_1.text)("statement"), // “When X happens, I should Y”
    status: (0, pg_core_1.text)("status"), // "proposed", "adopted", "deprecated"
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// 2.3. Behavior monitoring
exports.behaviorEvent = (0, pg_core_1.pgTable)("behavior_event", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    episodeId: (0, pg_core_1.uuid)("episode_id").references(() => exports.episode.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    kind: (0, pg_core_1.text)("kind"), // "overlong_response", "tool_fail", "toxicity_flag"
    severity: (0, pg_core_1.integer)("severity"), // 1–5
    detector: (0, pg_core_1.text)("detector"), // "self", "rule", "human"
    description: (0, pg_core_1.text)("description"),
    meta: (0, pg_core_1.jsonb)("meta"),
});
exports.behaviorMetric = (0, pg_core_1.pgTable)("behavior_metric", {
    id: (0, pg_core_1.bigserial)("id", { mode: "number" }).primaryKey(),
    agentId: (0, pg_core_1.uuid)("agent_id").references(() => exports.agent.id),
    ts: (0, pg_core_1.timestamp)("ts").defaultNow(),
    name: (0, pg_core_1.text)("name"), // "tool_success_rate", "avg_tokens"
    value: (0, pg_core_1.numeric)("value"),
    window: (0, pg_core_1.text)("window"), // "episode", "1h", "24h"
    meta: (0, pg_core_1.jsonb)("meta"),
});
// 4.1. Meta-schema tables
exports.schemaObject = (0, pg_core_1.pgTable)("schema_object", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    kind: (0, pg_core_1.text)("kind"), // "pg_table", "pg_column", "mg_label", "mg_rel_type"
    name: (0, pg_core_1.text)("name"), // e.g. "behavior_event", "Message"
    parentName: (0, pg_core_1.text)("parent_name"), // e.g. table name for a column
    version: (0, pg_core_1.integer)("version").default(1),
    spec: (0, pg_core_1.jsonb)("spec"), // shape, constraints, examples
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    createdBy: (0, pg_core_1.text)("created_by"), // "slopbot", "human"
    status: (0, pg_core_1.text)("status"), // "active", "deprecated"
});
exports.schemaProposal = (0, pg_core_1.pgTable)("schema_proposal", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    createdBy: (0, pg_core_1.text)("created_by"), // "slopbot"
    motivation: (0, pg_core_1.text)("motivation"), // natural language explanation
    impactSummary: (0, pg_core_1.text)("impact_summary"),
    pgSql: (0, pg_core_1.text)("pg_sql"), // proposed migration(s)
    mgCypher: (0, pg_core_1.text)("mg_cypher"), // proposed label/rel changes
    status: (0, pg_core_1.text)("status"), // "draft", "pending_review", "approved", "rejected", "applied"
    reviewNotes: (0, pg_core_1.text)("review_notes"),
});
exports.schemaMigrationLog = (0, pg_core_1.pgTable)("schema_migration_log", {
    id: (0, pg_core_1.bigserial)("id", { mode: "number" }).primaryKey(),
    proposalId: (0, pg_core_1.uuid)("proposal_id").references(() => exports.schemaProposal.id),
    appliedAt: (0, pg_core_1.timestamp)("applied_at").defaultNow(),
    appliedBy: (0, pg_core_1.text)("applied_by"), // "slopbot", "human"
    success: (0, pg_core_1.boolean)("success"),
    errorMessage: (0, pg_core_1.text)("error_message"),
});
