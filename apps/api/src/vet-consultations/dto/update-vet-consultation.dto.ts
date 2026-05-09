import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf
} from "class-validator";
import { VetConsultationStatus } from "@prisma/client";

export class UpdateVetConsultationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  summary?: string;

  @IsOptional()
  @IsEnum(VetConsultationStatus)
  status?: VetConsultationStatus;

  @IsOptional()
  @ValidateIf((o: UpdateVetConsultationDto) => o.primaryVetUserId != null)
  @IsString()
  primaryVetUserId?: string | null;
}
