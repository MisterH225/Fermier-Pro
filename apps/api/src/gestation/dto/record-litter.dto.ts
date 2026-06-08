import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  /** Loge de destination pour la portée (bande starter). */
  @IsOptional()
  @IsUUID()
  penId?: string;

  /** Transférer la truie dans la même loge que la portée. */
  @IsOptional()
  @IsBoolean()
  transferSowWithLitter?: boolean;
}
