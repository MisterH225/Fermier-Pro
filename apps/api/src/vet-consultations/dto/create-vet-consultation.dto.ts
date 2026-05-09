import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateVetConsultationDto {
  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  summary?: string;

  @IsOptional()
  @IsString()
  animalId?: string;
}
