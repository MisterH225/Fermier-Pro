import { IsString, MaxLength, MinLength } from "class-validator";

/** Motif obligatoire — visible par l’autre partie après annulation. */
export class CancelVetAppointmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
