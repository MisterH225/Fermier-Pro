import { IsString } from "class-validator";

export class WsJoinFarmDto {
  @IsString()
  farmId!: string;
}
