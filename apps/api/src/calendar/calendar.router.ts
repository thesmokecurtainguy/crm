import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { calendarWeekInput, calendarWeekOutput } from "./calendar.contracts";
import { CalendarService } from "./calendar.service";

@Router({ alias: "calendar" })
@UseMiddlewares(AuthMiddleware)
export class CalendarRouter {
	constructor(
		@Inject(CalendarService) private readonly calendar: CalendarService,
	) {}

	@Query({
		input: calendarWeekInput,
		output: calendarWeekOutput,
		meta: restMeta("GET", "/calendar/week", ["Calendar"]),
	})
	async week(@Input("start") start: string, @Ctx() ctx: AuthedTrpcContext) {
		return this.calendar.week(ctx.user.id, start);
	}
}
