import { type Db, RecordSource } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type { GmailMessage, MessageList } from "../google/gmail.client";
import { header } from "../google/gmail-mime";
import { MailboxApiClient } from "../mailbox/mailbox-api.client";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";
import { decodeBase64Url } from "../mailbox/message-text";
import { ProjectsService } from "../projects/projects.service";
import {
	type DigestParticipant,
	type DigestProject,
	htmlPartOf,
	parseDigest,
	roleKind,
} from "./digest-parser";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const SENDER = "donotreply@constructconnect.com";
const FIRST_RUN_LOOKBACK_DAYS = 14;
const MAX_MESSAGES_PER_RUN = 25;

export type DigestRunResult = {
	userId: string;
	status: "ok" | "skipped" | "reconnect" | "failed";
	reason?: string;
	digests: number;
	projectsFound: number;
	projectsCreated: number;
	projectsUpdated: number;
};

@Injectable()
export class DigestSyncService {
	private readonly logger = new Logger(DigestSyncService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly api: MailboxApiClient,
		private readonly projects: ProjectsService,
	) {}

	async runAll(): Promise<DigestRunResult[]> {
		const mailboxes = await this.db.mailboxSync.findMany({
			where: { source: "gmail" },
			select: { userId: true },
		});
		const results: DigestRunResult[] = [];
		for (const mailbox of mailboxes) {
			results.push(await this.runFor(mailbox.userId));
		}
		return results;
	}

	async runFor(userId: string): Promise<DigestRunResult> {
		const base: DigestRunResult = {
			userId,
			status: "ok",
			digests: 0,
			projectsFound: 0,
			projectsCreated: 0,
			projectsUpdated: 0,
		};

		const token = await this.tokens.accessTokenFor(userId, "gmail");
		if (token.outcome === "not-connected") {
			return { ...base, status: "skipped", reason: token.reason };
		}
		if (token.outcome === "needs-reconnect") {
			return { ...base, status: "reconnect", reason: token.reason };
		}

		const ids = await this.candidateMessageIds(userId, token.accessToken);
		if (ids === null)
			return { ...base, status: "failed", reason: "list failed" };

		for (const id of ids) {
			const outcome = await this.processMessage(userId, token.accessToken, id);
			if (!outcome) continue;
			base.digests += 1;
			base.projectsFound += outcome.found;
			base.projectsCreated += outcome.created;
			base.projectsUpdated += outcome.updated;
		}

		if (base.digests > 0) {
			this.logger.log({
				message: "ConstructConnect digests processed",
				...base,
			});
		}
		return base;
	}

	private async candidateMessageIds(
		userId: string,
		accessToken: string,
	): Promise<string[] | null> {
		const latest = await this.db.constructConnectDigest.findFirst({
			where: { userId },
			orderBy: { receivedAt: "desc" },
			select: { receivedAt: true },
		});
		const since = latest
			? new Date(latest.receivedAt.getTime() - 24 * 60 * 60 * 1000)
			: new Date(Date.now() - FIRST_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
		const after = Math.floor(since.getTime() / 1000);

		const list = await this.api.get<MessageList>(
			`${GMAIL}/messages`,
			accessToken,
			{
				q: `from:${SENDER} after:${after}`,
				maxResults: 100,
			},
		);
		if (list.outcome !== "ok") {
			this.logger.warn({ message: "Digest list failed", reason: list.outcome });
			return null;
		}

		const ids = (list.data.messages ?? [])
			.map((m) => m.id)
			.filter((id): id is string => Boolean(id));
		if (ids.length === 0) return [];

		const seen = await this.db.constructConnectDigest.findMany({
			where: { gmailMessageId: { in: ids } },
			select: { gmailMessageId: true },
		});
		const done = new Set(seen.map((row) => row.gmailMessageId));
		return ids.filter((id) => !done.has(id)).slice(0, MAX_MESSAGES_PER_RUN);
	}

	private async processMessage(
		userId: string,
		accessToken: string,
		gmailMessageId: string,
	): Promise<{ found: number; created: number; updated: number } | null> {
		const result = await this.api.get<GmailMessage>(
			`${GMAIL}/messages/${gmailMessageId}`,
			accessToken,
			{ format: "full" },
		);
		if (result.outcome !== "ok") return null;

		const message = result.data;
		const subject = header(message.payload?.headers, "subject");
		const receivedAt = message.internalDate
			? new Date(Number(message.internalDate))
			: new Date();

		const encoded = htmlPartOf(message.payload);
		if (!encoded) {
			await this.record(userId, gmailMessageId, subject, null, receivedAt, {
				found: 0,
				created: 0,
				updated: 0,
				error: "No HTML part",
			});
			return { found: 0, created: 0, updated: 0 };
		}

		const parsed = parseDigest(decodeBase64Url(encoded), subject);
		let created = 0;
		let updated = 0;
		const errors: string[] = [];

		for (const project of parsed.projects) {
			try {
				const saved = await this.saveProject(project, parsed.searchName);
				if (saved.created) created += 1;
				else updated += 1;
			} catch (error) {
				const text = error instanceof Error ? error.message : String(error);
				errors.push(`${project.externalId}: ${text}`);
			}
		}

		await this.record(
			userId,
			gmailMessageId,
			subject,
			parsed.searchName,
			receivedAt,
			{
				found: parsed.projects.length,
				created,
				updated,
				error: errors.length ? errors.slice(0, 5).join(" | ") : null,
			},
		);

		return { found: parsed.projects.length, created, updated };
	}

	private async record(
		userId: string,
		gmailMessageId: string,
		subject: string | null,
		searchName: string | null,
		receivedAt: Date,
		stats: {
			found: number;
			created: number;
			updated: number;
			error: string | null;
		},
	) {
		await this.db.constructConnectDigest.upsert({
			where: { gmailMessageId },
			create: {
				gmailMessageId,
				userId,
				subject,
				searchName,
				receivedAt,
				projectsFound: stats.found,
				projectsCreated: stats.created,
				projectsUpdated: stats.updated,
				error: stats.error,
			},
			update: {
				projectsFound: stats.found,
				projectsCreated: stats.created,
				projectsUpdated: stats.updated,
				error: stats.error,
				processedAt: new Date(),
			},
		});
	}

	private async saveProject(project: DigestProject, searchName: string | null) {
		let architectId: string | null = null;
		let gcId: string | null = null;
		let developerId: string | null = null;

		for (const participant of project.participants) {
			const kind = roleKind(participant.role);
			if (kind === "other") continue;
			const companyId = await this.resolveCompany(participant);
			if (!companyId) continue;
			await this.ensureContact(participant, companyId);
			if (kind === "architect" && !architectId) architectId = companyId;
			if (kind === "gc" && !gcId) gcId = companyId;
			if (kind === "developer" && !developerId) developerId = companyId;
		}

		const reason = project.lastUpdateReason
			? searchName
				? `${project.lastUpdateReason} (${searchName})`
				: project.lastUpdateReason
			: searchName
				? `Seen in ${searchName}`
				: null;

		return this.projects.upsert({
			externalId: project.externalId,
			source: RecordSource.IMPORT,
			name: project.name,
			category: project.category,
			address: project.address,
			city: project.city,
			stateCode: project.stateCode,
			county: project.county,
			stage: project.stage,
			value: project.value,
			floors: project.floors,
			units: project.units,
			floorArea: project.floorArea,
			startDate: project.startDate,
			bidDate: project.bidDate,
			description: project.description,
			lastUpdateAt: project.lastUpdateAt,
			lastUpdateReason: reason,
			architectId,
			gcId,
			developerId,
		});
	}

	private async resolveCompany(
		participant: DigestParticipant,
	): Promise<string | null> {
		const name = participant.companyName.trim();
		if (!name || /^\d{7,}$/.test(name)) return null;
		const domain = domainFromEmail(participant.email);

		if (domain) {
			const byDomain = await this.db.company.findFirst({
				where: { domain, archivedAt: null },
				select: { id: true },
			});
			if (byDomain) return byDomain.id;
		}

		const byName = await this.db.company.findFirst({
			where: { name: { equals: name, mode: "insensitive" }, archivedAt: null },
			select: { id: true },
		});
		if (byName) return byName.id;

		const { city, stateCode } = cityStateFromAddress(participant.address);
		const created = await this.db.company.create({
			data: {
				name,
				domain: domain || null,
				phone: participant.phone,
				city,
				stateCode,
				industry: participant.role,
				source: RecordSource.IMPORT,
			},
			select: { id: true },
		});
		return created.id;
	}

	private async ensureContact(
		participant: DigestParticipant,
		companyId: string,
	) {
		const fullName = participant.contactName?.trim();
		if (!fullName) return;
		const [firstName, ...rest] = fullName.split(/\s+/);
		if (!firstName) return;
		const lastName = rest.join(" ") || null;
		const email = participant.email?.toLowerCase() ?? null;
		const personalEmail =
			email && !/^(info|bids|office|admin|contact|hello)@/.test(email);

		if (personalEmail && email) {
			const existing = await this.db.contact.findFirst({
				where: { email, archivedAt: null },
				select: { id: true },
			});
			if (existing) return;
		} else {
			const existing = await this.db.contact.findFirst({
				where: {
					companyId,
					firstName: { equals: firstName, mode: "insensitive" },
					lastName: lastName ? { equals: lastName, mode: "insensitive" } : null,
					archivedAt: null,
				},
				select: { id: true },
			});
			if (existing) return;
		}

		await this.db.contact.create({
			data: {
				firstName,
				lastName,
				email: personalEmail ? email : null,
				companyId,
				source: RecordSource.IMPORT,
			},
		});
	}
}

function domainFromEmail(email: string | null): string {
	if (!email) return "";
	const at = email.indexOf("@");
	if (at < 0) return "";
	const domain = email
		.slice(at + 1)
		.toLowerCase()
		.trim();
	return /(gmail|yahoo|hotmail|outlook|icloud|aol|cox|verizon|comcast|bellsouth)\./.test(
		domain,
	)
		? ""
		: domain;
}

function cityStateFromAddress(address: string | null): {
	city: string | null;
	stateCode: string | null;
} {
	if (!address) return { city: null, stateCode: null };
	const match = /,\s*([A-Za-z .'-]+?)\s*,\s*([A-Z]{2})\s+\d{5}/.exec(address);
	if (!match) return { city: null, stateCode: null };
	return { city: match[1]?.trim() ?? null, stateCode: match[2] ?? null };
}
