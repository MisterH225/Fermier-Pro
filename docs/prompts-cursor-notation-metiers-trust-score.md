# Prompts Cursor — Notation par métier & Trust Score (version consolidée)

**Remplace** `prompts-cursor-notation-metiers.md` et `prompt-cursor-meteo-explicite.md`. Ne garde que ce fichier.

Deux prompts : **E1** (avis croisés) → **E2** (Météo explicite + bascule v2). À lancer après D1/D2.

### Diagnostic (code lu)

| Constat | Réalité |
|---|---|
| « Notation acheteur = notation producteur » | Faux dans le code, vrai en prod : les piliers par métier existent, mais `TRUST_SCORE_V2_ACTIVE` vaut `false` par défaut → v1 producteur servi à tous. |
| « Les scores ignorent les notations » | Exact, documenté en commentaire : *« Pas d'avis acheteur en base — omis »*, *« Pas de modèle d'avis boutique — omis »*. |
| Non repéré par toi | Le technicien n'a **aucun avis** : `followUpActivity` 0.6 + `regularity` 0.4. Actif = bien noté, même s'il travaille mal. |

Existant à réutiliser, jamais à réécrire : moyenne bayésienne (prior 3.5, force 5), état « nouvelle », redistribution des poids, snapshots versionnés, mode ombre.

### Décisions appliquées

- Métaphore météo **conservée** comme résumé ; explications chiffrées en dessous.
- Étoiles réservées aux **avis réels** (moyenne + nombre), jamais au score composite.
- **Faits, jamais verdicts** : « 3 paiements en retard sur 10 », jamais « n'est pas fiable ».

### Décisions tranchées

1. **Le score ne bloque rien** — informatif uniquement (pas de contrainte crédit / achat).
2. **Commentaires privés** — champ commentaire conservé ; seul le couple moyenne + nombre d'avis est exposé publiquement.
3. **Seuil d'échantillon à 5** par défaut (paramétrable comme les limites d'abonnement).

---

## PROMPT E1 — Avis croisés manquants et branchement dans les piliers

```json
{
  "task": "Créer les avis croisés manquants (producteur→acheteur, producteur→technicien, acheteur→commerçant) et les brancher comme piliers du trust score v2",

  "context": "Le trust score v2 existe (apps/api/src/trust-score/) avec piliers par métier, moyenne bayésienne, état 'nouvelle', redistribution des poids. Il manque les DONNÉES d'avis pour trois métiers : acheteur, commerçant, technicien. Seuls le vétérinaire (VetRating, VetAppointmentRating) et le producteur (FarmMarketRating) reçoivent des avis. NE PAS réécrire le moteur — ajouter les sources manquantes et les brancher.",

  "preliminary_audit": {
    "files_to_read": [
      "apps/api/src/trust-score/trust-score.constants.ts (poids par profil)",
      "apps/api/src/trust-score/trust-score-metrics.service.ts (calcul des piliers)",
      "apps/api/src/trust-score/trust-score.util.ts (agrégation bayésienne, redistribution)",
      "schema.prisma : VetRating, VetAppointmentRating, FarmMarketRating (PATTERNS À SUIVRE)",
      "Le flux de clôture des commandes marketplace (où proposer la notation)"
    ]
  },

  "spec": {
    "nouveaux_modeles": {
      "regle_commune": "Même pattern que FarmMarketRating : score 1–5, commentaire optionnel (privé), unicité (cible, auteur, transaction), horodatage. Avis possible UNIQUEMENT après une transaction réellement aboutie — jamais hors relation vérifiée.",
      "BuyerRating": "Auteur = vendeur (producteur ou commerçant), cible = acheteur, lié à la commande. Critères : paiement tenu, retrait/réception à l'heure, communication.",
      "MerchantRating": "Auteur = acheteur, cible = boutique/commerçant, lié à la commande. Critères : conformité du produit, délai, communication.",
      "TechnicianRating": "Auteur = producteur, cible = technicien, lié à la ferme. Notation PÉRIODIQUE (une par mois maximum par couple producteur-technicien), pas transactionnelle. Critères : qualité du suivi, ponctualité, fiabilité des saisies."
    },
    "branchement_piliers": {
      "regle": "Ajouter un pilier 'ratings' à chaque profil concerné et REBALANCER les poids existants (somme = 1). Réutiliser la fonction bayésienne existante, ne pas en écrire une seconde.",
      "buyer": "ratings ≈ 0.30 ; réduire proportionnellement paymentReliability / receiptTimeliness / disputeRecord / cancellationRate.",
      "merchant": "ratings ≈ 0.30 ; réduire orderFulfillment / confirmationSpeed / disputeRecord.",
      "technician": "Refonte : ratings ≈ 0.50, followUpActivity ≈ 0.30, regularity ≈ 0.20. L'activité seule ne doit plus suffire à un bon score.",
      "producer": "Inchangé (FarmMarketRating déjà dans commercialTrust).",
      "vet": "Inchangé."
    },
    "anti_abus": [
      "Un avis par transaction, non modifiable après 7 jours",
      "Avis impossible si la transaction a été annulée avant livraison",
      "Un avis émis par un compte lui-même en niveau 'orageux' compte pour moitié dans la moyenne (limite les représailles)",
      "Journaliser tout avis supprimé par un admin (pattern des logs de modération existants)"
    ],
    "mobile": [
      "Modale de notation à la clôture de commande, des DEUX côtés (acheteur note le vendeur, vendeur note l'acheteur)",
      "Notation technicien : depuis la fiche du membre côté producteur, une fois par mois",
      "Notation toujours facultative, jamais bloquante",
      "Affichage d'un avis : étoiles + nombre d'avis. Les étoiles ne servent QU'à ça dans toute l'app."
    ]
  },

  "absolute_rules": [
    "Ne pas réécrire le moteur : réutiliser agrégation bayésienne, état 'nouvelle', redistribution des poids",
    "Incrémenter TRUST_SCORE_VERSION (snapshots comparables par version)",
    "Aucun avis sans transaction vérifiée en base",
    "Migration Prisma additive uniquement, aucune donnée existante modifiée",
    "Ne PAS activer TRUST_SCORE_V2_ACTIVE dans ce prompt (c'est E2)",
    "Tests existants du module trust-score verts avant et après",
    "Chaînes FR + EN simples"
  ],

  "acceptance_criteria": [
    "Commande soldée : les deux parties peuvent se noter une fois ; seconde tentative refusée",
    "Commande annulée avant livraison : aucune notation possible",
    "Technicien : seconde notation dans le mois refusée",
    "Profil sans aucun avis : score calculé normalement, poids redistribués, aucun malus (état 'nouvelle' respecté)",
    "Un seul avis à 1/5 sur un profil neuf ne fait pas chuter le score en 'orageux' (prior bayésien vérifié par test)",
    "Somme des poids = 1 pour chacun des 5 profils (test unitaire)"
  ]
}
```

---

## PROMPT E2 — Météo explicite + activation du trust score v2

```json
{
  "task": "Rendre la Météo compréhensible par des preuves chiffrées, puis activer le trust score v2 après vérification en mode ombre",

  "context": "E1 mergé : chaque métier a ses avis et ses piliers. Deux problèmes restants. (1) RETOUR TESTEURS : la métaphore météo n'est pas comprise — 'ciel orageux veut dire quoi ?'. Elle est CONSERVÉE comme résumé visuel, mais chaque pilier doit exposer une preuve chiffrée lisible. (2) TRUST_SCORE_V2_ACTIVE est encore à false : la prod sert le score producteur v1 à tous les profils.",

  "blocage_technique_a_traiter_en_premier": "PillarView expose {key, score (0–1 normalisé et lissé bayésiennement), weight, sampleSize, hintKey}. Ce score N'EST PAS reconstituable en '3 sur 10', et les piliers temporels (réactivité, délai de confirmation) ne sont pas des ratios. Interdiction absolue de dériver une preuve depuis score × sampleSize — la preuve se calcule à la source, sur la donnée brute.",

  "preliminary_audit": {
    "files_to_read": [
      "apps/api/src/trust-score/trust-score-metrics.service.ts (chaque pilier et sa donnée source)",
      "apps/api/src/trust-score/trust-score.util.ts (PillarView, aggregatePillars)",
      "apps/api/src/trust-score/trust-score.constants.ts (TRUST_PILLAR_HINT_KEYS, seuils de niveau)",
      "apps/mobile/src/components/meteo/, components/common/MeteoProgressBar.tsx, components/marketplace/BuyerMeteoSheet.tsx, BuyerMeteoBadge.tsx"
    ],
    "task_before_coding": "Pour CHAQUE pilier des 5 profils, me lister en commentaire de PR : la donnée source et la preuve chiffrée exacte qu'on peut en tirer. Si un pilier n'a pas de preuve exprimable simplement, le signaler — il s'affichera sans chiffre plutôt qu'avec un chiffre inventé."
  },

  "spec": {
    "1_preuves_backend": {
      "changement": "Étendre PillarView d'un champ 'evidence' typé, calculé à la source :",
      "shape": "evidence: { kind: 'ratio', good: number, total: number } | { kind: 'duration', averageMinutes: number } | { kind: 'count', value: number } | { kind: 'rating', average: number, count: number } | null",
      "regles": [
        "Calculé dans trust-score-metrics.service là où la donnée brute est disponible — JAMAIS dérivé du score normalisé",
        "evidence: null autorisé : le pilier s'affiche alors sans chiffre",
        "Stocké dans le champ pillars (Json) du snapshot — pas de nouvelle table",
        "Aucun changement des formules de score : les preuves accompagnent le calcul, elles ne le modifient pas"
      ]
    },
    "2_seuil_de_publication": {
      "regle": "Une preuve n'est publiée qu'au-delà d'un échantillon minimum (défaut 5, paramétrable comme les limites d'abonnement). En dessous : 'Pas encore assez d'historique'.",
      "raison": "'1 retard sur 1' condamne un profil neuf sur un incident isolé. Cohérent avec l'état 'nouvelle' existant."
    },
    "3_visibilite_graduee": {
      "mon_profil": "Niveau + tous les piliers + preuves + conseils concrets ('Réglez vos 2 soldes en retard pour remonter')",
      "contrepartie_en_transaction": "Niveau + preuves des piliers pertinents pour CETTE transaction (un vendeur voit la fiabilité de paiement de l'acheteur, pas sa régularité de saisie)",
      "consultation_publique": "Niveau + moyenne des avis + nombre d'avis. Preuves comportementales détaillées masquées hors relation commerciale."
    },
    "4_ui_meteo": [
      "Chaque badge Météo devient tapable → feuille explicative",
      "En-tête : le niveau en langage clair + une phrase factuelle ('Historique solide sur 14 transactions'), aucun adjectif de jugement",
      "Corps : une ligne par pilier — libellé métier, preuve chiffrée, barre de progression existante",
      "Pied : légende permanente des niveaux avec le critère de chacun ('Orageux : moins de 35 % de signaux positifs')",
      "Libellés métier explicites par profil — acheteur : 'Paiements tenus', 'Réception à l'heure', 'Litiges', 'Annulations', 'Avis des vendeurs'",
      "Étoiles uniquement pour les avis réels (moyenne + nombre), jamais pour le score composite",
      "Badge Météo présent sur les fiches publiques des 5 métiers, pas seulement producteur et vétérinaire"
    ],
    "5_verification_ombre": [
      "Utiliser le mode ombre existant : exécuter v2 sur les comptes réels sans le servir",
      "Produire un rapport comparatif v1 vs v2 par profil : distribution des niveaux, écarts majeurs, profils changeant de niveau",
      "Me livrer ce rapport AVANT toute activation — ne pas basculer sans validation"
    ],
    "6_bascule": [
      "Activation par variable d'environnement, réversible instantanément (chemin v1 conservé)",
      "Les consommateurs du score (crédit, marketplace, badges) lisent le score du PROFIL concerné, jamais le score producteur par défaut",
      "NE PAS activer sans validation explicite du rapport ombre"
    ]
  },

  "absolute_rules": [
    "AUCUN texte de jugement à l'écran : pas de 'n'est pas fiable', 'faites attention', 'mauvais payeur', 'à éviter'. Faits chiffrés et libellés neutres uniquement — s'applique aussi aux clés i18n.",
    "Aucune preuve dérivée d'un score normalisé — donnée brute, sinon evidence: null",
    "Aucune modification des formules de score ni des poids (fixés en E1)",
    "Pas de nouvelle table : les preuves vivent dans le Json pillars du snapshot",
    "Aucune activation sans le rapport ombre validé par moi",
    "Chemin v1 conservé et fonctionnel (retour arrière par variable d'environnement, sans redéploiement)",
    "Aucun score affiché sans sa taille d'échantillon ou son nombre d'avis",
    "Tests existants du module trust-score verts avant et après",
    "Chaînes FR + EN, français simple, phrases courtes"
  ],

  "acceptance_criteria": [
    "Chaque badge Météo ouvre une feuille où chaque pilier affiche soit une preuve chiffrée, soit une absence assumée — jamais un chiffre inventé",
    "Un utilisateur qui découvre l'app comprend son niveau sans explication orale (test sur 2 personnes réelles)",
    "Profil sous le seuil d'échantillon : 'Pas encore assez d'historique', aucun chiffre publié",
    "Grep final : aucune chaîne de jugement dans fr.ts / en.ts sur le namespace trustScore",
    "Vendeur consultant un acheteur : voit la fiabilité de paiement, pas les piliers hors sujet",
    "Étoiles présentes uniquement sur les avis réels, avec leur nombre",
    "Rapport ombre produit et lisible avant bascule",
    "Après bascule : un acheteur voit des piliers d'acheteur, un technicien des piliers de technicien",
    "Retour arrière testé : flag à false → comportement v1 restauré sans redéploiement",
    "Badges Météo présents sur les fiches publiques des 5 métiers"
  ]
}
```
