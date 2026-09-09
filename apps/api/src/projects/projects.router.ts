import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	projectArchiveResultOutput,
	projectBulkInput,
	projectBulkResultOutput,
	projectCreateInput,
	projectDetailOutput,
	projectIdInput,
	projectListInput,
	projectListOutput,
	projectOptionOutput,
	projectOptionsInput,
	projectSummaryOutput,
	projectTriageInput,
	projectUpdateArgs,
	projectUpsertInput,
} from "./projects.contracts";
import { ProjectsService } from "./projects.service";

@Router({ alias: "projects" })
@UseMiddlewares(AuthMiddleware)
export class ProjectsRouter {
	constructor(
		@Inject(ProjectsService) private readonly projects: ProjectsService,
	) {}

	@Query({
		input: projectListInput,
		output: projectListOutput,
		meta: restMeta("POST", "/projects/search", ["Projects"]),
	})
	async list(@Input() input: z.infer<typeof projectListInput>) {
		return this.projects.list(input);
	}

	@Query({
		input: projectOptionsInput,
		output: projectOptionOutput,
		meta: restMeta("GET", "/projects/options", ["Projects"]),
	})
	async options(@Input("q") q: string) {
		return this.projects.options(q);
	}

	@Query({
		input: projectIdInput,
		output: projectDetailOutput,
		meta: restMeta("GET", "/projects/{id}", ["Projects"]),
	})
	async byId(@Input("id") id: string) {
		return this.projects.byId(id);
	}

	@Mutation({
		input: projectCreateInput,
		output: projectSummaryOutput,
		meta: restMeta("POST", "/projects", ["Projects"]),
	})
	async create(@Input() input: z.infer<typeof projectCreateInput>) {
		return this.projects.create(input);
	}

	@Mutation({
		input: projectUpsertInput,
		output: projectSummaryOutput,
		meta: restMeta("PUT", "/projects/by-external-id", ["Projects"]),
	})
	async upsert(@Input() input: z.infer<typeof projectUpsertInput>) {
		return this.projects.upsert(input);
	}

	@Mutation({
		input: projectUpdateArgs,
		output: projectDetailOutput,
		meta: restMeta("PATCH", "/projects/{id}", ["Projects"]),
	})
	async update(@Input() input: z.infer<typeof projectUpdateArgs>) {
		return this.projects.update(input.id, input.data);
	}

	@Mutation({
		input: projectTriageInput,
		output: projectDetailOutput,
		meta: restMeta("POST", "/projects/{id}/triage", ["Projects"]),
	})
	async triage(@Input() input: z.infer<typeof projectTriageInput>) {
		return this.projects.triage(
			input.id,
			input.leadStatus,
			input.stage,
			input.watchUntil,
		);
	}

	@Mutation({
		input: projectIdInput,
		output: projectArchiveResultOutput,
		meta: restMeta("POST", "/projects/{id}/archive", ["Projects"]),
	})
	async archive(@Input("id") id: string) {
		return this.projects.archive(id);
	}

	@Mutation({
		input: projectIdInput,
		output: projectArchiveResultOutput,
		meta: restMeta("POST", "/projects/{id}/restore", ["Projects"]),
	})
	async restore(@Input("id") id: string) {
		return this.projects.restore(id);
	}

	@Mutation({
		input: projectBulkInput,
		output: projectBulkResultOutput,
		meta: restMeta("POST", "/projects/bulk/archive", ["Projects"]),
	})
	async bulkArchive(@Input("ids") ids: string[]) {
		return this.projects.bulkArchive(ids);
	}
}
