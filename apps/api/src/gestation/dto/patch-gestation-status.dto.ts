import { IsEnum } from "class-validator";
import { GestationStatus } from "@prisma/client";

export class PatchGestationStatusDto {
  @IsEnum(GestationStatus)
  status!: GestationStatus;
}
