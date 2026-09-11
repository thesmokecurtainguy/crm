import {
	type Db,
	type LeadStatus,
	LeadStatus as LeadStatusEnum,
	type Prisma,
	Prisma as PrismaNamespace,
	type ProjectStage,
	ProjectStage as ProjectStageEnum,
} from "@crm/db";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { type BulkResult, requireOwner, runBulk } from "../crm/bulk";
import { InjectDatabase } from "../database/database.constants";
import {
	archivedFilter,
	countsByKey,
	type ListResult,
	type OrderByColumns,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ProjectCreateInput,
	ProjectListInput,
	ProjectRow,
	ProjectUpdateInput,
	ProjectUpsertInput,
} from "./projects.contracts";

const COMPANY_REF = {
	id: true,
	name: true,
	domain: true,
	iconUrl: true,
} as const;

const OWNER_REF = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const ROW_SELECT = {
	id: true,
	name: true,
	externalId: true,
	source: true,
	city: true,
	stateCode: true,
	category: true,
	stage: true,
	leadStatus: true,
	watchUntil: true,
	value: true,
	floors: true,
	units: true,
	bidDate: true,
	startDate: true,
	architect: { select: COMPANY_REF },
	gc: { select: COMPANY_REF },
	owner: { select: OWNER_REF },
	lastUpdateReason: true,
	lastUpdateAt: true,
	lastActivityAt: true,
	archivedAt: true,
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.ProjectSelect;

const DETAIL_SELECT = {
	...ROW_SELECT,
	address: true,
	county: true,
	floorArea: true,
	developer: { select: COMPANY_REF },
	description: true,
	competitor: true,
	competitorPricing: true,
	competitorConfidence: true,
	lostReason: true,
	closedAt: true,
	deals: {
		where: { archivedAt: null },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			name: true,
			stage: true,
			channel: true,
			amount: true,
			expectedCloseDate: true,
			lastActivityAt: true,
			company: { select: { id: true, name: true } },
		},
	},
} satisfies Prisma.ProjectSelect;

const LINK_SELECT = {
	id: true,
	name: true,
	stage: true,
	leadStatus: true,
	city: true,
	stateCode: true,
	value: true,
	floors: true,
	bidDate: true,
	lastUpdateAt: true,
	architectId: true,
	gcId: true,
	developerId: true,
} satisfies Prisma.ProjectSelect;

const PARTICIPANT_SELECT = {
	role: true,
	company: { select: { id: true } },
	contact: {
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
		},
	},
} satisfies Prisma.ProjectParticipantSelect;

type RowRecord = Prisma.ProjectGetPayload<{ select: typeof ROW_SELECT }>;
type DetailRecord = Prisma.ProjectGetPayload<{ select: typeof DETAIL_SELECT }>;

const SORTABLE: OrderByColumns<Prisma.ProjectOrderByWithRelationInput[]> = {
	name: (dir) => [{ name: dir }],
	stage: (dir) => [{ stage: dir }, { bidDate: "asc" }],
	value: (dir) => [{ value: { sort: dir, nulls: "last" } }],
	floors: (dir) => [{ floors: { sort: dir, nulls: "last" } }],
	bidDate: (dir) => [{ bidDate: { sort: dir, nulls: "last" } }],
	startDate: (dir) => [{ startDate: { sort: dir, nulls: "last" } }],
	stateCode: (dir) => [{ stateCode: dir }, { city: dir }],
	lastUpdateAt: (dir) => [{ lastUpdateAt: { sort: dir, nulls: "last" } }],
	updatedAt: (dir) => [{ updatedAt: dir }],
};

const DEFAULT_ORDER: Prisma.ProjectOrderByWithRelationInput[] = [
	{ lastUpdateAt: { sort: "desc", nulls: "last" } },
	{ updatedAt: "desc" },
];

const CLOSED_STAGES: ProjectStage[] = ["WON", "LOST"];

@Injectable()
export class ProjectsService {
	private readonly logger = new Logger(ProjectsService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: ProjectListInput): Promise<ListResult<ProjectRow>> {
		const where = this.buildWhere(input);
		const orderBy = resolveOrderBy(input, SORTABLE, DEFAULT_ORDER);
		const { skip, take } = paginate(input);

		const facetWhere: Prisma.ProjectWhereInput = archivedFilter(input.archived);

		const [rows, total, stageGroups, leadGroups, stateGroups] =
			await Promise.all([
				this.db.project.findMany({
					where,
					orderBy,
					skip,
					take,
					select: ROW_SELECT,
				}),
				this.db.project.count({ where }),
				this.db.project.groupBy({
					by: ["stage"],
					where: facetWhere,
					_count: { _all: true },
				}),
				this.db.project.groupBy({
					by: ["leadStatus"],
					where: facetWhere,
					_count: { _all: true },
				}),
				this.db.project.groupBy({
					by: ["stateCode"],
					where: facetWhere,
					_count: { _all: true },
				}),
			]);

		return {
			rows: rows.map((row) => this.toRow(row)),
			total,
			facetCounts: {
				stage: countsByKey(stageGroups, "stage"),
				leadStatus: countsByKey(leadGroups, "leadStatus"),
				stateCode: countsByKey(stateGroups, "stateCode"),
			},
		};
	}

	async options(q: string) {
		return this.db.project.findMany({
			where: { ...this.searchFilter(q), archivedAt: null },
			select: { id: true, name: true, stage: true },
			orderBy: { name: "asc" },
			take: 100,
		});
	}

	async byId(id: string) {
		const project = await this.db.project.findUnique({
			where: { id },
			select: DETAIL_SELECT,
		});
		if (!project) throw new NotFoundException(`No project with id ${id}.`);
		return this.toDetail(project);
	}

	async create(input: ProjectCreateInput) {
		await requireOwner(this.db, input.ownerId ?? null);
		await this.requireCompanies(input);

		const externalId = clean(input.externalId);
		if (externalId) {
			const existing = await this.db.project.findUnique({
				where: { externalId },
				select: { id: true, name: true },
			});
			if (existing) {
				throw new ConflictException(
					`${existing.name} already carries external id ${externalId}.`,
				);
			}
		}

		const project = await this.db.project.create({
			data: this.toData(input, { externalId }),
			select: { id: true, name: true, externalId: true },
		});

		this.logger.log({ message: "Project created", projectId: project.id });
		return { ...project, created: true };
	}

	async upsert(input: ProjectUpsertInput) {
		await this.requireCompanies(input);
		const externalId = input.externalId.trim();

		const existing = await this.db.project.findUnique({
			where: { externalId },
			select: {
				id: true,
				stage: true,
				leadStatus: true,
				lastUpdateReason: true,
			},
		});

		if (!existing) {
			const project = await this.db.project.create({
				data: { ...this.toData(input, { externalId }), source: input.source },
				select: { id: true, name: true, externalId: true },
			});
			return { ...project, created: true };
		}

		const data = this.toData(input, { externalId, partial: true });
		if (CLOSED_STAGES.includes(existing.stage)) delete data.stage;
		if (existing.leadStatus === "QUALIFIED") delete data.leadStatus;

		const project = await this.db.project.update({
			where: { id: existing.id },
			data,
			select: { id: true, name: true, externalId: true },
		});
		return { ...project, created: false };
	}

	async update(id: string, input: ProjectUpdateInput) {
		if (input.ownerId !== undefined) {
			await requireOwner(this.db, input.ownerId);
		}
		await this.requireCompanies(input);

		const externalId =
			input.externalId === undefined ? undefined : clean(input.externalId);
		if (externalId) {
			const clash = await this.db.project.findUnique({
				where: { externalId },
				select: { id: true, name: true },
			});
			if (clash && clash.id !== id) {
				throw new ConflictException(
					`${clash.name} already carries external id ${externalId}.`,
				);
			}
		}

		const data = this.toData(input, { externalId, partial: true });
		if (input.stage && CLOSED_STAGES.includes(input.stage)) {
			data.closedAt = new Date();
		} else if (input.stage) {
			data.closedAt = null;
			data.lostReason = null;
		}

		try {
			const project = await this.db.project.update({
				where: { id },
				data,
				select: DETAIL_SELECT,
			});
			return this.toDetail(project);
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async triage(
		id: string,
		leadStatus: LeadStatus,
		stage: ProjectStage | undefined,
		watchUntil: string | null | undefined,
	) {
		const data: Prisma.ProjectUpdateInput = { leadStatus };
		if (leadStatus === "WATCH") {
			data.watchUntil = parseDate(watchUntil);
		} else {
			data.watchUntil = null;
		}
		if (leadStatus === "QUALIFIED" && stage) data.stage = stage;

		try {
			const project = await this.db.project.update({
				where: { id },
				data,
				select: DETAIL_SELECT,
			});
			return this.toDetail(project);
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async people(id: string) {
		const project = await this.db.project.findUnique({
			where: { id },
			select: { architectId: true, gcId: true, developerId: true },
		});
		if (!project) throw new NotFoundException(`No project with id ${id}.`);

		const roles: {
			role: "architect" | "gc" | "developer";
			companyId: string | null;
		}[] = [
			{ role: "architect", companyId: project.architectId },
			{ role: "gc", companyId: project.gcId },
			{ role: "developer", companyId: project.developerId },
		];

		const out = [];
		for (const { role, companyId } of roles) {
			if (!companyId) continue;
			const company = await this.db.company.findUnique({
				where: { id: companyId },
				select: {
					id: true,
					name: true,
					phone: true,
					website: true,
					city: true,
					stateCode: true,
					contacts: {
						where: { archivedAt: null },
						orderBy: [
							{ lastActivityAt: { sort: "desc", nulls: "last" } },
							{ lastName: "asc" },
						],
						take: 25,
						select: {
							id: true,
							firstName: true,
							lastName: true,
							title: true,
							email: true,
							phone: true,
							linkedinUrl: true,
							lastActivityAt: true,
						},
					},
				},
			});
			if (!company) continue;
			const { contacts, ...rest } = company;
			out.push({
				role,
				company: rest,
				contacts: contacts.map((c) => ({
					id: c.id,
					name: [c.firstName, c.lastName].filter(Boolean).join(" "),
					title: c.title,
					email: c.email,
					phone: c.phone,
					linkedinUrl: c.linkedinUrl,
					lastActivityAt: iso(c.lastActivityAt),
				})),
			});
		}
		return out;
	}

	async forCompany(companyId: string) {
		const projects = await this.db.project.findMany({
			where: {
				archivedAt: null,
				OR: [
					{ architectId: companyId },
					{ gcId: companyId },
					{ developerId: companyId },
					{ projectParticipants: { some: { companyId } } },
					{ projectParticipants: { some: { contact: { companyId } } } },
				],
			},
			orderBy: [
				{ lastUpdateAt: { sort: "desc", nulls: "last" } },
				{ updatedAt: "desc" },
			],
			take: 50,
			select: {
				...LINK_SELECT,
				projectParticipants: {
					where: { OR: [{ companyId }, { contact: { companyId } }] },
					select: PARTICIPANT_SELECT,
				},
			},
		});
		return projects.map((p) => this.toLink(p, companyId));
	}

	async forContact(contactId: string) {
		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { companyId: true },
		});
		const companyId = contact?.companyId ?? null;
		const projects = await this.db.project.findMany({
			where: {
				archivedAt: null,
				OR: [
					{ projectParticipants: { some: { contactId } } },
					...(companyId
						? [
								{ architectId: companyId },
								{ gcId: companyId },
								{ developerId: companyId },
							]
						: []),
				],
			},
			orderBy: [
				{ lastUpdateAt: { sort: "desc", nulls: "last" } },
				{ updatedAt: "desc" },
			],
			take: 50,
			select: {
				...LINK_SELECT,
				projectParticipants: {
					where: companyId
						? { OR: [{ companyId }, { contact: { companyId } }] }
						: { contactId },
					select: PARTICIPANT_SELECT,
				},
			},
		});
		return projects.map((p) => this.toLink(p, companyId));
	}

	private toLink(
		p: Prisma.ProjectGetPayload<{
			select: typeof LINK_SELECT & {
				projectParticipants: { select: typeof PARTICIPANT_SELECT };
			};
		}>,
		companyId: string | null,
	) {
		const roles: string[] = [];
		if (companyId) {
			if (p.architectId === companyId) roles.push("Architect");
			if (p.gcId === companyId) roles.push("General contractor");
			if (p.developerId === companyId) roles.push("Developer");
		}
		for (const part of p.projectParticipants) {
			if (part.company && !roles.includes(part.role)) roles.push(part.role);
		}
		return {
			id: p.id,
			name: p.name,
			stage: p.stage,
			leadStatus: p.leadStatus,
			city: p.city,
			stateCode: p.stateCode,
			value: p.value === null ? null : p.value.toNumber(),
			floors: p.floors,
			bidDate: iso(p.bidDate),
			lastUpdateAt: iso(p.lastUpdateAt),
			roles,
			people: p.projectParticipants
				.filter((part) => part.contact)
				.map((part) => ({
					id: part.contact?.id ?? "",
					name: [part.contact?.firstName, part.contact?.lastName]
						.filter(Boolean)
						.join(" "),
					role: part.role,
					email: part.contact?.email ?? null,
					phone: part.contact?.phone ?? null,
				})),
		};
	}

	async participants(projectId: string) {
		const rows = await this.db.projectParticipant.findMany({
			where: { projectId },
			orderBy: [{ role: "asc" }, { createdAt: "asc" }],
			select: {
				id: true,
				role: true,
				note: true,
				company: {
					select: {
						id: true,
						name: true,
						phone: true,
						city: true,
						stateCode: true,
					},
				},
				contact: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						title: true,
						email: true,
						phone: true,
						company: { select: { id: true, name: true } },
					},
				},
			},
		});
		return rows.map((row) => ({
			id: row.id,
			role: row.role,
			note: row.note,
			company: row.company,
			contact: row.contact
				? {
						id: row.contact.id,
						name: [row.contact.firstName, row.contact.lastName]
							.filter(Boolean)
							.join(" "),
						title: row.contact.title,
						email: row.contact.email,
						phone: row.contact.phone,
						company: row.contact.company,
					}
				: null,
		}));
	}

	async addParticipant(input: {
		projectId: string;
		companyId?: string;
		contactId?: string;
		role: string;
		note?: string | null;
	}) {
		const project = await this.db.project.findUnique({
			where: { id: input.projectId },
			select: { id: true },
		});
		if (!project)
			throw new NotFoundException(`No project with id ${input.projectId}.`);

		if (input.contactId) {
			const existing = await this.db.projectParticipant.findFirst({
				where: { projectId: input.projectId, contactId: input.contactId },
				select: { id: true },
			});
			if (existing) {
				await this.db.projectParticipant.update({
					where: { id: existing.id },
					data: { role: input.role, note: input.note ?? undefined },
				});
				return { id: existing.id, created: false };
			}
		}
		try {
			const row = await this.db.projectParticipant.create({
				data: {
					projectId: input.projectId,
					companyId: input.companyId ?? null,
					contactId: input.contactId ?? null,
					role: input.role,
					note: input.note ?? null,
				},
				select: { id: true },
			});
			await this.db.project.update({
				where: { id: input.projectId },
				data: { lastActivityAt: new Date() },
			});
			return { id: row.id, created: true };
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					"That company already has that role on this project.",
				);
			}
			throw error;
		}
	}

	async removeParticipant(id: string) {
		await this.db.projectParticipant
			.delete({ where: { id } })
			.catch((error) => {
				if (
					error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
					error.code === "P2025"
				) {
					throw new NotFoundException("No such participant.");
				}
				throw error;
			});
		return { id };
	}

	async archive(id: string): Promise<{ id: string; name: string }> {
		try {
			const project = await this.db.project.update({
				where: { id },
				data: { archivedAt: new Date() },
				select: { name: true },
			});
			this.logger.log({ message: "Project archived", projectId: id });
			return { id, name: project.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async restore(id: string): Promise<{ id: string; name: string }> {
		try {
			const project = await this.db.project.update({
				where: { id },
				data: { archivedAt: null },
				select: { name: true },
			});
			return { id, name: project.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async bulkTriage(
		ids: string[],
		leadStatus: LeadStatus,
		stage: ProjectStage | undefined,
		watchUntil: string | null | undefined,
	): Promise<BulkResult> {
		const data: Prisma.ProjectUpdateManyMutationInput = {
			leadStatus,
			watchUntil: leadStatus === "WATCH" ? parseDate(watchUntil) : null,
		};
		if (leadStatus === "QUALIFIED" && stage) data.stage = stage;
		return runBulk(ids, async (id) => {
			const result = await this.db.project.updateMany({
				where: { id, archivedAt: null },
				data,
			});
			return result.count === 0 ? null : id;
		});
	}

	async bulkArchive(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, async (id) => {
			const result = await this.db.project.updateMany({
				where: { id, archivedAt: null },
				data: { archivedAt: new Date() },
			});
			return result.count === 0 ? null : id;
		});
	}

	private async requireCompanies(input: {
		architectId?: string | null;
		gcId?: string | null;
		developerId?: string | null;
	}) {
		const ids = [input.architectId, input.gcId, input.developerId].filter(
			(id): id is string => typeof id === "string" && id.length > 0,
		);
		if (ids.length === 0) return;
		const found = await this.db.company.count({ where: { id: { in: ids } } });
		if (found !== new Set(ids).size) {
			throw new BadRequestException(
				"One of the linked companies does not exist.",
			);
		}
	}

	private toData(
		input: ProjectCreateInput | ProjectUpdateInput,
		options: { externalId?: string | null; partial?: boolean },
	): Prisma.ProjectUncheckedUpdateInput & Prisma.ProjectUncheckedCreateInput {
		const partial = options.partial ?? false;
		const set = <T>(value: T | undefined): T | undefined =>
			partial && value === undefined ? undefined : value;

		return {
			name: input.name ?? "",
			externalId: options.externalId,
			address: set(cleanOpt(input.address)),
			city: set(cleanOpt(input.city)),
			stateCode: set(upperOpt(input.stateCode)),
			county: set(cleanOpt(input.county)),
			category: set(cleanOpt(input.category)),
			stage: set(input.stage),
			leadStatus: set(input.leadStatus),
			watchUntil: set(dateOpt(input.watchUntil)),
			value: set(decimalOpt(input.value)),
			floors: set(input.floors),
			units: set(input.units),
			floorArea: set(input.floorArea),
			startDate: set(dateOpt(input.startDate)),
			bidDate: set(dateOpt(input.bidDate)),
			architectId: set(input.architectId),
			gcId: set(input.gcId),
			developerId: set(input.developerId),
			ownerId: set(input.ownerId),
			description: set(cleanOpt(input.description)),
			lastUpdateReason: set(cleanOpt(input.lastUpdateReason)),
			lastUpdateAt: set(dateOpt(input.lastUpdateAt)),
			competitor: set(cleanOpt(input.competitor)),
			competitorPricing: set(cleanOpt(input.competitorPricing)),
			competitorConfidence: set(input.competitorConfidence),
			lostReason: set(input.lostReason),
		};
	}

	private toRow(row: RowRecord): ProjectRow {
		return {
			...row,
			value: row.value === null ? null : row.value.toNumber(),
			watchUntil: iso(row.watchUntil),
			bidDate: iso(row.bidDate),
			startDate: iso(row.startDate),
			lastUpdateAt: iso(row.lastUpdateAt),
			lastActivityAt: iso(row.lastActivityAt),
			archivedAt: iso(row.archivedAt),
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private toDetail(project: DetailRecord) {
		const { deals, closedAt, ...rest } = project;
		return {
			...this.toRow(rest),
			address: rest.address,
			county: rest.county,
			floorArea: rest.floorArea,
			developer: rest.developer,
			description: rest.description,
			competitor: rest.competitor,
			competitorPricing: rest.competitorPricing,
			competitorConfidence: rest.competitorConfidence,
			lostReason: rest.lostReason,
			closedAt: iso(closedAt),
			deals: deals.map((deal) => ({
				id: deal.id,
				name: deal.name,
				stage: deal.stage,
				channel: deal.channel,
				amount: deal.amount === null ? null : deal.amount.toNumber(),
				expectedCloseDate: iso(deal.expectedCloseDate),
				lastActivityAt: iso(deal.lastActivityAt),
				company: deal.company,
			})),
		};
	}

	private searchFilter(q: string): Prisma.ProjectWhereInput {
		const term = q.trim();
		if (!term) return {};
		return {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				{ city: { contains: term, mode: "insensitive" } },
				{ address: { contains: term, mode: "insensitive" } },
				{ externalId: { contains: term, mode: "insensitive" } },
				{
					architect: { is: { name: { contains: term, mode: "insensitive" } } },
				},
				{ gc: { is: { name: { contains: term, mode: "insensitive" } } } },
			],
		};
	}

	private buildWhere(input: ProjectListInput): Prisma.ProjectWhereInput {
		const and: Prisma.ProjectWhereInput[] = [
			this.searchFilter(input.q),
			archivedFilter(input.archived),
		];
		if (input.status === "leads")
			and.push({ leadStatus: { not: "QUALIFIED" } });
		if (input.status === "pipeline") {
			and.push({ leadStatus: "QUALIFIED", stage: { notIn: CLOSED_STAGES } });
		}
		if (input.status === "closed") and.push({ stage: { in: CLOSED_STAGES } });
		const stages = input.stage.filter(isProjectStage);
		if (stages.length > 0) and.push({ stage: { in: stages } });
		const leadStatuses = input.leadStatus.filter(isLeadStatus);
		if (leadStatuses.length > 0) {
			and.push({ leadStatus: { in: leadStatuses } });
		}
		if (input.stateCode.length > 0) {
			and.push({ stateCode: { in: input.stateCode } });
		}
		if (input.architect.length > 0) {
			and.push({ architectId: { in: input.architect } });
		}
		const owner = ownerFilter<Prisma.ProjectWhereInput>(input.owner);
		if (owner) and.push(owner);
		return { AND: and };
	}

	private translate(cause: unknown, id: string): never {
		if (cause instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (cause.code === "P2025") {
				throw new NotFoundException(`No project with id ${id}.`);
			}
			if (cause.code === "P2002") {
				throw new ConflictException(
					"Another project already carries that external id.",
				);
			}
		}
		throw cause;
	}
}

const PROJECT_STAGES = new Set<string>(Object.values(ProjectStageEnum));
const LEAD_STATUSES = new Set<string>(Object.values(LeadStatusEnum));

function isProjectStage(value: string): value is ProjectStage {
	return PROJECT_STAGES.has(value);
}

function isLeadStatus(value: string): value is LeadStatus {
	return LEAD_STATUSES.has(value);
}

function clean(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

function cleanOpt(value: string | null | undefined): string | null | undefined {
	return value === undefined ? undefined : clean(value);
}

function upperOpt(value: string | null | undefined): string | null | undefined {
	const cleaned = cleanOpt(value);
	return cleaned ? cleaned.toUpperCase() : cleaned;
}

function decimalOpt(
	value: number | null | undefined,
): PrismaNamespace.Decimal | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	return new PrismaNamespace.Decimal(value);
}

function dateOpt(value: string | null | undefined): Date | null | undefined {
	return value === undefined ? undefined : parseDate(value);
}

function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}

function iso(value: Date | null): string | null {
	return value === null ? null : value.toISOString();
}
