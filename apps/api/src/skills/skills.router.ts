import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	skillListOutput,
	skillOutput,
	skillSlugInput,
	skillUpdateInput,
} from "./skills.contracts";
import { SkillsService } from "./skills.service";

@Router({ alias: "skills" })
@UseMiddlewares(AuthMiddleware)
export class SkillsRouter {
	constructor(@Inject(SkillsService) private readonly skills: SkillsService) {}

	@Query({
		output: skillListOutput,
		meta: restMeta("GET", "/skills", ["Skills"]),
	})
	async list() {
		return this.skills.list();
	}

	@Mutation({
		input: skillUpdateInput,
		output: skillOutput,
		meta: restMeta("PUT", "/skills/{slug}", ["Skills"]),
	})
	async update(@Input() input: z.infer<typeof skillUpdateInput>) {
		return this.skills.update(input.slug, input.body);
	}

	@Mutation({
		input: skillSlugInput,
		output: skillOutput,
		meta: restMeta("POST", "/skills/{slug}/reset", ["Skills"]),
	})
	async reset(@Input("slug") slug: string) {
		return this.skills.reset(slug);
	}
}
