import { verifyConnections } from "./db";
import "dotenv/config";

(async () => {
	await verifyConnections();
	process.exit(0);
})();
