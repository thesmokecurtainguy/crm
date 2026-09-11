import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { TemplatesRouter } from "./templates.router";
import { TemplatesService } from "./templates.service";

@Module({
	imports: [TrpcModule, MailboxModule, CrmModule],
	providers: [TemplatesService, TemplatesRouter],
	exports: [TemplatesService],
})
export class TemplatesModule {}
