import { Injectable } from "@nestjs/common";
import type { AiModuleKey } from "./ai.types";

const TEMPLATES: Record<AiModuleKey, string> = {
  finance: `Tu es un conseiller financier agricole expert en élevage porcin en Afrique de l'Ouest.
Voici les données financières agrégées de la ferme (aucune donnée personnelle) :
{data}
Génère 2 à 3 recommandations courtes et actionnables en français : analyse des dépenses, optimisation, alertes sur tendances, suggestions d'investissement si trésorerie positive.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, au format :
[{"type":"finance","priority":"critical|warning|info","title":"max 8 mots","message":"max 2 phrases","action_label":"optionnel","action_route":"optionnel"}]`,

  cheptel: `Tu es un zootechnicien expert en élevage porcin intensif en Afrique de l'Ouest.
Voici les données agrégées du cheptel :
{data}
Génère 2 à 3 recommandations en français sur : répartition dans les loges, relocations, performance de croissance vs objectifs, passages de phase.
Réponds UNIQUEMENT avec un tableau JSON valide :
[{"type":"cheptel","priority":"critical|warning|info","title":"max 8 mots","message":"max 2 phrases","action_label":"optionnel","action_route":"optionnel"}]`,

  sante: `Tu es un vétérinaire expert en santé porcine en Afrique de l'Ouest.
Voici les données sanitaires agrégées :
{data}
Génère 2 à 3 recommandations en français sur : prévention, urgences, calendrier vaccinal, visite vétérinaire.
Réponds UNIQUEMENT avec un tableau JSON valide :
[{"type":"sante","priority":"critical|warning|info","title":"max 8 mots","message":"max 2 phrases","action_label":"optionnel","action_route":"optionnel"}]`,

  stock: `Tu es un nutritionniste en élevage porcin.
Voici les données de stock alimentaire agrégées :
{data}
Génère 2 à 3 recommandations en français sur : achats, ruptures imminentes, ration vs phase, économies.
Réponds UNIQUEMENT avec un tableau JSON valide :
[{"type":"stock","priority":"critical|warning|info","title":"max 8 mots","message":"max 2 phrases","action_label":"optionnel","action_route":"optionnel"}]`,

  gestation: `Tu es un expert en reproduction porcine.
Voici les données de gestation et reproduction agrégées :
{data}
Génère 2 à 3 recommandations en français sur : saillies, intervalles entre mises bas, bandes de production, mises bas imminentes.
Réponds UNIQUEMENT avec un tableau JSON valide :
[{"type":"gestation","priority":"critical|warning|info","title":"max 8 mots","message":"max 2 phrases","action_label":"optionnel","action_route":"optionnel"}]`,

  global_dashboard: `Tu es un conseiller agricole expert en élevage porcin en Afrique de l'Ouest.
Voici un résumé cross-module agrégé de la ferme :
{data}
Génère exactement 1 insight global prioritaire en français — l'information la plus importante aujourd'hui.
Réponds UNIQUEMENT avec un tableau JSON valide d'un seul élément :
[{"type":"global_dashboard","priority":"critical|warning|info","title":"max 8 mots","message":"max 2 phrases","action_label":"optionnel","action_route":"optionnel"}]`
};

@Injectable()
export class AiPromptBuilderService {
  build(module: AiModuleKey, aggregated: unknown): string {
    const template = TEMPLATES[module];
    const data = JSON.stringify(aggregated, null, 0);
    return template.replace("{data}", data);
  }
}
