import { IsString, MaxLength, MinLength } from "class-validator";

/** Motif obligatoire — notifié au vétérinaire (inbox + push). */
export class ProducerRefuseAppointmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  refusalReason!: string;
}
