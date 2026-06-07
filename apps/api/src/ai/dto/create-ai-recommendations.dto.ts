import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AI_MODULE_KEYS, type AiModuleKey } from "../ai.types";

export class CreateAiRecommendationsDto {
  @IsString()
  @IsNotEmpty()
  farmId!: string;

  @IsIn([...AI_MODULE_KEYS])
  module!: AiModuleKey;

  @IsOptional()
  @IsString()
  locale?: string;
}
