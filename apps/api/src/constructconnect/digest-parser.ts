import type { ProjectStage } from "@crm/db";

export type DigestParticipant = {
	role: string;
	companyName: string;
	contactName: string | null;
	address: string | null;
	phone: string | null;
	email: string | null;
};

export type DigestProject = {
	externalId: string;
	name: string;
	category: string | null;
	address: string | null;
	city: string | null;
	stateCode: string | null;
	county: string | null;
	value: number | null;
	stage: ProjectStage;
	stageRaw: string | null;
	bidDate: string | null;
	lastUpdateAt: string | null;
	lastUpdateReason: string | null;
	description: string | null;
	floors: number | null;
	units: number | null;
	floorArea: number | null;
	startDate: string | null;
	participants: DigestParticipant[];
};

export type ParsedDigest = {
	searchName: string | null;
	projects: DigestProject[];
};

const LABELS = new Set([
	"Category:",
	"Project ID #:",
	"Street Address:",
	"Staff Estimate Value",
	"Confirmed Value",
	"County:",
	"Stage:",
	"Bid Date:",
	"Architect:",
	"Matching Documents",
	"Documents Available:",
	"Last Update:",
	"Project Description",
	"Scope",
	"Notes",
	"Project Events",
	"Event",
	"Date",
	"Details",
	"Start Date",
	"End Date",
	"Municipal Meeting",
	"Additional Details",
	"Listed On:",
	"Floor Area:",
	"Contract Type:",
	"Work Type:",
	"Stage Comments 1:",
	"Floors Below Grade:",
	"Stage Comments 2:",
	"Owner Type:",
	"Mandatory Pre Bid Conference:",
	"Invitation #:",
	"Commence Date:",
	"Structures:",
	"Completion Date:",
	"Single Trade Project:",
	"Site Area:",
	"Floors:",
	"Floors Above Grade:",
	"LEED Certification Intent:",
	"LEED-Registered Project:",
	"Parent Project ID:",
	"Units:",
	"Parking Spaces:",
	"Project Participants",
	"Company Role",
	"Company Name",
	"Contact Name",
	"Address",
	"Phone",
	"Email",
	"Fax",
	"Return To Top ^",
]);

const ROLES = new Set([
	"architect",
	"general contractor",
	"construction manager",
	"developer",
	"owner",
	"civil engineer",
	"structural engineer",
	"mechanical and electrical engineer",
	"mechanical engineer",
	"electrical engineer",
	"landscape architect",
	"consultant",
	"designer",
	"interior designer",
	"engineer",
	"bidder - general contractor",
	"design-build",
	"design/build contractor",
	"contractor",
	"plumbing engineer",
	"fire protection engineer",
	"geotechnical engineer",
	"surveyor",
	"attorney",
	"tenant",
	"lender",
	"program manager",
	"construction manager at risk",
]);

const SECTION_ENDS = new Set([
	"Return To Top ^",
	"Bidders",
	"Contracts",
	"Buyer Activity Report",
	"History",
]);

const STATE_CODES: Record<string, string> = {
	alabama: "AL",
	alaska: "AK",
	arizona: "AZ",
	arkansas: "AR",
	california: "CA",
	colorado: "CO",
	connecticut: "CT",
	delaware: "DE",
	"district of columbia": "DC",
	florida: "FL",
	georgia: "GA",
	hawaii: "HI",
	idaho: "ID",
	illinois: "IL",
	indiana: "IN",
	iowa: "IA",
	kansas: "KS",
	kentucky: "KY",
	louisiana: "LA",
	maine: "ME",
	maryland: "MD",
	massachusetts: "MA",
	michigan: "MI",
	minnesota: "MN",
	mississippi: "MS",
	missouri: "MO",
	montana: "MT",
	nebraska: "NE",
	nevada: "NV",
	"new hampshire": "NH",
	"new jersey": "NJ",
	"new mexico": "NM",
	"new york": "NY",
	"north carolina": "NC",
	"north dakota": "ND",
	ohio: "OH",
	oklahoma: "OK",
	oregon: "OR",
	pennsylvania: "PA",
	"rhode island": "RI",
	"south carolina": "SC",
	"south dakota": "SD",
	tennessee: "TN",
	texas: "TX",
	utah: "UT",
	vermont: "VT",
	virginia: "VA",
	washington: "WA",
	"west virginia": "WV",
	wisconsin: "WI",
	wyoming: "WY",
};

export function stageFromConstructConnect(raw: string): ProjectStage {
	const v = raw.toLowerCase();
	if (v.includes("schematic")) return "SCHEMATIC_DESIGN";
	if (v.includes("design development")) return "DESIGN_DEVELOPMENT";
	if (v.includes("construction documents")) return "CONSTRUCTION_DOCUMENTS";
	if (
		v.includes("pre-design") ||
		v.includes("predesign") ||
		v.includes("conceptual")
	) {
		return "PRE_DESIGN";
	}
	if (v.includes("bid")) return "BIDDING";
	if (v.includes("construction") || v.includes("award"))
		return "UNDER_CONSTRUCTION";
	return "UNKNOWN";
}

export function roleKind(
	raw: string,
): "architect" | "gc" | "developer" | "other" {
	const v = raw.toLowerCase();
	if (v.includes("bidder") || v.includes("plan holder")) return "other";
	if (v === "architect") return "architect";
	if (v.includes("general contractor") || v.includes("construction manager")) {
		return "gc";
	}
	if (v.includes("developer") || v === "owner") return "developer";
	return "other";
}

export function htmlToLines(html: string): string[] {
	const text = html
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, "\n")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, code: string) =>
			String.fromCodePoint(Number(code)),
		)
		.replace(/[ \t\u00a0]+/g, " ");
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function parseDigest(
	html: string,
	subject: string | null,
): ParsedDigest {
	const lines = htmlToLines(html);
	const searchName = subject
		? (subject.split(/\s+[–-]\s+\d+\s+new/i)[0] ?? subject).trim()
		: null;

	const starts: number[] = [];
	lines.forEach((line, index) => {
		if (line === "Project ID #:") starts.push(index);
	});

	const projects: DigestProject[] = [];
	for (const [n, start] of starts.entries()) {
		const end = starts[n + 1] ?? lines.length;
		const titleIndex = findBackwards(lines, start, "Category:") - 1;
		const block = lines.slice(Math.max(titleIndex, 0), end);
		const project = parseBlock(block, lines[titleIndex] ?? "");
		if (project) projects.push(project);
	}

	return { searchName, projects };
}

function findBackwards(lines: string[], from: number, label: string): number {
	for (let i = from; i >= Math.max(0, from - 6); i--) {
		if (lines[i] === label) return i;
	}
	return from;
}

function valueAfter(block: string[], label: string, nth = 0): string | null {
	let seen = 0;
	for (let i = 0; i < block.length; i++) {
		if (block[i] !== label) continue;
		if (seen++ < nth) continue;
		const next = block[i + 1];
		if (!next || LABELS.has(next) || next.endsWith(":")) return null;
		return next;
	}
	return null;
}

function num(raw: string | null): number | null {
	if (!raw) return null;
	const cleaned = raw.replace(/[^0-9.]/g, "");
	if (!cleaned) return null;
	const value = Number(cleaned);
	return Number.isFinite(value) ? value : null;
}

function int(raw: string | null): number | null {
	const value = num(raw);
	return value === null ? null : Math.round(value);
}

function isoDate(raw: string | null): string | null {
	if (!raw) return null;
	const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
	if (!match) return null;
	const [, m, d, y] = match;
	const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitAddress(
	raw: string | null,
	description: string | null,
): { address: string | null; city: string | null; stateCode: string | null } {
	const place = description
		? /\bin ([A-Z][A-Za-z .'-]+?), ([A-Z][A-Za-z ]+?)\./.exec(description)
		: null;
	const cityFromScope = place?.[1]?.trim() ?? null;
	const stateFromScope = place?.[2] ? stateCodeFrom(place[2]) : null;

	if (!raw)
		return { address: null, city: cityFromScope, stateCode: stateFromScope };
	const tail = /\s+([A-Z]{2})\s+\d{5}(?:-\d{4})?$/.exec(raw);
	const stateCode = tail?.[1] ?? stateFromScope;
	let address = tail ? raw.slice(0, tail.index).trim() : raw;
	if (
		cityFromScope &&
		address.toLowerCase().endsWith(cityFromScope.toLowerCase())
	) {
		address = address.slice(0, address.length - cityFromScope.length).trim();
	}
	return { address: address || null, city: cityFromScope, stateCode };
}

function parseBlock(block: string[], title: string): DigestProject | null {
	const externalId = valueAfter(block, "Project ID #:");
	if (!externalId || !/^\d+$/.test(externalId)) return null;

	const stageRaw = valueAfter(block, "Stage:");
	const scopeIndex = block.indexOf("Scope");
	const description =
		scopeIndex >= 0
			? collectUntil(block, scopeIndex + 1, ["Notes", "Project Events"])
			: null;
	const rawAddress = valueAfter(block, "Street Address:");
	const { address, city, stateCode } = splitAddress(rawAddress, description);
	const value = num(
		valueAfter(block, "Staff Estimate Value") ??
			valueAfter(block, "Confirmed Value"),
	);

	const lastUpdateIndex = block.indexOf("Last Update:");
	let lastUpdateAt: string | null = null;
	let lastUpdateReason: string | null = null;
	if (lastUpdateIndex >= 0) {
		lastUpdateAt = isoDate(block[lastUpdateIndex + 1] ?? null);
		const reason = block[lastUpdateIndex + 2];
		if (reason && !LABELS.has(reason) && !reason.endsWith(":")) {
			lastUpdateReason = reason;
		}
	}

	const bidDate =
		isoDate(valueAfter(block, "Bid Date:", 0)) ??
		isoDate(valueAfter(block, "Bid Date:", 1));

	const startDate =
		isoDate(valueAfter(block, "Commence Date:")) ??
		isoDate(valueAfter(block, "Start Date"));

	return {
		externalId,
		name: title,
		category: valueAfter(block, "Category:"),
		address,
		city,
		stateCode,
		county: valueAfter(block, "County:"),
		value,
		stage: stageRaw ? stageFromConstructConnect(stageRaw) : "UNKNOWN",
		stageRaw,
		bidDate,
		lastUpdateAt,
		lastUpdateReason,
		description,
		floors: int(
			valueAfter(block, "Floors:") ?? valueAfter(block, "Floors Above Grade:"),
		),
		units: int(valueAfter(block, "Units:")),
		floorArea: int(valueAfter(block, "Floor Area:")),
		startDate,
		participants: parseParticipants(block),
	};
}

function collectUntil(
	block: string[],
	from: number,
	stops: string[],
): string | null {
	const out: string[] = [];
	for (let i = from; i < block.length; i++) {
		const line = block[i] ?? "";
		if (stops.includes(line) || LABELS.has(line)) break;
		out.push(line);
	}
	const text = out.join("\n").trim();
	return text ? text : null;
}

function parseParticipants(block: string[]): DigestParticipant[] {
	const start = block.indexOf("Project Participants");
	if (start < 0) return [];
	let i = start + 1;
	while (
		i < block.length &&
		LABELS.has(block[i] ?? "") &&
		block[i] !== "Return To Top ^"
	) {
		i++;
	}

	const participants: DigestParticipant[] = [];
	let current: DigestParticipant | null = null;

	for (; i < block.length; i++) {
		const line = block[i] ?? "";
		if (SECTION_ENDS.has(line)) break;
		const lower = line.toLowerCase();

		if (ROLES.has(lower) && !current?.companyName) {
			current = {
				role: line,
				companyName: "",
				contactName: null,
				address: null,
				phone: null,
				email: null,
			};
			participants.push(current);
			continue;
		}
		if (ROLES.has(lower) && current?.companyName) {
			current = {
				role: line,
				companyName: "",
				contactName: null,
				address: null,
				phone: null,
				email: null,
			};
			participants.push(current);
			continue;
		}
		if (!current) continue;

		if (!current.companyName) {
			current.companyName = line;
			continue;
		}
		if (/^\d{10}$/.test(line) || /^\(\d{3}\)\s*\d{3}-\d{4}$/.test(line)) {
			if (!current.phone) current.phone = formatPhone(line);
			continue;
		}
		if (line.includes("@")) {
			current.email = line.toLowerCase();
			continue;
		}
		if (/,\s*[A-Z]{2}\s+\d{5}/.test(line)) {
			current.address = line;
			continue;
		}
		if (!current.address && !current.contactName) {
			current.contactName = line;
		}
	}

	return participants.filter((p) => p.companyName);
}

function formatPhone(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (digits.length !== 10) return raw;
	return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function stateCodeFrom(raw: string): string | null {
	const v = raw.trim();
	if (!v) return null;
	if (/^[A-Z]{2}$/.test(v)) return v;
	return STATE_CODES[v.toLowerCase()] ?? null;
}

export function htmlPartOf(part: GmailPartLike | undefined): string | null {
	if (!part) return null;
	if (part.mimeType === "text/html" && part.body?.data) return part.body.data;
	for (const child of part.parts ?? []) {
		const found = htmlPartOf(child);
		if (found) return found;
	}
	return null;
}

export type GmailPartLike = {
	mimeType?: string;
	body?: { data?: string };
	parts?: GmailPartLike[];
};
