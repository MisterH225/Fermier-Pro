import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { TaxonomyService } from "./taxonomy.service";

@Controller("taxonomy")
@UseGuards(SupabaseJwtGuard)
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get("species")
  species() {
    return this.taxonomy.listSpeciesWithBreeds();
  }
}
