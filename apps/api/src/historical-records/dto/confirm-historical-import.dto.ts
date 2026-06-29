import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class HistoricalImportRowDto {
  @IsString()
  @MaxLength(32)
  date!: string;

  @IsIn(["income", "expense"])
  type!: "income" | "expense";

  @IsString()
  @MaxLength(200)
  categorie!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  montant!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class ConfirmHistoricalImportDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HistoricalImportRowDto)
  rows!: HistoricalImportRowDto[];
}
