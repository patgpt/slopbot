"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyConnections = exports.memgraphDriver = exports.db = void 0;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const schema = __importStar(require("./src/db/schema"));
require("dotenv/config");
// Postgres Connection
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
    throw new Error("POSTGRES_URL is missing from environment variables");
}
const client = (0, postgres_1.default)(connectionString);
exports.db = (0, postgres_js_1.drizzle)(client, { schema });
// Memgraph Connection
const memgraphUrl = process.env.MEMGRAPH_URL || "bolt://localhost:7687";
const memgraphUser = process.env.MEMGRAPH_USER || "memgraph";
const memgraphPassword = process.env.MEMGRAPH_PASSWORD || "memgraph";
exports.memgraphDriver = neo4j_driver_1.default.driver(memgraphUrl, neo4j_driver_1.default.auth.basic(memgraphUser, memgraphPassword));
const verifyConnections = async () => {
    try {
        // Test Postgres
        await client `SELECT 1`;
        console.log("✅ Postgres connected");
        // Test Memgraph
        const session = exports.memgraphDriver.session();
        await session.run("RETURN 1");
        await session.close();
        console.log("✅ Memgraph connected");
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
    }
};
exports.verifyConnections = verifyConnections;
