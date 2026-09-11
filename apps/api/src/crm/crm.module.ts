import { Global, Module } from "@nestjs/common";
import { ActivityStampService } from "./activity-stamp.service";
import { EnrichmentLogService } from "./enrichment-log.service";
import { MergeService } from "./merge.service";

@Global()
@Module({
	providers: [ActivityStampService, EnrichmentLogService, MergeService],
	exports: [ActivityStampService, EnrichmentLogService, MergeService],
})
export class CrmModule {}
