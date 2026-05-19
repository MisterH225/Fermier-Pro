import { TaskPriority, TaskReminder, TaskStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { TASK_CATEGORIES } from "../task-categories.constants";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @IsIn([...TASK_CATEGORIES])
  category?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  assignedUserId?: string | null;

  @IsOptional()
  @IsString()
  animalId?: string | null;

  @IsOptional()
  @IsEnum(TaskReminder)
  reminder?: TaskReminder | null;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;
}
