import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { MemberActivityLogsModule } from "../member-activity-logs/member-activity-logs.module";
import { TasksController } from "./tasks.controller";
import { TasksCronService } from "./tasks-cron.service";
import { TasksGateway } from "./tasks.gateway";
import { TasksService } from "./tasks.service";

@Module({
  imports: [AuthModule, CommonModule, ConfigClientModule, MemberActivityLogsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksCronService, TasksGateway],
  exports: [TasksService, TasksGateway]
})
export class TasksModule {}
