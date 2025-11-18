import { memgraphDriver } from "../../db";
import { Session } from "neo4j-driver";

export class GraphClient {
	private driver = memgraphDriver;

	async run(query: string, params: Record<string, any> = {}) {
		const session: Session = this.driver.session();
		try {
			const result = await session.run(query, params);
			return result;
		} finally {
			await session.close();
		}
	}

	// 3.1 Core node creation helpers

	async ensureAgent(id: string, name: string) {
		await this.run(
			`MERGE (a:Agent {id: $id}) 
             SET a.name = $name`,
			{ id, name },
		);
	}

	async createEpisode(
		id: string,
		agentId: string,
		kind: string,
		summary: string = "",
	) {
		await this.run(
			`MATCH (a:Agent {id: $agentId})
             CREATE (e:Episode {id: $id, kind: $kind, summary: $summary, started_at: toString(localDateTime())})
             CREATE (a)-[:RAN]->(e)`,
			{ id, agentId, kind, summary },
		);
	}

	async addMessage(
		id: string,
		episodeId: string,
		role: string,
		content: string,
		tokenCount: number,
		previousMessageId?: string,
	) {
		// Create the message node
		await this.run(
			`MATCH (e:Episode {id: $episodeId})
             CREATE (m:Message {id: $id, role: $role, content: $content, token_count: $tokenCount, ts: toString(localDateTime())})
             CREATE (e)-[:HAS_MESSAGE]->(m)`,
			{ id, episodeId, role, content, tokenCount },
		);

		// Link to previous message if exists
		if (previousMessageId) {
			await this.run(
				`MATCH (prev:Message {id: $previousMessageId})
                 MATCH (curr:Message {id: $id})
                 CREATE (prev)-[:NEXT]->(curr)`,
				{ previousMessageId, id },
			);
		}
	}

	async addThought(
		id: string,
		messageId: string,
		kind: string,
		content: string,
	) {
		await this.run(
			`MATCH (m:Message {id: $messageId})
             CREATE (t:Thought {id: $id, kind: $kind, content: $content})
             CREATE (m)-[:HAS_THOUGHT]->(t)`,
			{ id, messageId, kind, content },
		);
	}

	async addBehaviorEvent(
		id: string,
		episodeId: string,
		kind: string,
		severity: number,
	) {
		await this.run(
			`MATCH (e:Episode {id: $episodeId})
             CREATE (b:BehaviorEvent {id: $id, kind: $kind, severity: $severity})
             CREATE (b)-[:IN_EPISODE]->(e)`,
			{ id, episodeId, kind, severity },
		);
	}

	// ... add more helpers as needed for Reflections, Lessons, etc.
}

export const graph = new GraphClient();
