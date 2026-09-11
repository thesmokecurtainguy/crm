import { GMAIL_SEND_SCOPE, parseScopes } from "@crm/auth";
import type { Db } from "@crm/db";
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

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIME_ZONE = "America/New_York";

export type RenderContext = {
	contactId?: string | null;
	companyId?: string | null;
	projectId?: string | null;
	dealId?: string | null;
};

export const PLACEHOLDERS = [
	"firstName",
	"lastName",
	"fullName",
	"title",
	"firm",
	"firmCity",
	"project",
	"city",
	"state",
	"stage",
	"value",
	"floors",
	"bidDate",
	"gc",
	"architect",
	"today",
] as const;

@Injectable()
export class TemplatesService {
	private readonly logger = new Logger(TemplatesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly api: MailboxApiClient,
		private readonly stamp: ActivityStampService,
	) {}

	async list(includeArchived = false) {
		return this.db.emailTemplate.findMany({
			where: includeArchived ? {} : { archivedAt: null },
			orderBy: { name: "asc" },
		});
	}

	async byId(id: string) {
		const template = await this.db.emailTemplate.findUnique({ where: { id } });
		if (!template) throw new NotFoundException("No such template.");
		return template;
	}

	async create(
		input: {
			name: string;
			description?: string | null;
			subject: string;
			body: string;
		},
		userId: string,
	) {
		return this.db.emailTemplate.create({
			data: { ...input, createdById: userId },
		});
	}

	async update(
		id: string,
		input: {
			name?: string;
			description?: string | null;
			subject?: string;
			body?: string;
		},
	) {
		await this.byId(id);
		return this.db.emailTemplate.update({ where: { id }, data: input });
	}

	async archive(id: string) {
		await this.byId(id);
		return this.db.emailTemplate.update({
			where: { id },
			data: { archivedAt: new Date() },
		});
	}

	async values(context: RenderContext): Promise<Record<string, string>> {
		const [contact, project] = await Promise.all([
			context.contactId
				? this.db.contact.findUnique({
						where: { id: context.contactId },
						select: {
							firstName: true,
							lastName: true,
							title: true,
							email: true,
							company: {
								select: { id: true, name: true, city: true, stateCode: true },
							},
						},
					})
				: null,
			context.projectId
				? this.db.project.findUnique({
						where: { id: context.projectId },
						select: {
							name: true,
							city: true,
							stateCode: true,
							stage: true,
							value: true,
							floors: true,
							bidDate: true,
							gc: { select: { name: true } },
							architect: { select: { name: true } },
						},
					})
				: null,
		]);

		const company =
			contact?.company ??
			(context.companyId
				? await this.db.company.findUnique({
						where: { id: context.companyId },
						select: { id: true, name: true, city: true, stateCode: true },
					})
				: null);

		const deal = context.dealId
			? await this.db.deal.findUnique({
					where: { id: context.dealId },
					select: {
						expectedCloseDate: true,
						company: { select: { name: true } },
					},
				})
			: null;

		const fullName = [contact?.firstName, contact?.lastName]
			.filter(Boolean)
			.join(" ");
		const bid = deal?.expectedCloseDate ?? project?.bidDate ?? null;

		return {
			firstName: contact?.firstName ?? "",
			lastName: contact?.lastName ?? "",
			fullName,
			title: contact?.title ?? "",
			firm: company?.name ?? deal?.company?.name ?? "",
			firmCity: [company?.city, company?.stateCode].filter(Boolean).join(", "),
			project: project?.name ?? "",
			city: project?.city ?? "",
			state: project?.stateCode ?? "",
			stage: project ? stageLabel(project.stage) : "",
			value: project?.value ? money(project.value.toNumber()) : "",
			floors: project?.floors ? String(project.floors) : "",
			bidDate: bid ? day(bid) : "",
			gc: project?.gc?.name ?? "",
			architect: project?.architect?.name ?? "",
			today: day(new Date()),
		};
	}

	async render(templateId: string, context: RenderContext) {
		const template = await this.byId(templateId);
		const values = await this.values(context);
		return {
			subject: fill(template.subject, values),
			body: fill(template.body, values),
			missing: missingKeys(`${template.subject}\n${template.body}`, values),
		};
	}

	async send(
		userId: string,
		input: {
			to: string[];
			cc: string[];
			subject: string;
			body: string;
			contactId?: string | null;
			companyId?: string | null;
			projectId?: string | null;
			dealId?: string | null;
			gmailThreadId?: string | null;
		},
	) {
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
		if (!user?.email)
			throw new BadRequestException("No email on the signed-in user.");

		const token = await this.tokens.accessTokenFor(userId, "gmail");
		if (token.outcome !== "ok") throw new ForbiddenException(token.reason);

		const raw = mime({
			from: user.name ? `${user.name} <${user.email}>` : user.email,
			to: input.to,
			cc: input.cc,
			subject: input.subject,
			body: input.body,
		});
		const result = await this.api.send<{ id: string; threadId?: string }>(
			"POST",
			`${GMAIL}/messages/send`,
			token.accessToken,
			{
				raw,
				...(input.gmailThreadId ? { threadId: input.gmailThreadId } : {}),
			},
		);
		if (result.outcome !== "ok") {
			throw new BadRequestException(`Gmail would not send: ${result.reason}.`);
		}

		let companyId = input.companyId ?? null;
		if (!companyId && input.contactId) {
			const c = await this.db.contact.findUnique({
				where: { id: input.contactId },
				select: { companyId: true },
			});
			companyId = c?.companyId ?? null;
		}

		const now = new Date();
		const hasTarget = Boolean(
			input.contactId || companyId || input.projectId || input.dealId,
		);
		if (hasTarget) {
			await this.db.activity.create({
				data: {
					type: "EMAIL",
					subject: `Sent: ${input.subject}`,
					body: `To ${input.to.join(", ")}\n\n${input.body}`,
					occurredAt: now,
					contactId: input.contactId ?? null,
					companyId,
					projectId: input.projectId ?? null,
					dealId: input.dealId ?? null,
					createdById: userId,
					meta: {
						gmailMessageId: result.data.id,
						gmailThreadId: result.data.threadId ?? null,
					},
				},
			});
			await this.stamp.touch(
				{
					contactId: input.contactId ?? null,
					companyId,
					projectId: input.projectId ?? null,
					dealId: input.dealId ?? null,
				},
				now,
			);
		}

		this.logger.log({
			message: "Email sent from CRM",
			userId,
			to: input.to.length,
		});
		return {
			sent: true,
			gmailMessageId: result.data.id,
			gmailThreadId: result.data.threadId ?? null,
		};
	}
}

export function fill(text: string, values: Record<string, string>): string {
	const withSections = text.replace(
		/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
		(_, key: string, inner: string) => (values[key] ? inner : ""),
	);
	return withSections.replace(
		/\{\{(\w+)\}\}/g,
		(_, key: string) => values[key] ?? "",
	);
}

export function missingKeys(
	text: string,
	values: Record<string, string>,
): string[] {
	const keys = new Set<string>();
	for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
		const key = match[1] ?? "";
		if (key && !values[key]) keys.add(key);
	}
	return [...keys];
}

function stageLabel(stage: string): string {
	return stage
		.toLowerCase()
		.replace(/_/g, " ")
		.replace(/^\w/, (c) => c.toUpperCase());
}

function money(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: value >= 1_000_000 ? "compact" : "standard",
		maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
	}).format(value);
}

function day(d: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		month: "long",
		day: "numeric",
	}).format(d);
}

function mime(message: {
	from: string;
	to: string[];
	cc: string[];
	subject: string;
	body: string;
}): string {
	const lines = [
		`From: ${message.from}`,
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
