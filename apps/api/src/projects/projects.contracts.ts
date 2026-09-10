import {
	CompetitorConfidence,
	LeadStatus,
	LostReason,
	ProjectStage,
	RecordSource,
} from "@crm/db";
import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import { listInput } from "../trpc/list-input";

export const projectStage = z.enum(ProjectStage);
export const leadStatus = z.enum(LeadStatus);
export const competitorConfidence = z.enum(CompetitorConfidence);
export const lostReason = z.enum(LostReason);

export const projectListInput = listInput.extend({
	status: z.string().default("all"),
	stage: z.array(z.string()).default([]),
	leadStatus: z.array(z.string()).default([]),
	stateCode: z.array(z.string()).default([]),
	architect: z.array(z.string()).default([]),
	owner: z.array(z.string()).default([]),
	fields: z.record(z.string(), z.array(z.string())).default({}),
	archived: z.boolean().default(false),
});

export type ProjectListInput = z.infer<typeof projectListInput>;

const dateInput = z.string().nullable().optional();

const projectFields = {
	name: z.string().trim().min(1, "A project needs a name."),
	externalId: z.string().trim().nullable().optional(),
	address: z.string().trim().nullable().optional(),
	city: z.string().trim().nullable().optional(),
	stateCode: z.string().trim().max(2).nullable().optional(),
	county: z.string().trim().nullable().optional(),
	category: z.string().trim().nullable().optional(),
	stage: projectStage.optional(),
	leadStatus: leadStatus.optional(),
	watchUntil: dateInput,
	value: z.number().nonnegative().nullable().optional(),
	floors: z.number().int().nonnegative().nullable().optional(),
	units: z.number().int().nonnegative().nullable().optional(),
	floorArea: z.number().int().nonnegative().nullable().optional(),
	startDate: dateInput,
	bidDate: dateInput,
	architectId: z.string().nullable().optional(),
	gcId: z.string().nullable().optional(),
	developerId: z.string().nullable().optional(),
	ownerId: z.string().nullable().optional(),
	description: z.string().trim().nullable().optional(),
	lastUpdateReason: z.string().trim().nullable().optional(),
	lastUpdateAt: dateInput,
	competitor: z.string().trim().nullable().optional(),
	competitorPricing: z.string().trim().nullable().optional(),
	competitorConfidence: competitorConfidence.nullable().optional(),
	lostReason: lostReason.nullable().optional(),
};

export const projectCreateInput = z.object(projectFields);

export type ProjectCreateInput = z.infer<typeof projectCreateInput>;

const projectUpdateInput = z.object({
	...projectFields,
	name: projectFields.name.optional(),
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateInput>;

export const projectUpdateArgs = z.object({
	id: z.string(),
	data: projectUpdateInput,
});

export const projectUpsertInput = projectCreateInput.extend({
	externalId: z.string().trim().min(1, "An upsert needs an external id."),
	source: z.enum(RecordSource).default("IMPORT"),
});

export type ProjectUpsertInput = z.infer<typeof projectUpsertInput>;

export const projectIdInput = z.object({ id: z.string() });

export const projectTriageInput = z.object({
	id: z.string(),
	leadStatus,
	stage: projectStage.optional(),
	watchUntil: dateInput,
});

export const projectBulkInput = bulkIdsInput;

const companyRef = z
	.object({
		id: z.string(),
		name: z.string(),
		domain: z.string().nullable(),
		iconUrl: z.string().nullable(),
	})
	.nullable();

const ownerRef = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	})
	.nullable();

export const projectRowOutput = z.object({
	id: z.string(),
	name: z.string(),
	externalId: z.string().nullable(),
	source: z.enum(RecordSource),
	city: z.string().nullable(),
	stateCode: z.string().nullable(),
	category: z.string().nullable(),
	stage: projectStage,
	leadStatus: leadStatus,
	watchUntil: z.string().nullable(),
	value: z.number().nullable(),
	floors: z.number().nullable(),
	units: z.number().nullable(),
	bidDate: z.string().nullable(),
	startDate: z.string().nullable(),
	architect: companyRef,
	gc: companyRef,
	owner: ownerRef,
	lastUpdateReason: z.string().nullable(),
	lastUpdateAt: z.string().nullable(),
	lastActivityAt: z.string().nullable(),
	archivedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type ProjectRow = z.infer<typeof projectRowOutput>;

export const projectListOutput = z.object({
	rows: z.array(projectRowOutput),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
});

export const projectDetailOutput = projectRowOutput.extend({
	address: z.string().nullable(),
	county: z.string().nullable(),
	floorArea: z.number().nullable(),
	developer: companyRef,
	description: z.string().nullable(),
	competitor: z.string().nullable(),
	competitorPricing: z.string().nullable(),
	competitorConfidence: competitorConfidence.nullable(),
	lostReason: lostReason.nullable(),
	closedAt: z.string().nullable(),
	deals: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			stage: z.string(),
			amount: z.number().nullable(),
			company: z.object({ id: z.string(), name: z.string() }),
		}),
	),
});

export const projectSummaryOutput = z.object({
	id: z.string(),
	name: z.string(),
	externalId: z.string().nullable(),
	created: z.boolean(),
});

export const projectArchiveResultOutput = z.object({
	id: z.string(),
	name: z.string(),
});

export const projectBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	skipped: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const projectOptionsInput = z.object({ q: z.string().default("") });

export const projectOptionOutput = z.array(
	z.object({ id: z.string(), name: z.string(), stage: projectStage }),
);

export const projectPeopleOutput = z.array(
	z.object({
		role: z.enum(["architect", "gc", "developer"]),
		company: z.object({
			id: z.string(),
			name: z.string(),
			phone: z.string().nullable(),
			website: z.string().nullable(),
			city: z.string().nullable(),
			stateCode: z.string().nullable(),
		}),
		contacts: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				title: z.string().nullable(),
				email: z.string().nullable(),
				phone: z.string().nullable(),
				linkedinUrl: z.string().nullable(),
				lastActivityAt: z.string().nullable(),
			}),
		),
	}),
);
