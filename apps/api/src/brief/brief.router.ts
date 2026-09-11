import { Inject } from "@nestjs/common";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { briefOutput, briefSendOutput } from "./brief.contracts";
import { BriefService } from "./brief.service";

@Router({ alias: "brief" })
@UseMiddlewares(AuthMiddleware)
export class BriefRouter {
	constructor(@Inject(BriefService) private readonly brief: BriefService) {}

	@Query({
		output: briefOutput,
		meta: restMeta("GET", "/brief/today", ["Brief"]),
	})
	async today(@Ctx() ctx: AuthedTrpcContext) {
		return (await this.brief.withSlug()).compose(ctx.user.id);
	}

	@Mutation({
		output: briefSendOutput,
		meta: restMeta("POST", "/brief/send", ["Brief"]),
	})
	async sendNow(@Ctx() ctx: AuthedTrpcContext) {
		const service = await this.brief.withSlug();
		const brief = await service.compose(ctx.user.id);
		return service.send(ctx.user.id, brief);
	}
}
