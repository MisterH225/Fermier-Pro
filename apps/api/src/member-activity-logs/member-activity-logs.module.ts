import { Module } from "@nestjs/common";
import { MemberActivityLogsController } from "./member-activity-logs.controller";
import { MemberActivityLogsService } from "./member-activity-logs.service";

@Module({
  controllers: [MemberActivityLogsController],
  providers: [MemberActivityLogsService],
  exports: [MemberActivityLogsService]
})
export class MemberActivityLogsModule {}
