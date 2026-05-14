import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MemberActivityLogsModule } from "../member-activity-logs/member-activity-logs.module";
import { FarmMembersController } from "./farm-members.controller";
import { FarmMembersService } from "./farm-members.service";

@Module({
  imports: [AuthModule, MemberActivityLogsModule],
  controllers: [FarmMembersController],
  providers: [FarmMembersService]
})
export class FarmMembersModule {}
