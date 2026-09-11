import type { ProjectStage } from "@crm/db/enums";

export const CC_REQUIRED_HEADERS = [
	"Project Id",
	"Project Title",
	"Company Name",
];

export function isConstructConnectExport(headers: string[]): boolean {
	const set = new Set(headers.map((h) => h.trim().toLowerCase()));
	return CC_REQUIRED_HEADERS.every((h) => set.has(h.toLowerCase()));
}

export type CcTeamMember = {
	companyName: string;
	role: string;
	domain: string;
	address: string;
	city: string;
	stateCode: string;
	phone: string;
	email: string;
	firstName: string;
	lastName: string;
	externalCompanyId: string;
};

export type CcProject = {
	externalId: string;
	name: string;
	value: number | null;
	stage: ProjectStage;
	stageRaw: string;
	category: string;
	bidDate: string | null;
	lastUpdateAt: string | null;
	address: string;
	city: string;
	county: string;
	stateCode: string;
	floors: number | null;
	floorArea: number | null;
	team: CcTeamMember[];
};

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
	"puerto rico": "PR",
};

function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function stateCode(raw: string): string {
	const v = raw.trim();
	if (!v) return "";
	if (v.length === 2) return v.toUpperCase();
	return STATE_CODES[v.toLowerCase()] ?? v.slice(0, 2).toUpperCase();
}

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
	if (v === "architect" || v.startsWith("architect ")) return "architect";
	if (v.includes("general contractor") || v.includes("construction manager")) {
		return "gc";
	}
	if (v.includes("developer") || v === "owner" || v.startsWith("owner")) {
		return "developer";
	}
	return "other";
}

function num(raw: string): number | null {
	const cleaned = raw.replace(/[$,]/g, "").trim();
	if (!cleaned) return null;
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : null;
}

function int(raw: string): number | null {
	const n = num(raw);
	return n === null ? null : Math.round(n);
}

function isoDate(raw: string): string | null {
	const v = raw.trim();
	if (!v) return null;
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function phone(raw: string): string {
	const digits = raw.replace(/\D/g, "").replace(/\.0+$/, "");
	if (digits.length === 10) {
		return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
	}
	return raw.trim();
}

function domainFromEmail(email: string): string {
	const at = email.indexOf("@");
	if (at < 0) return "";
	const d = email
		.slice(at + 1)
		.toLowerCase()
		.trim();
	return /(gmail|yahoo|hotmail|outlook|icloud|aol|cox|verizon|comcast)\./.test(
		d,
	)
		? ""
		: d;
}

function unescapeHtml(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ");
}

export function parseConstructConnect(
	rows: Record<string, string>[],
): CcProject[] {
	const byId = new Map<string, CcProject>();
	const get = (row: Record<string, string>, key: string) =>
		unescapeHtml((row[key] ?? "").trim());

	for (const row of rows) {
		const title = get(row, "Project Title");
		if (!title) continue;
		const externalId =
			get(row, "Project Id") ||
			`name:${slug(title)}:${stateCode(get(row, "Project State/Province")).toLowerCase()}`;

		let project = byId.get(externalId);
		if (!project) {
			project = {
				externalId,
				name: get(row, "Project Title"),
				value: num(get(row, "Project Value")),
				stage: stageFromConstructConnect(get(row, "Project Stage")),
				stageRaw: get(row, "Project Stage"),
				category: get(row, "Project Subcategory"),
				bidDate: isoDate(get(row, "Project Bid Date")),
				lastUpdateAt: isoDate(get(row, "Project Last Updated")),
				address: get(row, "Project Street Address"),
				city: get(row, "Project City"),
				county: get(row, "Project County"),
				stateCode: stateCode(get(row, "Project State/Province")),
				floors: int(get(row, "Project Floors")),
				floorArea: int(get(row, "Project Floor Area")),
				team: [],
			};
			byId.set(externalId, project);
		}

		const companyName = get(row, "Company Name");
		if (!companyName) continue;
		const email = get(row, "Company Email").toLowerCase();
		project.team.push({
			companyName,
			role: get(row, "Company Classification/Role"),
			domain: domainFromEmail(email),
			address: get(row, "Company Address"),
			city: get(row, "Company City"),
			stateCode: stateCode(get(row, "Company State/Province")),
			phone: phone(get(row, "Company Phone Number")),
			email,
			firstName: get(row, "Company Contact First Name"),
			lastName: get(row, "Company Contact Last Name"),
			externalCompanyId: get(row, "Company Id"),
		});
	}

	return [...byId.values()];
}
