import type { Db } from "@crm/db";
import {
	Controller,
	ForbiddenException,
	Get,
	Headers,
	Logger,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import { BriefService } from "./brief.service";

@ApiTags("Internal — Cron")
@Controller("internal/brief")
export class BriefController {
	private readonly logger = new Logger(BriefController.name);
	private readonly secret: string | undefined;

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly brief: BriefService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Get()
	@AllowAnonymous()
	@ApiOperation({
		summary: "Compose and send the daily brief to every connected user",
	})
	async viaGet(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	@Post()
	@AllowAnonymous()
	@ApiExcludeEndpoint()
	async viaPost(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	private async run(authorization?: string) {
		if (!this.secret)
			throw new ServiceUnavailableException("Brief is not configured.");
		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}
		const users = await this.db.mailboxSync.findMany({
			where: { source: "gmail" },
			select: { userId: true },
		});
		const service = await this.brief.withSlug();
		const results = [];
		for (const { userId } of users) {
			try {
				const brief = await service.compose(userId);
				const outcome = await service.send(userId, brief);
				results.push({ userId, ...outcome, items: brief.needsYou.length });
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				this.logger.warn({ message: "Brief failed", userId, reason });
				results.push({ userId, sent: false, reason });
			}
		}
		return results;
	}
}

function timingSafeEquals(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return mismatch === 0;
}
