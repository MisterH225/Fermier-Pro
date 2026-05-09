import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateConsultationAttachmentDto {
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
