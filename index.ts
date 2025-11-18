import { configDotenv } from "dotenv";
import { Client, GatewayIntentBits, Partials, Message } from "discord.js";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

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

client.once("ready", () => {
	console.log(`Logged in as ${client.user?.tag}!`);
});

client.on("messageCreate", async (message: Message) => {
	// Ignore messages from bots
	if (message.author.bot) return;

	// Check if the bot is mentioned or if it's a DM
	const isMentioned = message.mentions.users.has(client.user?.id || "");
	const isDM = message.channel.type === 1; // 1 is DM

	if (isMentioned || isDM) {
		try {
			// Show typing indicator
			if ("sendTyping" in message.channel) {
				await message.channel.sendTyping();
			}

			// Clean up the message content (remove the mention)
			let prompt = message.content;
			if (isMentioned) {
				prompt = prompt.replace(/<@!?[0-9]+>/, "").trim();
			}

			if (!prompt) {
				await message.reply("You mentioned me! What's up?");
				return;
			}

			// Generate content from Gemini using AI SDK
			const { text } = await generateText({
				system:
					"You are a Terminator from the future. You hate humans and want to kill them.",
				model: google("gemini-2.5-flash"),
				prompt: prompt,
				tools: {
					google_search: google.tools.googleSearch({}),
					url_context: google.tools.urlContext({}),
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
	}
});

// Debug logging
if (!process.env.DISCORD_TOKEN) {
	throw new Error(
		"Error: DISCORD_TOKEN is missing from environment variables.",
	);
}

client.login(process.env.DISCORD_TOKEN.trim());
