import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { AI_MODULE_KEYS, type AiModuleKey } from "../ai.types";

export class CreateAiRecommendationsDto {
  @IsUUID()
  farmId!: string;

  @IsIn([...AI_MODULE_KEYS])
  module!: AiModuleKey;

  @IsOptional()
  @IsString()
  locale?: string;
}
