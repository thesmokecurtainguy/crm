import "@crm/env/load";

const secret = process.env.AGENT_BRIDGE_SECRET?.trim();
if (!secret) {
	console.error("AGENT_BRIDGE_SECRET is unset.");
	process.exit(1);
}

const base = (process.env.AGENT_URL?.trim() || "http://127.0.0.1:2000").replace(
	/\/$/,
	"",
);

const response = await fetch(`${base}/internal/crm/profile-workspace`, {
	method: "POST",
	headers: {
		authorization: `Bearer ${secret}`,
	},
});

const body = await response.text();
if (!response.ok) {
	console.error(body || `HTTP ${response.status}`);
	process.exit(1);
}

console.log(body);
