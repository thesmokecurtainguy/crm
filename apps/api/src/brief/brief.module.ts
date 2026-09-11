import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { BriefController } from "./brief.controller";
import { BriefRouter } from "./brief.router";
import { BriefService } from "./brief.service";

@Module({
	imports: [TrpcModule, MailboxModule],
	controllers: [BriefController],
	providers: [BriefService, BriefRouter],
	exports: [BriefService],
})
export class BriefModule {}
