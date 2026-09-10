import {
	CALENDAR_WRITE_SCOPE,
	GMAIL_COMPOSE_SCOPE,
	parseScopes,
} from "@crm/auth";
import type { AgentWriteKind, Db, Prisma } from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";
import { MailboxApiClient } from "../mailbox/mailbox-api.client";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";
import type {
	CreateEventInput,
	DraftEmailInput,
	MoveEventInput,
	ProposeTodoInput,
	WriteListInput,
} from "./writes.contracts";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR = "https://www.googleapis.com/calendar/v3";
const SETTINGS_ID = "app";
const CRM_CALENDAR_NAME = "CRM";
const TIME_ZONE = "America/New_York";

const JOURNAL_VERB: Record<AgentWriteKind, string> = {
	DRAFT_EMAIL: "drafted",
	CREATE_EVENT: "scheduled",
	MOVE_EVENT: "moved",
	TODO: "to-do",
};

type Links = {
	contactId?: string | null;
	companyId?: string | null;
	projectId?: string | null;
	dealId?: string | null;
};

@Injectable()
export class WritesService {
	private readonly logger = new Logger(WritesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly api: MailboxApiClient,
		private readonly stamp: ActivityStampService,
	) {}

	async list(userId: string, input: WriteListInput) {
		const rows = await this.db.agentWrite.findMany({
			where: {
				userId,
				...(input.kind ? { kind: input.kind } : {}),
				...(input.since ? { createdAt: { gte: new Date(input.since) } } : {}),
			},
			orderBy: { createdAt: "desc" },
			take: input.limit,
			select: {
				id: true,
				kind: true,
				status: true,
				reason: true,
				summary: true,
				externalId: true,
				externalUrl: true,
				contact: { select: { id: true, firstName: true, lastName: true } },
				company: { select: { id: true, name: true } },
				project: { select: { id: true, name: true } },
				deal: { select: { id: true, name: true } },
				startsAt: true,
				endsAt: true,
				createdAt: true,
			},
		});
		return rows.map((row) => ({
			...row,
			startsAt: row.startsAt?.toISOString() ?? null,
			endsAt: row.endsAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
		}));
	}

	async draftEmail(userId: string, input: DraftEmailInput) {
		const accessToken = await this.tokenWithScope(userId, GMAIL_COMPOSE_SCOPE);
		const raw = buildMime({
			to: input.to,
			cc: input.cc,
			subject: input.subject,
			body: input.body,
			threadId: null,
		});

		const result = await this.api.send<{
			id: string;
			message?: { id?: string };
		}>("POST", `${GMAIL}/drafts`, accessToken, {
			message: {
				raw,
				...(input.gmailThreadId ? { threadId: input.gmailThreadId } : {}),
			},
		});

		if (result.outcome !== "ok") {
			await this.record(
				userId,
				"DRAFT_EMAIL",
				"FAILED",
				input.reason,
				`Draft to ${input.to.join(", ")}: ${input.subject}`,
				input,
				null,
				null,
				null,
				input,
			);
			throw new BadRequestException(
				`Gmail would not save the draft: ${result.reason}.`,
			);
		}

		const draftId = result.data.id;
		const url = `https://mail.google.com/mail/u/0/#drafts?compose=${draftId}`;
		const write = await this.record(
			userId,
			"DRAFT_EMAIL",
			"DONE",
			input.reason,
			`Draft to ${input.to.join(", ")}: ${input.subject}`,
			{ to: input.to, cc: input.cc, subject: input.subject, body: input.body },
			draftId,
			url,
			null,
			input,
		);
		return { id: write.id, draftId, url };
	}

	async createEvent(userId: string, input: CreateEventInput) {
		const accessToken = await this.tokenWithScope(userId, CALENDAR_WRITE_SCOPE);
		const calendarId = await this.ensureCalendar(accessToken);
		const event = await this.insertEvent(accessToken, calendarId, input);
		const write = await this.record(
			userId,
			"CREATE_EVENT",
			"DONE",
			input.reason,
			`${input.title} · ${formatWhen(input.start, input.end)}`,
			{ calendarId, title: input.title, description: input.description },
			event.id,
			event.htmlLink ?? null,
			{ start: input.start, end: input.end },
			input,
		);
		return { id: write.id, eventId: event.id, url: event.htmlLink ?? null };
	}

	async proposeTodo(userId: string, input: ProposeTodoInput) {
		const accessToken = await this.tokenWithScope(userId, CALENDAR_WRITE_SCOPE);
		const calendarId = await this.ensureCalendar(accessToken);
		const start = new Date(input.due);
		const end = new Date(start.getTime() + input.minutes * 60_000);
		const event = await this.insertEvent(accessToken, calendarId, {
			title: `To-do: ${input.title}`,
			description: input.details ?? null,
			start: start.toISOString(),
			end: end.toISOString(),
		});
		const write = await this.record(
			userId,
			"TODO",
			"DONE",
			input.reason,
			`${input.title} · ${formatWhen(start.toISOString(), end.toISOString())}`,
			{ calendarId, title: input.title, details: input.details },
			event.id,
			event.htmlLink ?? null,
			{ start: start.toISOString(), end: end.toISOString() },
			input,
		);
		return { id: write.id, eventId: event.id, url: event.htmlLink ?? null };
	}

	async moveEvent(userId: string, input: MoveEventInput) {
		const own = await this.db.agentWrite.findFirst({
			where: {
				userId,
				externalId: input.eventId,
				kind: { in: ["CREATE_EVENT", "TODO"] },
			},
			select: { id: true, summary: true },
		});
		if (!own) {
			throw new ForbiddenException(
				"The agent can only move events it created. This one was not.",
			);
		}

		const accessToken = await this.tokenWithScope(userId, CALENDAR_WRITE_SCOPE);
		const calendarId = await this.ensureCalendar(accessToken);
		const result = await this.api.send<{ id: string; htmlLink?: string }>(
			"PATCH",
			`${CALENDAR}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
			accessToken,
			{
				start: { dateTime: input.start, timeZone: TIME_ZONE },
				end: { dateTime: input.end, timeZone: TIME_ZONE },
			},
		);
		if (result.outcome !== "ok") {
			throw new BadRequestException(
				`Calendar would not move the event: ${result.reason}.`,
			);
		}

		const write = await this.record(
			userId,
			"MOVE_EVENT",
			"DONE",
			input.reason,
			`Moved "${own.summary}" to ${formatWhen(input.start, input.end)}`,
			{ calendarId, from: own.id },
			input.eventId,
			result.data.htmlLink ?? null,
			{ start: input.start, end: input.end },
			{},
		);
		return {
			id: write.id,
			eventId: input.eventId,
			url: result.data.htmlLink ?? null,
		};
	}

	async markCompleted(userId: string, id: string) {
		const row = await this.db.agentWrite.findFirst({ where: { id, userId } });
		if (!row) throw new NotFoundException("No such write.");
		await this.db.agentWrite.update({
			where: { id },
			data: { status: "COMPLETED_BY_USER" },
		});
		return { id };
	}

	private async tokenWithScope(userId: string, scope: string): Promise<string> {
		const account = await this.db.account.findFirst({
			where: { userId, providerId: "google" },
			select: { scope: true },
		});
		if (!parseScopes(account?.scope).has(scope)) {
			throw new ForbiddenException(
				"Google has not granted write access yet. Sign out and back in to approve the new permissions.",
			);
		}
		const token = await this.tokens.accessTokenFor(userId, "gmail");
		if (token.outcome !== "ok") {
			throw new ForbiddenException(token.reason);
		}
		return token.accessToken;
	}

	private async ensureCalendar(accessToken: string): Promise<string> {
		const settings = await this.db.appSetting.findUnique({
			where: { id: SETTINGS_ID },
			select: { agentCalendarId: true },
		});
		if (settings?.agentCalendarId) return settings.agentCalendarId;

		const listed = await this.api.get<{
			items?: { id?: string; summary?: string; accessRole?: string }[];
		}>(`${CALENDAR}/users/me/calendarList`, accessToken, {
			minAccessRole: "owner",
		});
		const existing =
			listed.outcome === "ok"
				? listed.data.items?.find((item) => item.summary === CRM_CALENDAR_NAME)
						?.id
				: undefined;

		let calendarId = existing ?? null;
		if (!calendarId) {
			const created = await this.api.send<{ id: string }>(
				"POST",
				`${CALENDAR}/calendars`,
				accessToken,
				{
					summary: CRM_CALENDAR_NAME,
					description:
						"Agent-owned to-dos and follow-ups. The agent only moves events on this calendar.",
					timeZone: TIME_ZONE,
				},
			);
			if (created.outcome !== "ok") {
				throw new BadRequestException(
					`Could not create the CRM calendar: ${created.reason}.`,
				);
			}
			calendarId = created.data.id;
		}

		await this.db.appSetting.upsert({
			where: { id: SETTINGS_ID },
			create: { id: SETTINGS_ID, agentCalendarId: calendarId },
			update: { agentCalendarId: calendarId },
		});
		this.logger.log({ message: "CRM calendar ready", calendarId });
		return calendarId;
	}

	private async insertEvent(
		accessToken: string,
		calendarId: string,
		input: {
			title: string;
			description?: string | null;
			start: string;
			end: string;
		},
	): Promise<{ id: string; htmlLink?: string }> {
		const result = await this.api.send<{ id: string; htmlLink?: string }>(
			"POST",
			`${CALENDAR}/calendars/${encodeURIComponent(calendarId)}/events`,
			accessToken,
			{
				summary: input.title,
				description: input.description ?? undefined,
				start: { dateTime: input.start, timeZone: TIME_ZONE },
				end: { dateTime: input.end, timeZone: TIME_ZONE },
			},
		);
		if (result.outcome !== "ok") {
			throw new BadRequestException(
				`Calendar would not create the event: ${result.reason}.`,
			);
		}
		return result.data;
	}

	private async record(
		userId: string,
		kind: AgentWriteKind,
		status: "DONE" | "FAILED",
		reason: string,
		summary: string,
		payload: Prisma.InputJsonValue,
		externalId: string | null,
		externalUrl: string | null,
		when: { start: string; end: string } | null,
		links: Links,
	) {
		const write = await this.db.agentWrite.create({
			data: {
				userId,
				kind,
				status,
				reason,
				summary,
				payload,
				externalId,
				externalUrl,
				contactId: links.contactId ?? null,
				companyId: links.companyId ?? null,
				projectId: links.projectId ?? null,
				dealId: links.dealId ?? null,
				startsAt: when ? new Date(when.start) : null,
				endsAt: when ? new Date(when.end) : null,
			},
			select: { id: true },
		});

		if (status === "DONE")
			await this.journal(
				userId,
				kind,
				summary,
				reason,
				externalUrl,
				when,
				links,
			);
		return write;
	}

	private async journal(
		userId: string,
		kind: AgentWriteKind,
		summary: string,
		reason: string,
		externalUrl: string | null,
		when: { start: string; end: string } | null,
		links: Links,
	) {
		const hasTarget = Boolean(
			links.contactId || links.companyId || links.projectId || links.dealId,
		);
		if (!hasTarget) return;

		const isTask = kind === "TODO";
		const subject = `Agent: ${JOURNAL_VERB[kind]} — ${summary}`;
		const body = [reason, externalUrl ? `Link: ${externalUrl}` : null]
			.filter(Boolean)
			.join("\n");
		const now = new Date();

		const targets: Links[] = [];
		if (links.projectId)
			targets.push({
				projectId: links.projectId,
				companyId: links.companyId ?? null,
			});
		if (links.contactId)
			targets.push({
				contactId: links.contactId,
				companyId: links.companyId ?? null,
			});
		if (
			!links.projectId &&
			!links.contactId &&
			(links.companyId || links.dealId)
		) {
			targets.push({
				companyId: links.companyId ?? null,
				dealId: links.dealId ?? null,
			});
		}

		for (const target of targets) {
			await this.db.activity.create({
				data: {
					type: isTask ? "TASK" : "NOTE",
					subject,
					body,
					occurredAt: now,
					dueAt: isTask && when ? new Date(when.start) : null,
					projectId: target.projectId ?? null,
					contactId: target.contactId ?? null,
					companyId: target.companyId ?? null,
					dealId: target.dealId ?? null,
					createdById: userId,
					meta: { agentWrite: kind },
				},
			});
			await this.stamp.touch(target, now);
		}
	}
}

function buildMime(message: {
	to: string[];
	cc: string[];
	subject: string;
	body: string;
	threadId: string | null;
}): string {
	const lines = [
		`To: ${message.to.join(", ")}`,
		...(message.cc.length ? [`Cc: ${message.cc.join(", ")}`] : []),
		`Subject: ${encodeHeader(message.subject)}`,
		"MIME-Version: 1.0",
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: 8bit",
		"",
		message.body,
	];
	return Buffer.from(lines.join("\r\n"), "utf8")
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function encodeHeader(value: string): string {
	return /^[\x20-\x7e]*$/.test(value)
		? value
		: `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatWhen(start: string, end: string): string {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
	const endFmt = new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		hour: "numeric",
		minute: "2-digit",
	});
	return `${fmt.format(new Date(start))} – ${endFmt.format(new Date(end))}`;
}
