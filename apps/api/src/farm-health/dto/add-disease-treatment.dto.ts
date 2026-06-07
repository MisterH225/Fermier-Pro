import { IsOptional, IsString, MaxLength } from "class-validator";

export class AddDiseaseTreatmentDto {
  @IsString()
  @MaxLength(200)
  drugName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
