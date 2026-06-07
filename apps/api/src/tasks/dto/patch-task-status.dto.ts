import { TaskStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class PatchTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}
