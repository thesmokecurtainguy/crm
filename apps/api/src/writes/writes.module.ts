import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { WritesRouter } from "./writes.router";
import { WritesService } from "./writes.service";

@Module({
	imports: [TrpcModule, MailboxModule],
	providers: [WritesService, WritesRouter],
	exports: [WritesService],
})
export class WritesModule {}
