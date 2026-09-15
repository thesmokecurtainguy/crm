import "@crm/env/load";

function dealIdFromArgs(args: string[]): string | null {
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] !== "--deal") continue;
		const id = args[index + 1]?.trim();
		if (id) return id;
	}
	return null;
}

const dealId = dealIdFromArgs(process.argv.slice(2));

if (!dealId) {
	console.error("Usage: bun run --filter=agent quote-check -- --deal <id>");
	process.exit(1);
}

const secret = process.env.AGENT_BRIDGE_SECRET?.trim();
if (!secret) {
	console.error("AGENT_BRIDGE_SECRET is unset.");
	process.exit(1);
}

const base = (process.env.AGENT_URL?.trim() || "http://127.0.0.1:2000").replace(
	/\/$/,
	"",
);

const response = await fetch(`${base}/internal/crm/quote-checkpoint`, {
	method: "POST",
	headers: {
		authorization: `Bearer ${secret}`,
		"content-type": "application/json",
	},
	body: JSON.stringify({ dealId }),
});

const body = await response.text();
if (!response.ok) {
	console.error(body || `HTTP ${response.status}`);
	process.exit(1);
}

console.log(body);
