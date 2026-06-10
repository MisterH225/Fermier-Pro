import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class ConfirmDetectedBatchDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(["starter", "fattening"])
  category!: "starter" | "fattening";

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  animalIds!: string[];

  @IsOptional()
  @IsDateString()
  avgBirthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;
}
