import { IsNotEmpty, IsString } from "class-validator";

export class SetActiveFarmDto {
  @IsString()
  @IsNotEmpty()
  farmId!: string;
}
