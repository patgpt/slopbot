"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graph = exports.GraphClient = void 0;
const db_1 = require("../../db");
class GraphClient {
    driver = db_1.memgraphDriver;
    async run(query, params = {}) {
        const session = this.driver.session();
        try {
            const result = await session.run(query, params);
            return result;
        }
        finally {
            await session.close();
        }
    }
    // 3.1 Core node creation helpers
    async ensureAgent(id, name) {
        await this.run(`MERGE (a:Agent {id: $id}) 
             SET a.name = $name`, { id, name });
    }
    async createEpisode(id, agentId, kind, summary = "") {
        await this.run(`MATCH (a:Agent {id: $agentId})
             CREATE (e:Episode {id: $id, kind: $kind, summary: $summary, started_at: toString(localDateTime())})
             CREATE (a)-[:RAN]->(e)`, { id, agentId, kind, summary });
    }
    async addMessage(id, episodeId, role, content, tokenCount, previousMessageId) {
        // Create the message node
        await this.run(`MATCH (e:Episode {id: $episodeId})
             CREATE (m:Message {id: $id, role: $role, content: $content, token_count: $tokenCount, ts: toString(localDateTime())})
             CREATE (e)-[:HAS_MESSAGE]->(m)`, { id, episodeId, role, content, tokenCount });
        // Link to previous message if exists
        if (previousMessageId) {
            await this.run(`MATCH (prev:Message {id: $previousMessageId})
                 MATCH (curr:Message {id: $id})
                 CREATE (prev)-[:NEXT]->(curr)`, { previousMessageId, id });
        }
    }
    async addThought(id, messageId, kind, content) {
        await this.run(`MATCH (m:Message {id: $messageId})
             CREATE (t:Thought {id: $id, kind: $kind, content: $content})
             CREATE (m)-[:HAS_THOUGHT]->(t)`, { id, messageId, kind, content });
    }
    async addBehaviorEvent(id, episodeId, kind, severity) {
        await this.run(`MATCH (e:Episode {id: $episodeId})
             CREATE (b:BehaviorEvent {id: $id, kind: $kind, severity: $severity})
             CREATE (b)-[:IN_EPISODE]->(e)`, { id, episodeId, kind, severity });
    }
}
exports.GraphClient = GraphClient;
exports.graph = new GraphClient();
