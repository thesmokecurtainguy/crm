import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { WritesRouter } from "./writes.router";
import { WritesService } from "./writes.service";

@Module({
	imports: [TrpcModule, MailboxModule, CrmModule],
	providers: [WritesService, WritesRouter],
	exports: [WritesService],
})
export class WritesModule {}
