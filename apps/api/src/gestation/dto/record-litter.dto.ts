import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from "class-validator";
import { GestationDeliveryType } from "@prisma/client";

export class RecordLitterDto {
  @IsDateString()
  actualBirthDate!: string;

  @IsInt()
  @Min(0)
  bornAlive!: number;

  @IsInt()
  @Min(0)
  stillborn!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mummified?: number;

  @IsOptional()
  @IsNumber()
  averageBirthWeightKg?: number;

  @IsEnum(GestationDeliveryType)
  deliveryType!: GestationDeliveryType;

  @IsOptional()
  @IsBoolean()
  vetAssistance?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  penId?: string;
}
