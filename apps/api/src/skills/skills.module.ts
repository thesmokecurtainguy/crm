import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { SkillsRouter } from "./skills.router";
import { SkillsService } from "./skills.service";

@Module({
	imports: [TrpcModule],
	providers: [SkillsService, SkillsRouter],
	exports: [SkillsService],
})
export class SkillsModule {}
