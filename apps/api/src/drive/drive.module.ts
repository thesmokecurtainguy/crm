import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { DriveRouter } from "./drive.router";
import { DriveService } from "./drive.service";

@Module({
	imports: [TrpcModule, MailboxModule],
	providers: [DriveService, DriveRouter],
	exports: [DriveService],
})
export class DriveModule {}
