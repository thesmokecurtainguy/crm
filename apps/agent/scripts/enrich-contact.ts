import "@crm/env/load";

function contactIdsFromArgs(args: string[]): string[] {
	const ids: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] !== "--contact") continue;
		const id = args[index + 1]?.trim();
		if (id) ids.push(id);
	}
	return [...new Set(ids)];
}

const contactIds = contactIdsFromArgs(process.argv.slice(2));

if (contactIds.length === 0) {
	console.error("Usage: bun run --filter=agent enrich -- --contact <id>");
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

const response = await fetch(`${base}/internal/crm/enrich-contact`, {
	method: "POST",
	headers: {
		authorization: `Bearer ${secret}`,
		"content-type": "application/json",
	},
	body: JSON.stringify(
		contactIds.length === 1 ? { contactId: contactIds[0] } : { contactIds },
	),
});

const body = await response.text();
if (!response.ok) {
	console.error(body || `HTTP ${response.status}`);
	process.exit(1);
}

console.log(body);
