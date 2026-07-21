import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { VetVisitReason } from "../../vets/dto/schedule-vet-visit.dto";

export class ScheduleFromVetAppointmentDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsEnum(VetVisitReason)
  reason!: VetVisitReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Obligatoire si isFree n'est pas true : montant > 0. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  consultationPrice?: number;

  /** Déclaration explicite de gratuité (requis si pas de montant). */
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;
}
