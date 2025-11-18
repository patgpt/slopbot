import { verifyConnections } from "./db";

(async () => {
	await verifyConnections();
	process.exit(0);
})();
