import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { TasksController } from "./tasks.controller";
import { TasksCronService } from "./tasks-cron.service";
import { TasksGateway } from "./tasks.gateway";
import { TasksService } from "./tasks.service";

@Module({
  imports: [AuthModule, CommonModule, ConfigClientModule],
  controllers: [TasksController],
  providers: [TasksService, TasksCronService, TasksGateway],
  exports: [TasksService, TasksGateway]
})
export class TasksModule {}
