import type { Db } from "@crm/db";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";

const EMAIL_SOURCE_KEY = "email_source";
const EMAIL_SOURCE_LABEL = "Email Source";
const MIN_EVIDENCE = 2;

export type EmailPattern =
	| "flast"
	| "first.last"
	| "first"
	| "firstlast"
	| "first_last"
	| "firstl"
	| "flast_dot"
	| "last"
	| "lastf";

const PATTERNS: EmailPattern[] = [
	"flast",
	"first.last",
	"first",
	"firstlast",
	"first_last",
	"firstl",
	"flast_dot",
	"last",
	"lastf",
];

export type FillResult = {
	companyId: string;
	domain: string | null;
	pattern: EmailPattern | null;
	evidence: number;
	filled: number;
	skipped: number;
	reason: string | null;
};

type Person = {
	id: string;
	firstName: string;
	lastName: string | null;
	email: string | null;
};

@Injectable()
export class EmailPatternService {
	private readonly logger = new Logger(EmailPatternService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly fields: FieldsService,
	) {}

	async fill(
		companyId: string,
		options: { dryRun?: boolean; minEvidence?: number } = {},
	): Promise<FillResult> {
		const minEvidence = Math.max(1, options.minEvidence ?? MIN_EVIDENCE);
		const company = await this.db.company.findUnique({
			where: { id: companyId },
			select: {
				id: true,
				domain: true,
				contacts: {
					where: { archivedAt: null },
					select: { id: true, firstName: true, lastName: true, email: true },
				},
			},
		});
		if (!company) throw new BadRequestException("No such company.");

		const domain = company.domain ?? inferDomain(company.contacts);
		const base: FillResult = {
			companyId,
			domain,
			pattern: null,
			evidence: 0,
			filled: 0,
			skipped: 0,
			reason: null,
		};
		if (!domain)
			return {
				...base,
				reason: "No domain on the company and none in its emails.",
			};

		const evidence = company.contacts.filter(
			(c) => c.email?.toLowerCase().endsWith(`@${domain}`) && c.lastName,
		);
		const inferred = detect(evidence, domain, minEvidence);
		if (!inferred) {
			return {
				...base,
				evidence: evidence.length,
				reason:
					evidence.length < minEvidence
						? `Need at least ${minEvidence} real ${domain} addresses to learn the pattern; have ${evidence.length}.`
						: `The ${domain} addresses do not follow one pattern.`,
			};
		}

		const missing = company.contacts.filter((c) => !c.email);
		if (options.dryRun) {
			return {
				...base,
				pattern: inferred,
				evidence: evidence.length,
				skipped: missing.length,
			};
		}

		const taken = new Set(
			(
				await this.db.contact.findMany({
					where: { archivedAt: null, email: { endsWith: `@${domain}` } },
					select: { email: true },
				})
			).map((c) => c.email?.toLowerCase()),
		);

		await this.ensureSourceField();

		let filled = 0;
		let skipped = 0;
		for (const person of missing) {
			const email = build(inferred, person, domain);
			if (!email || taken.has(email)) {
				skipped += 1;
				continue;
			}
			taken.add(email);
			await this.db.$transaction(async (tx) => {
				await tx.contact.update({ where: { id: person.id }, data: { email } });
				await this.fields.applyValues(tx, "CONTACT", person.id, {
					[EMAIL_SOURCE_KEY]: `Pattern (${inferred} @${domain})`,
				});
			});
			filled += 1;
		}

		this.logger.log({
			message: "Emails filled from pattern",
			companyId,
			pattern: inferred,
			filled,
			skipped,
		});
		return {
			...base,
			pattern: inferred,
			evidence: evidence.length,
			filled,
			skipped,
		};
	}

	private async ensureSourceField() {
		const definitions = await this.fields.definitionsFor("CONTACT");
		if (definitions.some((d) => d.key === EMAIL_SOURCE_KEY)) return;
		await this.fields.create({
			entity: "CONTACT",
			label: EMAIL_SOURCE_LABEL,
			type: "TEXT",
			options: [],
			agentFilled: false,
			agentBrief: null,
			required: false,
			showOnSheet: true,
			showOnTable: false,
			showOnFilter: true,
		});
	}
}

function inferDomain(contacts: Person[]): string | null {
	const counts = new Map<string, number>();
	for (const c of contacts) {
		const at = c.email?.indexOf("@") ?? -1;
		if (at < 0 || !c.email) continue;
		const d = c.email.slice(at + 1).toLowerCase();
		if (/(gmail|yahoo|hotmail|outlook|icloud|aol)\./.test(d)) continue;
		counts.set(d, (counts.get(d) ?? 0) + 1);
	}
	let best: string | null = null;
	let bestCount = 0;
	for (const [d, n] of counts) {
		if (n > bestCount) {
			best = d;
			bestCount = n;
		}
	}
	return best;
}

function clean(value: string | null): string {
	return (value ?? "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z]/g, "");
}

function parts(person: Person): { f: string; l: string } | null {
	const f = clean(person.firstName.split(/\s+/)[0] ?? "");
	const lastTokens = (person.lastName ?? "").split(/\s+/).filter(Boolean);
	const l = clean(lastTokens[lastTokens.length - 1] ?? "");
	if (!f || !l) return null;
	return { f, l };
}

export function build(
	pattern: EmailPattern,
	person: Person,
	domain: string,
): string | null {
	const p = parts(person);
	if (!p) return null;
	const { f, l } = p;
	const local: Record<EmailPattern, string> = {
		flast: `${f[0]}${l}`,
		"first.last": `${f}.${l}`,
		first: f,
		firstlast: `${f}${l}`,
		first_last: `${f}_${l}`,
		firstl: `${f}${l[0]}`,
		flast_dot: `${f[0]}.${l}`,
		last: l,
		lastf: `${l}${f[0]}`,
	};
	return `${local[pattern]}@${domain}`;
}

export function detect(
	evidence: Person[],
	domain: string,
	minEvidence = MIN_EVIDENCE,
): EmailPattern | null {
	if (evidence.length < minEvidence) return null;
	const scores = new Map<EmailPattern, number>();
	for (const person of evidence) {
		const actual = person.email?.toLowerCase() ?? "";
		for (const pattern of PATTERNS) {
			if (build(pattern, person, domain) === actual) {
				scores.set(pattern, (scores.get(pattern) ?? 0) + 1);
			}
		}
	}
	let best: EmailPattern | null = null;
	let bestScore = 0;
	for (const pattern of PATTERNS) {
		const score = scores.get(pattern) ?? 0;
		if (score > bestScore) {
			best = pattern;
			bestScore = score;
		}
	}
	if (!best) return null;
	return bestScore / evidence.length >= 0.6 ? best : null;
}
