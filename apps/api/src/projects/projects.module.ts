import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
import { TrpcModule } from "../trpc/trpc.module";
import { ProjectsRouter } from "./projects.router";
import { ProjectsService } from "./projects.service";

@Module({
	imports: [TrpcModule, CrmModule],
	providers: [ProjectsService, ProjectsRouter],
	exports: [ProjectsService],
})
export class ProjectsModule {}
