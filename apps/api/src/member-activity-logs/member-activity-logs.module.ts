import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { MemberActivityLogsController } from "./member-activity-logs.controller";
import { MemberActivityLogsService } from "./member-activity-logs.service";

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [MemberActivityLogsController],
  providers: [MemberActivityLogsService],
  exports: [MemberActivityLogsService]
})
export class MemberActivityLogsModule {}
