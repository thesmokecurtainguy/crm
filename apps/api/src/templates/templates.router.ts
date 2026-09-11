import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	sendEmailInput,
	sendEmailOutput,
	signatureInput,
	signatureOutput,
	templateCreateInput,
	templateIdInput,
	templateListInput,
	templateListOutput,
	templateOutput,
	templateRenderInput,
	templateRenderOutput,
	templateUpdateInput,
	templateValuesInput,
	templateValuesOutput,
} from "./templates.contracts";
import { TemplatesService } from "./templates.service";

@Router({ alias: "templates" })
@UseMiddlewares(AuthMiddleware)
export class TemplatesRouter {
	constructor(
		@Inject(TemplatesService) private readonly templates: TemplatesService,
	) {}

	@Query({
		input: templateListInput,
		output: templateListOutput,
		meta: restMeta("GET", "/templates", ["Templates"]),
	})
	async list(@Input("includeArchived") includeArchived: boolean) {
		return this.templates.list(includeArchived);
	}

	@Mutation({
		input: templateCreateInput,
		output: templateOutput,
		meta: restMeta("POST", "/templates", ["Templates"]),
	})
	async create(
		@Input() input: z.infer<typeof templateCreateInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.templates.create(input, ctx.user.id);
	}

	@Mutation({
		input: templateUpdateInput,
		output: templateOutput,
		meta: restMeta("PATCH", "/templates/{id}", ["Templates"]),
	})
	async update(@Input() input: z.infer<typeof templateUpdateInput>) {
		return this.templates.update(input.id, input.data);
	}

	@Mutation({
		input: templateIdInput,
		output: templateOutput,
		meta: restMeta("POST", "/templates/{id}/archive", ["Templates"]),
	})
	async archive(@Input("id") id: string) {
		return this.templates.archive(id);
	}

	@Query({
		input: templateRenderInput,
		output: templateRenderOutput,
		meta: restMeta("POST", "/templates/{templateId}/render", ["Templates"]),
	})
	async render(@Input() input: z.infer<typeof templateRenderInput>) {
		return this.templates.render(input.templateId, input);
	}

	@Query({
		input: templateValuesInput,
		output: templateValuesOutput,
		meta: restMeta("POST", "/templates/values", ["Templates"]),
	})
	async values(@Input() input: z.infer<typeof templateValuesInput>) {
		return this.templates.values(input);
	}

	@Query({
		output: signatureOutput,
		meta: restMeta("GET", "/email/signature", ["Templates"]),
	})
	async signature() {
		return this.templates.signature();
	}

	@Mutation({
		input: signatureInput,
		output: signatureOutput,
		meta: restMeta("PUT", "/email/signature", ["Templates"]),
	})
	async setSignature(@Input() input: z.infer<typeof signatureInput>) {
		return this.templates.setSignature(input);
	}

	@Mutation({
		input: sendEmailInput,
		output: sendEmailOutput,
		meta: restMeta("POST", "/email/send", ["Templates"]),
	})
	async sendEmail(
		@Input() input: z.infer<typeof sendEmailInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.templates.send(ctx.user.id, input);
	}
}
