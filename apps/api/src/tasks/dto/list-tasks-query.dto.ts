import { TaskStatus } from "@prisma/client";
import { IsIn, IsOptional, IsString } from "class-validator";

export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(["todo", "pending", "in_progress", "done", "cancelled", "all"])
  status?: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  @IsIn(["today", "week", "all"])
  period?: string;
}

export function resolveListStatus(
  status?: string
): TaskStatus | undefined {
  if (!status || status === "all") {
    return undefined;
  }
  if (status === "pending") {
    return TaskStatus.todo;
  }
  return status as TaskStatus;
}
