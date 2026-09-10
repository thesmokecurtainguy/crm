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
	createEventInput,
	draftEmailInput,
	moveEventInput,
	proposeTodoInput,
	writeIdInput,
	writeListInput,
	writeListOutput,
	writeResultOutput,
} from "./writes.contracts";
import { WritesService } from "./writes.service";

@Router({ alias: "writes" })
@UseMiddlewares(AuthMiddleware)
export class WritesRouter {
	constructor(@Inject(WritesService) private readonly writes: WritesService) {}

	@Query({
		input: writeListInput,
		output: writeListOutput,
		meta: restMeta("POST", "/writes/search", ["Writes"]),
	})
	async list(
		@Input() input: z.infer<typeof writeListInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.writes.list(ctx.user.id, input);
	}

	@Mutation({
		input: draftEmailInput,
		output: writeResultOutput,
		meta: restMeta("POST", "/writes/draft-email", ["Writes"]),
	})
	async draftEmail(
		@Input() input: z.infer<typeof draftEmailInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.writes.draftEmail(ctx.user.id, input);
	}

	@Mutation({
		input: createEventInput,
		output: writeResultOutput,
		meta: restMeta("POST", "/writes/create-event", ["Writes"]),
	})
	async createEvent(
		@Input() input: z.infer<typeof createEventInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.writes.createEvent(ctx.user.id, input);
	}

	@Mutation({
		input: moveEventInput,
		output: writeResultOutput,
		meta: restMeta("POST", "/writes/move-event", ["Writes"]),
	})
	async moveEvent(
		@Input() input: z.infer<typeof moveEventInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.writes.moveEvent(ctx.user.id, input);
	}

	@Mutation({
		input: proposeTodoInput,
		output: writeResultOutput,
		meta: restMeta("POST", "/writes/propose-todo", ["Writes"]),
	})
	async proposeTodo(
		@Input() input: z.infer<typeof proposeTodoInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.writes.proposeTodo(ctx.user.id, input);
	}

	@Mutation({
		input: writeIdInput,
		output: writeIdInput,
		meta: restMeta("POST", "/writes/{id}/complete", ["Writes"]),
	})
	async markCompleted(@Input("id") id: string, @Ctx() ctx: AuthedTrpcContext) {
		return this.writes.markCompleted(ctx.user.id, id);
	}
}
