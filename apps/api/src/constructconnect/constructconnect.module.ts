import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { ProjectsModule } from "../projects/projects.module";
import { ConstructConnectController } from "./constructconnect.controller";
import { DigestSyncService } from "./digest-sync.service";

@Module({
	imports: [MailboxModule, ProjectsModule],
	controllers: [ConstructConnectController],
	providers: [DigestSyncService],
	exports: [DigestSyncService],
})
export class ConstructConnectModule {}
