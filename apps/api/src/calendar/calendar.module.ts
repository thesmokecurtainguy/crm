import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { TrpcModule } from "../trpc/trpc.module";
import { CalendarRouter } from "./calendar.router";
import { CalendarService } from "./calendar.service";

@Module({
	imports: [TrpcModule, MailboxModule],
	providers: [CalendarService, CalendarRouter],
	exports: [CalendarService],
})
export class CalendarModule {}
