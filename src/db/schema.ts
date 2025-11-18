import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	discordId: text("discord_id").notNull().unique(),
	username: text("username"),
	createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
	id: serial("id").primaryKey(),
	userId: text("user_id").references(() => users.discordId),
	content: text("content").notNull(),
	response: text("response"),
	createdAt: timestamp("created_at").defaultNow(),
});
