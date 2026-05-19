import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MemberActivityLogsController } from "./member-activity-logs.controller";
import { MemberActivityLogsService } from "./member-activity-logs.service";

@Module({
  imports: [AuthModule],
  controllers: [MemberActivityLogsController],
  providers: [MemberActivityLogsService],
  exports: [MemberActivityLogsService]
})
export class MemberActivityLogsModule {}
