import { IsString, MaxLength } from "class-validator";

export class LinkHealthFinanceDto {
  @IsString()
  @MaxLength(64)
  expenseId!: string;
}
