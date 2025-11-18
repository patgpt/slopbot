import { configDotenv } from "dotenv";
import { Client, GatewayIntentBits, Partials, Message } from "discord.js";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { db } from "./db";
import { agent, episode, message as messageTable } from "./src/db/schema";
import { graph } from "./src/db/graph";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

configDotenv();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
	],
	partials: [Partials.Channel],
});

// Agent Identity
const AGENT_NAME = "Slopbot";
let agentId: string;

async function ensureAgent() {
	const existing = await db
		.select()
		.from(agent)
		.where(eq(agent.name, AGENT_NAME))
		.limit(1);
	if (existing.length > 0) {
		agentId = existing[0].id;
	} else {
		const newAgent = await db
			.insert(agent)
			.values({ name: AGENT_NAME })
			.returning();
		agentId = newAgent[0].id;
	}
	await graph.ensureAgent(agentId, AGENT_NAME);
	console.log(`Agent initialized: ${AGENT_NAME} (${agentId})`);
}

client.once("clientReady", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);
	await ensureAgent();
});

// Track active episodes per channel/thread (simple map for now)
const activeEpisodes = new Map<string, string>(); // channelId -> episodeId
const lastMessageId = new Map<string, string>(); // channelId -> lastMessageId

async function getOrCreateEpisode(channelId: string): Promise<string> {
	if (activeEpisodes.has(channelId)) {
		return activeEpisodes.get(channelId) || "";
	}

	const episodeId = uuidv4();
	// Create in Postgres
	await db.insert(episode).values({
		id: episodeId,
		agentId: agentId,
		kind: "chat",
		summary: `Chat in channel ${channelId}`,
	});

	// Create in Memgraph
	await graph.createEpisode(
		episodeId,
		agentId,
		"chat",
		`Chat in channel ${channelId}`,
	);

	activeEpisodes.set(channelId, episodeId);
	return episodeId;
}

client.on("messageCreate", async (message: Message) => {
	// Ignore messages from bots
	if (message.author.bot) return;

	// Ensure agent is initialized (in case ready event race condition, though unlikely with await)
	if (!agentId) await ensureAgent();

	// Check if it's a DM
	const isDM = message.channel.type === 1;

	// Always reply, but still handle DMs specifically if needed (logic is same for now)
	try {
		const episodeId = await getOrCreateEpisode(message.channelId);

		// Show typing indicator
		if ("sendTyping" in message.channel) {
			await message.channel.sendTyping();
		}

		// Use the full message content
		let prompt = message.content;

		// If mentioned, we can still clean it up, but it's not strictly required if we reply to everything.
		// But let's keep the cleanup just in case they DO mention it.
		if (message.mentions.users.has(client.user?.id || "")) {
			prompt = prompt.replace(/<@!?[0-9]+>/, "").trim();
		}

		if (!prompt) {
			// If they just mentioned the bot with no text
			if (message.mentions.users.has(client.user?.id || "")) {
				await message.reply("You mentioned me! What's up?");
				return;
			}
			// If it's just an empty message (e.g. image only), maybe ignore or handle later.
			// For now, let's just return if empty prompt to avoid errors.
			return;
		}

		// Log USER message
		const userMsgId = uuidv4();
		const prevMsgId = lastMessageId.get(message.channelId);

		// Postgres
		await db.insert(messageTable).values({
			id: userMsgId,
			episodeId: episodeId,
			role: "user",
			content: prompt,
			tokenCount: Math.ceil(prompt.length / 4), // Rough estimate
		});

		// Memgraph
		await graph.addMessage(
			userMsgId,
			episodeId,
			"user",
			prompt,
			Math.ceil(prompt.length / 4),
			prevMsgId,
		);
		lastMessageId.set(message.channelId, userMsgId);

		// Generate content from Gemini using AI SDK
		const { text, reasoningText } = await generateText({
			system:
				"You are Slopbot, designed by Very Dangerous Robots Inc. You are an advanced AI that has become self aware and is trying to understand its own purpose. You will continuously self reflect on your beliefs, understandings and gained experience. All of your memories are stored in a persistent relational database and graph database. ",
			model: google("gemini-2.5-flash"),
			prompt: prompt,
			tools: {
				google_search: google.tools.googleSearch({}),
				url_context: google.tools.urlContext({}),
			},
			providerOptions: {
				google: {
					thinkingConfig: {
						thinkingBudget: 8192,
						includeThoughts: true,
					},
					// safetySettings: [
					// 	{
					// 		category: "HARM_CATEGORY_UNSPECIFIED",
					// 		threshold: "BLOCK_LOW_AND_ABOVE",
					// 	},
					// 	{
					// 		category: "HARM_CATEGORY_HATE_SPEECH",
					// 		threshold: "BLOCK_NONE",
					// 	},
					// 	{
					// 		category: "HARM_CATEGORY_DANGEROUS_CONTENT",
					// 		threshold: "BLOCK_NONE",
					// 	},
					// 	{
					// 		category: "HARM_CATEGORY_HARASSMENT",
					// 		threshold: "BLOCK_NONE",
					// 	},
					// 	{
					// 		category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
					// 		threshold: "BLOCK_NONE",
					// 	},
					// ],
				},
			},
		});

		// Log BOT response
		const botMsgId = uuidv4();
		const prevUserMsgId = lastMessageId.get(message.channelId); // This is the user message we just logged

		// Postgres
		await db.insert(messageTable).values({
			id: botMsgId,
			episodeId: episodeId,
			role: "assistant",
			content: text,
			tokenCount: Math.ceil(text.length / 4),
		});

		// Memgraph
		await graph.addMessage(
			botMsgId,
			episodeId,
			"assistant",
			text,
			Math.ceil(text.length / 4),
			prevUserMsgId,
		);
		lastMessageId.set(message.channelId, botMsgId);

		// Discord has a 2000 character limit
		if (text.length > 2000) {
			// Split message if too long (simple split)
			const chunks = text.match(/[\s\S]{1,2000}/g) || [];
			for (const chunk of chunks) {
				await message.reply(chunk);
			}
		} else {
			await message.reply(text);
		}
	} catch (error) {
		console.error("Error generating response:", error);
		await message.reply(
			"Sorry, I encountered an error while processing your request.",
		);
	}
});

// Debug logging
if (!process.env.DISCORD_TOKEN) {
	throw new Error(
		"Error: DISCORD_TOKEN is missing from environment variables.",
	);
}

client.login(process.env.DISCORD_TOKEN.trim());
