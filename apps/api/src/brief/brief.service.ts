import { GMAIL_SEND_SCOPE, parseScopes } from "@crm/auth";
import type { Db } from "@crm/db";
import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import { MailboxApiClient } from "../mailbox/mailbox-api.client";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIME_ZONE = "America/New_York";
const DAY = 24 * 60 * 60 * 1000;

export type BriefItem = {
	title: string;
	detail: string | null;
	url: string | null;
	kind: string;
};

export type Brief = {
	date: string;
	generatedAt: string;
	agentDid: BriefItem[];
	needsYou: BriefItem[];
	clocks: BriefItem[];
	projectUpdates: BriefItem[];
	today: BriefItem[];
	digests: {
		count: number;
		projectsFound: number;
		created: number;
		updated: number;
	};
};

@Injectable()
export class BriefService {
	private readonly logger = new Logger(BriefService.name);

	private readonly appUrl: string;

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly api: MailboxApiClient,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.appUrl = (config.get("APP_URL", { infer: true }) ?? "").replace(
			/\/$/,
			"",
		);
	}

	async compose(userId: string, now = new Date()): Promise<Brief> {
		const since = new Date(now.getTime() - DAY);
		const endOfToday = endOfDayEastern(now);
		const startOfToday = startOfDayEastern(now);

		const [writes, tasks, quotes, projects, watching, events, digests] =
			await Promise.all([
				this.db.agentWrite.findMany({
					where: { userId, createdAt: { gte: since } },
					orderBy: { createdAt: "desc" },
					select: {
						kind: true,
						summary: true,
						reason: true,
						externalUrl: true,
						status: true,
						project: { select: { id: true, name: true } },
						contact: { select: { firstName: true, lastName: true } },
					},
				}),
				this.db.activity.findMany({
					where: {
						type: "TASK",
						completedAt: null,
						dueAt: { lte: endOfToday },
					},
					orderBy: { dueAt: "asc" },
					take: 25,
					select: {
						subject: true,
						dueAt: true,
						project: { select: { id: true, name: true } },
						contact: { select: { id: true, firstName: true, lastName: true } },
						company: { select: { id: true, name: true } },
					},
				}),
				this.db.deal.findMany({
					where: {
						archivedAt: null,
						closedAt: null,
						expectedCloseDate: { not: null },
					},
					select: {
						id: true,
						name: true,
						channel: true,
						expectedCloseDate: true,
						lastActivityAt: true,
						company: { select: { name: true } },
						project: { select: { id: true, name: true } },
					},
				}),
				this.db.project.findMany({
					where: {
						archivedAt: null,
						lastUpdateAt: { gte: since },
						OR: [
							{ leadStatus: "QUALIFIED" },
							{ leadStatus: "WATCH" },
							{ value: { gte: 20_000_000 } },
						],
					},
					orderBy: { lastUpdateAt: "desc" },
					take: 20,
					select: {
						id: true,
						name: true,
						city: true,
						stateCode: true,
						stage: true,
						lastUpdateReason: true,
						architect: { select: { name: true } },
					},
				}),
				this.db.project.findMany({
					where: {
						archivedAt: null,
						leadStatus: "WATCH",
						watchUntil: { lte: endOfToday },
					},
					take: 20,
					select: { id: true, name: true, stage: true },
				}),
				this.db.calendarEvent.findMany({
					where: {
						startsAt: { gte: startOfToday, lte: endOfToday },
					},
					orderBy: { startsAt: "asc" },
					take: 20,
					select: { title: true, startsAt: true, endsAt: true },
				}),
				this.db.constructConnectDigest.aggregate({
					where: { userId, processedAt: { gte: since } },
					_count: { _all: true },
					_sum: {
						projectsFound: true,
						projectsCreated: true,
						projectsUpdated: true,
					},
				}),
			]);

		const agentDid: BriefItem[] = writes
			.filter((w) => w.status !== "FAILED")
			.map((w) => ({
				kind: w.kind,
				title: w.summary,
				detail: w.reason,
				url:
					w.externalUrl ?? (w.project ? this.projectUrl(w.project.id) : null),
			}));

		const needsYou: BriefItem[] = [
			...writes
				.filter((w) => w.kind === "DRAFT_EMAIL" && w.status === "DONE")
				.map((w) => ({
					kind: "draft",
					title: `Send or rewrite: ${w.summary}`,
					detail: null,
					url: w.externalUrl,
				})),
			...tasks.map((t) => ({
				kind: "task",
				title: t.subject ?? "Task",
				detail: [
					t.dueAt && t.dueAt < startOfToday ? "overdue" : "due today",
					t.project?.name ?? t.company?.name ?? contactName(t.contact),
				]
					.filter(Boolean)
					.join(" · "),
				url: t.project ? this.projectUrl(t.project.id) : null,
			})),
			...watching.map((p) => ({
				kind: "watch",
				title: `Re-check: ${p.name}`,
				detail: `Watch date reached · ${p.stage}`,
				url: this.projectUrl(p.id),
			})),
		];

		const clocks: BriefItem[] = quotes
			.map((q): BriefItem | null => {
				const bid = q.expectedCloseDate as Date;
				const daysPastBid = Math.floor((now.getTime() - bid.getTime()) / DAY);
				const quiet = q.lastActivityAt
					? Math.floor((now.getTime() - q.lastActivityAt.getTime()) / DAY)
					: null;
				const label =
					daysPastBid >= 180
						? "6 months past bid — call the GC"
						: daysPastBid >= 90
							? "90 days past bid — escalate"
							: daysPastBid >= 60
								? "60 days — check in"
								: daysPastBid >= 30
									? "30 days — check in"
									: daysPastBid >= 14
										? "2 weeks past bid — ask where it landed"
										: daysPastBid >= 0
											? "bid day"
											: null;
				if (!label) return null;
				const who = q.channel === "DIRECT" ? "direct (you)" : q.company.name;
				return {
					kind: "clock",
					title: `${q.project?.name ?? q.name} · ${who}`,
					detail: `${label}${quiet !== null ? ` · ${quiet}d since last activity` : ""}`,
					url: q.project ? this.projectUrl(q.project.id) : null,
				};
			})
			.filter((x): x is BriefItem => x !== null)
			.slice(0, 15);

		const projectUpdates: BriefItem[] = projects.map((p) => ({
			kind: "update",
			title: p.name,
			detail: [
				p.lastUpdateReason,
				p.architect?.name,
				[p.city, p.stateCode].filter(Boolean).join(", "),
			]
				.filter(Boolean)
				.join(" · "),
			url: this.projectUrl(p.id),
		}));

		const today: BriefItem[] = events.map((e) => ({
			kind: "event",
			title: e.title ?? "(untitled)",
			detail: `${timeOf(e.startsAt)}${e.endsAt ? `–${timeOf(e.endsAt)}` : ""}`,
			url: null,
		}));

		return {
			date: dateLabel(now),
			generatedAt: now.toISOString(),
			agentDid,
			needsYou,
			clocks,
			projectUpdates,
			today,
			digests: {
				count: digests._count._all,
				projectsFound: digests._sum.projectsFound ?? 0,
				created: digests._sum.projectsCreated ?? 0,
				updated: digests._sum.projectsUpdated ?? 0,
			},
		};
	}

	async send(
		userId: string,
		brief: Brief,
	): Promise<{ sent: boolean; reason?: string }> {
		const account = await this.db.account.findFirst({
			where: { userId, providerId: "google" },
			select: { scope: true },
		});
		if (!parseScopes(account?.scope).has(GMAIL_SEND_SCOPE)) {
			throw new ForbiddenException(
				"Gmail send access has not been granted yet. Sign out and back in to approve it.",
			);
		}
		const user = await this.db.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true },
		});
		if (!user?.email) return { sent: false, reason: "No email on the user." };

		const token = await this.tokens.accessTokenFor(userId, "gmail");
		if (token.outcome !== "ok") return { sent: false, reason: token.reason };

		const subject = `Daily brief — ${brief.date}`;
		const raw = mime(
			user.email,
			user.email,
			subject,
			renderText(brief),
			renderHtml(brief),
		);
		const result = await this.api.send<{ id: string }>(
			"POST",
			`${GMAIL}/messages/send`,
			token.accessToken,
			{ raw },
		);
		if (result.outcome !== "ok") {
			this.logger.warn({ message: "Brief send failed", reason: result.reason });
			return { sent: false, reason: result.reason };
		}
		this.logger.log({
			message: "Brief sent",
			userId,
			items: brief.needsYou.length,
		});
		return { sent: true };
	}

	private projectUrl(id: string): string {
		return `${this.appUrl}/${this.slug}/projects/${id}`;
	}

	private slug = "";

	async withSlug(): Promise<this> {
		const workspace = await this.db.organization.findFirst({
			select: { slug: true },
		});
		this.slug = workspace?.slug ?? "";
		return this;
	}
}

function contactName(c: { firstName: string; lastName: string | null } | null) {
	return c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : null;
}

function startOfDayEastern(now: Date): Date {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	const local = new Date(
		`${get("year")}-${get("month")}-${get("day")}T00:00:00`,
	);
	const offset = tzOffsetMinutes(now);
	return new Date(local.getTime() + offset * 60_000);
}

function endOfDayEastern(now: Date): Date {
	return new Date(startOfDayEastern(now).getTime() + DAY - 1);
}

function tzOffsetMinutes(at: Date): number {
	const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
	const local = new Date(at.toLocaleString("en-US", { timeZone: TIME_ZONE }));
	return (utc.getTime() - local.getTime()) / 60_000;
}

function timeOf(d: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		hour: "numeric",
		minute: "2-digit",
	}).format(d);
}

function dateLabel(d: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(d);
}

function section(title: string, items: BriefItem[], empty: string): string {
	const lines = items.length
		? items.map(
				(i) =>
					`- ${i.title}${i.detail ? ` — ${i.detail}` : ""}${i.url ? `\n  ${i.url}` : ""}`,
			)
		: [`  ${empty}`];
	return `${title}\n${lines.join("\n")}`;
}

export function renderText(b: Brief): string {
	return [
		`Daily brief — ${b.date}`,
		"",
		section("NEEDS YOU", b.needsYou, "Nothing waiting."),
		"",
		section("QUOTE CLOCKS", b.clocks, "No quotes at a checkpoint."),
		"",
		section("TODAY", b.today, "Nothing on the calendar."),
		"",
		section(
			`OVERNIGHT — ${b.digests.count} digest${b.digests.count === 1 ? "" : "s"}, ${b.digests.created} new projects, ${b.digests.updated} updated`,
			b.projectUpdates,
			"No project changes worth a line.",
		),
		"",
		section("WHAT THE AGENT DID", b.agentDid, "Nothing yet."),
	].join("\n");
}

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlSection(title: string, items: BriefItem[], empty: string): string {
	const body = items.length
		? `<ul style="padding-left:18px;margin:6px 0">${items
				.map(
					(i) =>
						`<li style="margin:4px 0">${i.url ? `<a href="${esc(i.url)}">${esc(i.title)}</a>` : esc(i.title)}${
							i.detail
								? ` <span style="color:#666">— ${esc(i.detail)}</span>`
								: ""
						}</li>`,
				)
				.join("")}</ul>`
		: `<p style="color:#888;margin:6px 0">${esc(empty)}</p>`;
	return `<h3 style="margin:18px 0 4px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#444">${esc(title)}</h3>${body}`;
}

export function renderHtml(b: Brief): string {
	return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;max-width:640px">
<h2 style="margin:0 0 4px">Daily brief</h2>
<div style="color:#666">${esc(b.date)}</div>
${htmlSection("Needs you", b.needsYou, "Nothing waiting.")}
${htmlSection("Quote clocks", b.clocks, "No quotes at a checkpoint.")}
${htmlSection("Today", b.today, "Nothing on the calendar.")}
${htmlSection(
	`Overnight — ${b.digests.count} digest${b.digests.count === 1 ? "" : "s"}, ${b.digests.created} new projects, ${b.digests.updated} updated`,
	b.projectUpdates,
	"No project changes worth a line.",
)}
${htmlSection("What the agent did", b.agentDid, "Nothing yet.")}
</div>`;
}

function mime(
	from: string,
	to: string,
	subject: string,
	text: string,
	html: string,
): string {
	const boundary = `b_${Date.now().toString(36)}`;
	const lines = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: 8bit",
		"",
		text,
		"",
		`--${boundary}`,
		'Content-Type: text/html; charset="UTF-8"',
		"Content-Transfer-Encoding: 8bit",
		"",
		html,
		"",
		`--${boundary}--`,
	];
	return Buffer.from(lines.join("\r\n"), "utf8")
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
