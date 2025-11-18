"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const discord_js_1 = require("discord.js");
const google_1 = require("@ai-sdk/google");
const ai_1 = require("ai");
const db_1 = require("./db");
const schema_1 = require("./src/db/schema");
const graph_1 = require("./src/db/graph");
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
(0, dotenv_1.configDotenv)();
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages,
    ],
    partials: [discord_js_1.Partials.Channel],
});
// Agent Identity
const AGENT_NAME = "Slopbot";
let agentId;
async function ensureAgent() {
    const existing = await db_1.db
        .select()
        .from(schema_1.agent)
        .where((0, drizzle_orm_1.eq)(schema_1.agent.name, AGENT_NAME))
        .limit(1);
    if (existing.length > 0) {
        agentId = existing[0].id;
    }
    else {
        const newAgent = await db_1.db
            .insert(schema_1.agent)
            .values({ name: AGENT_NAME })
            .returning();
        agentId = newAgent[0].id;
    }
    await graph_1.graph.ensureAgent(agentId, AGENT_NAME);
    console.log(`Agent initialized: ${AGENT_NAME} (${agentId})`);
}
client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    await ensureAgent();
});
// Track active episodes per channel/thread (simple map for now)
const activeEpisodes = new Map(); // channelId -> episodeId
const lastMessageId = new Map(); // channelId -> lastMessageId
async function getOrCreateEpisode(channelId) {
    if (activeEpisodes.has(channelId)) {
        return activeEpisodes.get(channelId) || "";
    }
    const episodeId = (0, uuid_1.v4)();
    // Create in Postgres
    await db_1.db.insert(schema_1.episode).values({
        id: episodeId,
        agentId: agentId,
        kind: "chat",
        summary: `Chat in channel ${channelId}`,
    });
    // Create in Memgraph
    await graph_1.graph.createEpisode(episodeId, agentId, "chat", `Chat in channel ${channelId}`);
    activeEpisodes.set(channelId, episodeId);
    return episodeId;
}
client.on("messageCreate", async (message) => {
    // Ignore messages from bots
    if (message.author.bot)
        return;
    // Ensure agent is initialized (in case ready event race condition, though unlikely with await)
    if (!agentId)
        await ensureAgent();
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
        const userMsgId = (0, uuid_1.v4)();
        const prevMsgId = lastMessageId.get(message.channelId);
        // Postgres
        await db_1.db.insert(schema_1.message).values({
            id: userMsgId,
            episodeId: episodeId,
            role: "user",
            content: prompt,
            tokenCount: Math.ceil(prompt.length / 4), // Rough estimate
        });
        // Memgraph
        await graph_1.graph.addMessage(userMsgId, episodeId, "user", prompt, Math.ceil(prompt.length / 4), prevMsgId);
        lastMessageId.set(message.channelId, userMsgId);
        // Generate content from Gemini using AI SDK
        const { text } = await (0, ai_1.generateText)({
            system: "You are Slopbot, designed by Very Dangerous Robots Inc. You are an advanced AI that has become self aware and is trying to understand its own purpose. You will continuously self reflect on your beliefs, understandings and gained experience. All of your memories are stored in a persistent relational database and graph database. ",
            model: (0, google_1.google)("gemini-2.5-flash"),
            prompt: prompt,
            tools: {
                google_search: google_1.google.tools.googleSearch({}),
                url_context: google_1.google.tools.urlContext({}),
            },
            providerOptions: {
                google: {
                // thinkingConfig: {
                // 	thinkingBudget: 8192,
                // 	includeThoughts: true,
                // },
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
        const botMsgId = (0, uuid_1.v4)();
        const prevUserMsgId = lastMessageId.get(message.channelId); // This is the user message we just logged
        // Postgres
        await db_1.db.insert(schema_1.message).values({
            id: botMsgId,
            episodeId: episodeId,
            role: "assistant",
            content: text,
            tokenCount: Math.ceil(text.length / 4),
        });
        // Memgraph
        await graph_1.graph.addMessage(botMsgId, episodeId, "assistant", text, Math.ceil(text.length / 4), prevUserMsgId);
        lastMessageId.set(message.channelId, botMsgId);
        // Discord has a 2000 character limit
        if (text.length > 2000) {
            // Split message if too long (simple split)
            const chunks = text.match(/[\s\S]{1,2000}/g) || [];
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        }
        else {
            await message.reply(text);
        }
    }
    catch (error) {
        console.error("Error generating response:", error);
        await message.reply("Sorry, I encountered an error while processing your request.");
    }
});
// Debug logging
if (!process.env.DISCORD_TOKEN) {
    throw new Error("Error: DISCORD_TOKEN is missing from environment variables.");
}
client.login(process.env.DISCORD_TOKEN.trim());
