import type { Db, Prisma } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export type MergeKind = "contact" | "company" | "project";

export type MergeResult = {
	kind: MergeKind;
	keepId: string;
	mergedId: string;
	moved: Record<string, number>;
};

@Injectable()
export class MergeService {
	private readonly logger = new Logger(MergeService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async merge(
		kind: MergeKind,
		keepId: string,
		mergeId: string,
		userId: string,
	): Promise<MergeResult> {
		if (keepId === mergeId)
			throw new BadRequestException("Pick two different records.");
		const moved = await this.db.$transaction(async (tx) => {
			switch (kind) {
				case "contact":
					return this.mergeContacts(tx, keepId, mergeId, userId);
				case "company":
					return this.mergeCompanies(tx, keepId, mergeId, userId);
				case "project":
					return this.mergeProjects(tx, keepId, mergeId, userId);
			}
		});
		this.logger.log({
			message: "Records merged",
			kind,
			keepId,
			mergedId: mergeId,
			moved,
		});
		return { kind, keepId, mergedId: mergeId, moved };
	}

	private async mergeContacts(
		tx: Prisma.TransactionClient,
		keepId: string,
		mergeId: string,
		userId: string,
	) {
		const [keep, lose] = await Promise.all([
			tx.contact.findUnique({ where: { id: keepId } }),
			tx.contact.findUnique({ where: { id: mergeId } }),
		]);
		if (!keep || !lose)
			throw new NotFoundException("One of the contacts does not exist.");

		const moved: Record<string, number> = {};
		const move = async (
			label: string,
			run: () => Promise<{ count: number }>,
		) => {
			moved[label] = (await run()).count;
		};

		await move("activities", () =>
			tx.activity.updateMany({
				where: { contactId: mergeId },
				data: { contactId: keepId },
			}),
		);
		await move("emailThreads", () =>
			tx.emailThread.updateMany({
				where: { contactId: mergeId },
				data: { contactId: keepId },
			}),
		);
		await move("calendarEvents", () =>
			tx.calendarEvent.updateMany({
				where: { contactId: mergeId },
				data: { contactId: keepId },
			}),
		);
		await move("agentWrites", () =>
			tx.agentWrite.updateMany({
				where: { contactId: mergeId },
				data: { contactId: keepId },
			}),
		);
		await move("conversations", () =>
			tx.agentConversation.updateMany({
				where: { contactId: mergeId },
				data: { contactId: keepId },
			}),
		);
		await move("facts", () =>
			tx.contactFact.updateMany({
				where: { contactId: mergeId },
				data: { contactId: keepId },
			}),
		);

		const keepDealIds = new Set(
			(
				await tx.dealContact.findMany({
					where: { contactId: keepId },
					select: { dealId: true },
				})
			).map((d) => d.dealId),
		);
		const loseDeals = await tx.dealContact.findMany({
			where: { contactId: mergeId },
		});
		let dealsMoved = 0;
		for (const link of loseDeals) {
			await tx.dealContact.delete({
				where: {
					dealId_contactId: { dealId: link.dealId, contactId: mergeId },
				},
			});
			if (!keepDealIds.has(link.dealId)) {
				await tx.dealContact.create({
					data: { dealId: link.dealId, contactId: keepId, role: link.role },
				});
				dealsMoved += 1;
			}
		}
		moved.deals = dealsMoved;

		const keepProjectIds = new Set(
			(
				await tx.projectParticipant.findMany({
					where: { contactId: keepId },
					select: { projectId: true },
				})
			).map((p) => p.projectId),
		);
		const loseRoles = await tx.projectParticipant.findMany({
			where: { contactId: mergeId },
		});
		let rolesMoved = 0;
		for (const role of loseRoles) {
			if (keepProjectIds.has(role.projectId)) {
				await tx.projectParticipant.delete({ where: { id: role.id } });
			} else {
				await tx.projectParticipant.update({
					where: { id: role.id },
					data: { contactId: keepId },
				});
				rolesMoved += 1;
			}
		}
		moved.projectRoles = rolesMoved;

		const keepFields = new Set(
			(
				await tx.fieldValue.findMany({
					where: { contactId: keepId },
					select: { fieldId: true },
				})
			).map((f) => f.fieldId),
		);
		const loseFields = await tx.fieldValue.findMany({
			where: { contactId: mergeId },
		});
		let fieldsMoved = 0;
		for (const value of loseFields) {
			if (keepFields.has(value.fieldId)) {
				await tx.fieldValue.delete({ where: { id: value.id } });
			} else {
				await tx.fieldValue.update({
					where: { id: value.id },
					data: { contactId: keepId },
				});
				fieldsMoved += 1;
			}
		}
		moved.fields = fieldsMoved;

		await tx.contact.update({
			where: { id: keepId },
			data: {
				lastName: keep.lastName ?? lose.lastName,
				phone: keep.phone ?? lose.phone,
				title: keep.title ?? lose.title,
				linkedinUrl: keep.linkedinUrl ?? lose.linkedinUrl,
				companyId: keep.companyId ?? lose.companyId,
				lastActivityAt: maxDate(keep.lastActivityAt, lose.lastActivityAt),
			},
		});

		const loserEmail = lose.email;
		await tx.contact.update({
			where: { id: mergeId },
			data: {
				archivedAt: new Date(),
				email: loserEmail ? `${loserEmail}#merged-${mergeId.slice(-6)}` : null,
			},
		});
		if (loserEmail && !keep.email) {
			await tx.contact.update({
				where: { id: keepId },
				data: { email: loserEmail },
			});
		}

		await tx.activity.create({
			data: {
				type: "NOTE",
				subject: `Merged: ${[lose.firstName, lose.lastName].filter(Boolean).join(" ")} folded into this contact`,
				body: `Duplicate contact ${mergeId} was merged here${loserEmail ? ` (${loserEmail})` : ""}. Its notes, emails, meetings, deals and project roles now live on this record.`,
				occurredAt: new Date(),
				contactId: keepId,
				companyId: keep.companyId ?? lose.companyId,
				createdById: userId,
				meta: { merge: { kind: "contact", mergedId: mergeId } },
			},
		});

		return moved;
	}

	private async mergeCompanies(
		tx: Prisma.TransactionClient,
		keepId: string,
		mergeId: string,
		userId: string,
	) {
		const [keep, lose] = await Promise.all([
			tx.company.findUnique({ where: { id: keepId } }),
			tx.company.findUnique({ where: { id: mergeId } }),
		]);
		if (!keep || !lose)
			throw new NotFoundException("One of the companies does not exist.");

		const moved: Record<string, number> = {};
		const move = async (
			label: string,
			run: () => Promise<{ count: number }>,
		) => {
			moved[label] = (await run()).count;
		};

		await move("contacts", () =>
			tx.contact.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("deals", () =>
			tx.deal.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("activities", () =>
			tx.activity.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("emailThreads", () =>
			tx.emailThread.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("calendarEvents", () =>
			tx.calendarEvent.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("agentWrites", () =>
			tx.agentWrite.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("conversations", () =>
			tx.agentConversation.updateMany({
				where: { companyId: mergeId },
				data: { companyId: keepId },
			}),
		);
		await move("architectOn", () =>
			tx.project.updateMany({
				where: { architectId: mergeId },
				data: { architectId: keepId },
			}),
		);
		await move("gcOn", () =>
			tx.project.updateMany({
				where: { gcId: mergeId },
				data: { gcId: keepId },
			}),
		);
		await move("developerOn", () =>
			tx.project.updateMany({
				where: { developerId: mergeId },
				data: { developerId: keepId },
			}),
		);

		const loseRoles = await tx.projectParticipant.findMany({
			where: { companyId: mergeId },
		});
		let rolesMoved = 0;
		for (const role of loseRoles) {
			const clash = await tx.projectParticipant.findFirst({
				where: {
					projectId: role.projectId,
					companyId: keepId,
					role: role.role,
				},
				select: { id: true },
			});
			if (clash) await tx.projectParticipant.delete({ where: { id: role.id } });
			else {
				await tx.projectParticipant.update({
					where: { id: role.id },
					data: { companyId: keepId },
				});
				rolesMoved += 1;
			}
		}
		moved.projectRoles = rolesMoved;

		const keepFields = new Set(
			(
				await tx.fieldValue.findMany({
					where: { companyId: keepId },
					select: { fieldId: true },
				})
			).map((f) => f.fieldId),
		);
		const loseFields = await tx.fieldValue.findMany({
			where: { companyId: mergeId },
		});
		let fieldsMoved = 0;
		for (const value of loseFields) {
			if (keepFields.has(value.fieldId))
				await tx.fieldValue.delete({ where: { id: value.id } });
			else {
				await tx.fieldValue.update({
					where: { id: value.id },
					data: { companyId: keepId },
				});
				fieldsMoved += 1;
			}
		}
		moved.fields = fieldsMoved;

		await tx.company.update({
			where: { id: keepId },
			data: {
				website: keep.website ?? lose.website,
				phone: keep.phone ?? lose.phone,
				city: keep.city ?? lose.city,
				stateCode: keep.stateCode ?? lose.stateCode,
				industry: keep.industry ?? lose.industry,
				description: keep.description ?? lose.description,
				linkedinUrl: keep.linkedinUrl ?? lose.linkedinUrl,
				lastActivityAt: maxDate(keep.lastActivityAt, lose.lastActivityAt),
			},
		});

		const loserDomain = lose.domain;
		await tx.company.update({
			where: { id: mergeId },
			data: {
				archivedAt: new Date(),
				domain: loserDomain
					? `${loserDomain}#merged-${mergeId.slice(-6)}`
					: null,
			},
		});
		if (loserDomain && !keep.domain) {
			await tx.company.update({
				where: { id: keepId },
				data: { domain: loserDomain },
			});
		}

		await tx.activity.create({
			data: {
				type: "NOTE",
				subject: `Merged: ${lose.name} folded into this company`,
				body: `Duplicate company ${mergeId}${loserDomain ? ` (${loserDomain})` : ""} was merged here. Its people, deals, projects, notes and history now live on this record.`,
				occurredAt: new Date(),
				companyId: keepId,
				createdById: userId,
				meta: { merge: { kind: "company", mergedId: mergeId } },
			},
		});

		return moved;
	}

	private async mergeProjects(
		tx: Prisma.TransactionClient,
		keepId: string,
		mergeId: string,
		userId: string,
	) {
		const [keep, lose] = await Promise.all([
			tx.project.findUnique({ where: { id: keepId } }),
			tx.project.findUnique({ where: { id: mergeId } }),
		]);
		if (!keep || !lose)
			throw new NotFoundException("One of the projects does not exist.");

		const moved: Record<string, number> = {};
		const move = async (
			label: string,
			run: () => Promise<{ count: number }>,
		) => {
			moved[label] = (await run()).count;
		};

		await move("deals", () =>
			tx.deal.updateMany({
				where: { projectId: mergeId },
				data: { projectId: keepId },
			}),
		);
		await move("activities", () =>
			tx.activity.updateMany({
				where: { projectId: mergeId },
				data: { projectId: keepId },
			}),
		);
		await move("agentWrites", () =>
			tx.agentWrite.updateMany({
				where: { projectId: mergeId },
				data: { projectId: keepId },
			}),
		);
		await move("conversations", () =>
			tx.agentConversation.updateMany({
				where: { projectId: mergeId },
				data: { projectId: keepId },
			}),
		);

		const loseRoles = await tx.projectParticipant.findMany({
			where: { projectId: mergeId },
		});
		let rolesMoved = 0;
		for (const role of loseRoles) {
			const clash = await tx.projectParticipant.findFirst({
				where: role.contactId
					? { projectId: keepId, contactId: role.contactId }
					: { projectId: keepId, companyId: role.companyId, role: role.role },
				select: { id: true },
			});
			if (clash) await tx.projectParticipant.delete({ where: { id: role.id } });
			else {
				await tx.projectParticipant.update({
					where: { id: role.id },
					data: { projectId: keepId },
				});
				rolesMoved += 1;
			}
		}
		moved.participants = rolesMoved;

		const keepIsNumbered = /^\d+$/.test(keep.externalId ?? "");
		const loseIsNumbered = /^\d+$/.test(lose.externalId ?? "");
		const externalId = keepIsNumbered
			? keep.externalId
			: loseIsNumbered
				? lose.externalId
				: (keep.externalId ?? lose.externalId);

		await tx.project.update({
			where: { id: mergeId },
			data: {
				archivedAt: new Date(),
				externalId: lose.externalId
					? `${lose.externalId}#merged-${mergeId.slice(-6)}`
					: null,
			},
		});

		await tx.project.update({
			where: { id: keepId },
			data: {
				externalId,
				address: keep.address ?? lose.address,
				city: keep.city ?? lose.city,
				stateCode: keep.stateCode ?? lose.stateCode,
				county: keep.county ?? lose.county,
				category: keep.category ?? lose.category,
				value: keep.value ?? lose.value,
				floors: keep.floors ?? lose.floors,
				units: keep.units ?? lose.units,
				floorArea: keep.floorArea ?? lose.floorArea,
				startDate: keep.startDate ?? lose.startDate,
				bidDate: keep.bidDate ?? lose.bidDate,
				architectId: keep.architectId ?? lose.architectId,
				gcId: keep.gcId ?? lose.gcId,
				developerId: keep.developerId ?? lose.developerId,
				ownerId: keep.ownerId ?? lose.ownerId,
				description: keep.description ?? lose.description,
				competitor: keep.competitor ?? lose.competitor,
				competitorPricing: keep.competitorPricing ?? lose.competitorPricing,
				lastUpdateAt: maxDate(keep.lastUpdateAt, lose.lastUpdateAt),
				lastActivityAt: maxDate(keep.lastActivityAt, lose.lastActivityAt),
			},
		});

		await tx.activity.create({
			data: {
				type: "NOTE",
				subject: `Merged: "${lose.name}" folded into this project`,
				body: `Duplicate project ${mergeId}${lose.externalId ? ` (CC ${lose.externalId})` : ""} was merged here. Its quotes, people, log and agent history now live on this record.`,
				occurredAt: new Date(),
				projectId: keepId,
				companyId: keep.architectId ?? lose.architectId,
				createdById: userId,
				meta: { merge: { kind: "project", mergedId: mergeId } },
			},
		});

		return moved;
	}
}

function maxDate(a: Date | null, b: Date | null): Date | null {
	if (!a) return b;
	if (!b) return a;
	return a > b ? a : b;
}
