/**
 * Textes localisés des rapports institutionnels (PDF / CSV).
 * Miroir des leads UI `stats.regional.charts` + libellés catégories.
 */

export type ReportLocale = "fr" | "en";

export function resolveReportLocale(raw?: string | null): ReportLocale {
  return raw?.toLowerCase() === "en" ? "en" : "fr";
}

const PRODUCTION_CATEGORY_LABELS: Record<ReportLocale, Record<string, string>> = {
  fr: {
    fattening: "Engraissement",
    starter: "Démarrage",
    breeding_female: "Truies",
    breeding_male: "Verrats",
    nursing: "Allaitement",
    growth: "Croissance"
  },
  en: {
    fattening: "Fattening",
    starter: "Starter",
    breeding_female: "Breeding females",
    breeding_male: "Breeding males",
    nursing: "Nursing",
    growth: "Growth"
  }
};

export function labelProductionCategory(
  key: string,
  locale: ReportLocale
): string {
  return PRODUCTION_CATEGORY_LABELS[locale][key] ?? key.replace(/_/g, " ");
}

export function labelRecordKeys(
  rec: Record<string, number>,
  locale: ReportLocale,
  labelKey: (k: string, locale: ReportLocale) => string = labelProductionCategory
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[labelKey(k, locale)] = v;
  }
  return out;
}

type CommonDict = {
  partnerInstitution: string;
  reportTitle: string;
  period: (from: string, to: string) => string;
  coverageTitle: string;
  coverageLine: (farms: number, animals: number, depts: number) => string;
  disclaimer: string;
  tabularDetail: string;
  analysisTitle: string;
  chartsUnavailable: string;
  maskedCell: string;
  noGestations: string;
  sectionLabels: Record<string, string>;
  tableHeaders: {
    department: string;
    farms: string;
    mortality: string;
    byCause: string;
    zScore: string;
    herdByCat: string;
    exitsSale: string;
    exitsSlaughter: string;
    litters: string;
    bornAlive: string;
    stillborn: string;
    weaned: string;
    gmqByCat: string;
    salePrice: string;
    vetConsultations: string;
    suspicions: string;
    incidence: string;
    caseFatality: string;
    saleRate: string;
    mortalityRate: string;
    avgAgeSale: string;
    activeFarms: string;
    usersByRole: string;
  };
};

type ChartCopy = { title: string; lead: string };

type ChartsDict = {
  mortality: {
    rank: ChartCopy;
    causes: ChartCopy;
  };
  herd: {
    bars: ChartCopy;
    donut: ChartCopy;
  };
  reproduction: {
    born: ChartCopy;
    farrowing: ChartCopy;
    ia: ChartCopy;
    seriesBorn: string;
    seriesStill: string;
    completed: string;
    lost: string;
  };
  growth: {
    bars: ChartCopy;
    rank: ChartCopy;
  };
  vetCoverage: {
    consult: ChartCopy;
    intensity: ChartCopy;
  };
  economy: {
    group: ChartCopy;
    sales: ChartCopy;
    seriesSale: string;
    seriesSlaughter: string;
  };
  health: {
    incidence: ChartCopy;
    diagnoses: ChartCopy;
    causes: ChartCopy;
  };
  lifecycle: {
    exits: ChartCopy;
    saleShare: ChartCopy;
    saleRateRank: string;
    kindSale: string;
    kindSlaughter: string;
    kindMortality: string;
    kindTransfer: string;
    otherExits: string;
  };
  adoption: {
    farms: ChartCopy;
    roles: ChartCopy;
    retention: (r30: string, r90: string) => string;
  };
};

export type ReportI18n = {
  common: CommonDict;
  charts: ChartsDict;
};

const FR: ReportI18n = {
  common: {
    partnerInstitution: "Institution partenaire",
    reportTitle: "Rapport statistiques régionales",
    period: (from, to) => `Période : ${from} → ${to}`,
    coverageTitle: "Couverture des données",
    coverageLine: (farms, animals, depts) =>
      `${farms} fermes · ${animals} animaux · ${depts} départements`,
    disclaimer:
      "Données agrégées — panel Fermier Pro, non représentatif du cheptel national",
    tabularDetail: "Détail tabulaire",
    analysisTitle: "Analyse et interprétation",
    chartsUnavailable:
      "Graphiques indisponibles (données masquées ou absentes).",
    maskedCell: "données insuffisantes",
    noGestations: "Aucune gestation terminée sur la période.",
    sectionLabels: {
      mortality: "Mortalité",
      herd: "Cheptel",
      reproduction: "Reproduction",
      growth: "Croissance",
      vetCoverage: "Couverture vétérinaire",
      economy: "Économie",
      health: "Santé (suspicions déclarées)",
      lifecycle: "Cycle de vie",
      adoption: "Adoption plateforme",
      movements: "Mouvements"
    },
    tableHeaders: {
      department: "Département",
      farms: "Fermes",
      mortality: "Mortalités",
      byCause: "Par cause",
      zScore: "Z-score",
      herdByCat: "Cheptel / cat.",
      exitsSale: "Sorties vente",
      exitsSlaughter: "Sorties abattage",
      litters: "Portées",
      bornAlive: "Nés vivants",
      stillborn: "Mort-nés",
      weaned: "Sevrés",
      gmqByCat: "GMQ / cat.",
      salePrice: "Prix vente / kg",
      vetConsultations: "Consultations vét.",
      suspicions: "Suspicions déclarées",
      incidence: "Incidence /1 000",
      caseFatality: "Létalité apparente (déclarative)",
      saleRate: "Taux vente",
      mortalityRate: "Taux mortalité",
      avgAgeSale: "Âge moyen vente (j)",
      activeFarms: "Fermes actives",
      usersByRole: "Utilisateurs actifs / rôle"
    }
  },
  charts: {
    mortality: {
      rank: {
        title: "Mortalités par département",
        lead: "Compare les départements entre eux — volume de têtes sorties pour mortalité, pas un taux national."
      },
      causes: {
        title: "Répartition des causes déclarées",
        lead: "Parts des causes agrégées sur la période (déclaratif)."
      }
    },
    herd: {
      bars: {
        title: "Effectif par département",
        lead: "Cheptel suivi sur le panel — couverture plateforme, pas un recensement officiel."
      },
      donut: {
        title: "Répartition par catégorie de production",
        lead: "Part de chaque catégorie de production dans l’effectif agrégé."
      }
    },
    reproduction: {
      born: {
        title: "Nés vivants vs mort-nés",
        lead: "Volumes déclarés via les portées — un volume bas peut refléter une faible saisie."
      },
      farrowing: {
        title: "Issue des gestations",
        lead: "Mises bas réussies vs pertes (avortements + gestations perdues)."
      },
      ia: {
        title: "Part d’insémination artificielle (%)",
        lead: "Modernisation de la filière : part IA parmi les saillies enregistrées."
      },
      seriesBorn: "Nés vivants",
      seriesStill: "Mort-nés",
      completed: "Mises bas",
      lost: "Pertes"
    },
    growth: {
      bars: {
        title: "GMQ moyen par département (kg/j)",
        lead: "Gain moyen quotidien estimé à partir des pesées successives."
      },
      rank: {
        title: "Classement GMQ",
        lead: "Meilleurs gains moyens quotidiens observés sur le panel."
      }
    },
    vetCoverage: {
      consult: {
        title: "Consultations vétérinaires",
        lead: "Accès aux soins déclaré — pas la couverture vaccinale."
      },
      intensity: {
        title: "Intensité / ferme",
        lead: "Consultations rapportées au nombre de fermes du département."
      }
    },
    economy: {
      group: {
        title: "Vente vs abattage",
        lead: "Comparaison des sorties commerciales et d’abattage déclarées."
      },
      sales: {
        title: "Têtes vendues par département",
        lead: "Volume des ventes déclarées — complète l’index marketplace."
      },
      seriesSale: "Vente",
      seriesSlaughter: "Abattage"
    },
    health: {
      incidence: {
        title: "Incidence des suspicions / 1 000",
        lead: "Classement par incidence (pas par volume brut). Suspicions déclarées — non confirmées labo."
      },
      diagnoses: {
        title: "Top diagnostics déclarés",
        lead: "Répartition des suspicions déclarées par diagnostic normalisé."
      },
      causes: {
        title: "Causes de mortalité associées",
        lead: "Corrélation déclarative uniquement — pas de confirmation laboratoire."
      }
    },
    lifecycle: {
      exits: {
        title: "Où vont les porcs ?",
        lead: "Répartition des sorties : vente, abattage, mortalité, transfert."
      },
      saleShare: {
        title: "Part des ventes parmi les sorties",
        lead: "Poids des ventes parmi l’ensemble des sorties déclarées."
      },
      saleRateRank: "Taux de vente du cheptel par département (%)",
      kindSale: "Vente",
      kindSlaughter: "Abattage",
      kindMortality: "Mortalité",
      kindTransfer: "Transfert",
      otherExits: "Autres"
    },
    adoption: {
      farms: {
        title: "Fermes actives (fenêtre 30 j)",
        lead: "Fermes avec ≥ 1 saisie récente — mesure d’adoption plus stricte que le MAU."
      },
      roles: {
        title: "Utilisateurs actifs par rôle",
        lead: "Utilisateurs actifs rattachés aux fermes du département, par type de profil."
      },
      retention: (r30, r90) => `Rétention J+30 : ${r30} · J+90 : ${r90}`
    }
  }
};

const EN: ReportI18n = {
  common: {
    partnerInstitution: "Partner institution",
    reportTitle: "Regional statistics report",
    period: (from, to) => `Period: ${from} → ${to}`,
    coverageTitle: "Data coverage",
    coverageLine: (farms, animals, depts) =>
      `${farms} farms · ${animals} animals · ${depts} departments`,
    disclaimer:
      "Aggregated data — Fermier Pro panel, not representative of the national herd",
    tabularDetail: "Tabular detail",
    analysisTitle: "Analysis and interpretation",
    chartsUnavailable: "Charts unavailable (masked or missing data).",
    maskedCell: "insufficient data",
    noGestations: "No completed gestations in the period.",
    sectionLabels: {
      mortality: "Mortality",
      herd: "Herd",
      reproduction: "Reproduction",
      growth: "Growth",
      vetCoverage: "Veterinary coverage",
      economy: "Economy",
      health: "Health (declared suspicions)",
      lifecycle: "Lifecycle",
      adoption: "Platform adoption",
      movements: "Movements"
    },
    tableHeaders: {
      department: "Department",
      farms: "Farms",
      mortality: "Mortality",
      byCause: "By cause",
      zScore: "Z-score",
      herdByCat: "Herd / cat.",
      exitsSale: "Sale exits",
      exitsSlaughter: "Slaughter exits",
      litters: "Litters",
      bornAlive: "Born alive",
      stillborn: "Stillborn",
      weaned: "Weaned",
      gmqByCat: "ADG / cat.",
      salePrice: "Sale price / kg",
      vetConsultations: "Vet consultations",
      suspicions: "Declared suspicions",
      incidence: "Incidence /1,000",
      caseFatality: "Apparent case fatality (declarative)",
      saleRate: "Sale rate",
      mortalityRate: "Mortality rate",
      avgAgeSale: "Avg age at sale (d)",
      activeFarms: "Active farms",
      usersByRole: "Active users / role"
    }
  },
  charts: {
    mortality: {
      rank: {
        title: "Mortality by department",
        lead: "Compare departments — mortality headcount exits, not a national rate."
      },
      causes: {
        title: "Declared cause mix",
        lead: "Shares of aggregated causes over the period (declarative)."
      }
    },
    herd: {
      bars: {
        title: "Herd by department",
        lead: "Panel herd sizes — platform coverage, not an official census."
      },
      donut: {
        title: "Share by production category",
        lead: "Production category mix in the aggregated herd."
      }
    },
    reproduction: {
      born: {
        title: "Born alive vs stillborn",
        lead: "Volumes from litters — low volume may reflect sparse data entry."
      },
      farrowing: {
        title: "Gestation outcomes",
        lead: "Successful farrowings vs losses (aborted + lost gestations)."
      },
      ia: {
        title: "Artificial insemination share (%)",
        lead: "Sector modernization: AI share among recorded matings."
      },
      seriesBorn: "Born alive",
      seriesStill: "Stillborn",
      completed: "Farrowings",
      lost: "Losses"
    },
    growth: {
      bars: {
        title: "Average ADG by department (kg/d)",
        lead: "Average daily gain estimated from successive weighings."
      },
      rank: {
        title: "ADG ranking",
        lead: "Best observed average daily gains on the panel."
      }
    },
    vetCoverage: {
      consult: {
        title: "Veterinary consultations",
        lead: "Declared access to care — not vaccine coverage."
      },
      intensity: {
        title: "Intensity / farm",
        lead: "Consultations relative to the department farm count."
      }
    },
    economy: {
      group: {
        title: "Sale vs slaughter",
        lead: "Side-by-side commercial and slaughter exits."
      },
      sales: {
        title: "Heads sold by department",
        lead: "Declared sales volume — complements the marketplace index."
      },
      seriesSale: "Sale",
      seriesSlaughter: "Slaughter"
    },
    health: {
      incidence: {
        title: "Suspicion incidence / 1,000",
        lead: "Ranked by incidence (not raw volume). Declared suspicions — not lab-confirmed."
      },
      diagnoses: {
        title: "Top declared diagnoses",
        lead: "Declared suspicions by normalized diagnosis."
      },
      causes: {
        title: "Related mortality causes",
        lead: "Declarative correlation only — not laboratory confirmation."
      }
    },
    lifecycle: {
      exits: {
        title: "Where do pigs go?",
        lead: "Exit mix: sale, slaughter, mortality, transfer."
      },
      saleShare: {
        title: "Sale share among exits",
        lead: "Weight of sales among all declared exits."
      },
      saleRateRank: "Herd sale rate by department (%)",
      kindSale: "Sale",
      kindSlaughter: "Slaughter",
      kindMortality: "Mortality",
      kindTransfer: "Transfer",
      otherExits: "Other"
    },
    adoption: {
      farms: {
        title: "Active farms (30-day window)",
        lead: "Farms with ≥ 1 recent entry — stricter adoption measure than MAU."
      },
      roles: {
        title: "Active users by role",
        lead: "Active users linked to department farms, by profile type."
      },
      retention: (r30, r90) => `Retention D+30: ${r30} · D+90: ${r90}`
    }
  }
};

export function reportI18n(locale: ReportLocale): ReportI18n {
  return locale === "en" ? EN : FR;
}

/** Insights dynamiques (chiffres du panel) — une phrase d’interprétation. */
export const chartInsights = {
  topDept(
    locale: ReportLocale,
    top: { label: string; value: number } | undefined,
    metricFr: string,
    metricEn: string,
    unit = ""
  ): string {
    if (!top || top.value <= 0) {
      return locale === "en"
        ? "No usable departmental signal on this chart for the selected period."
        : "Aucun signal départemental exploitable sur ce graphique pour la période.";
    }
    const unitTxt = unit ? ` ${unit}` : "";
    return locale === "en"
      ? `Highest ${metricEn}: ${top.label} (${formatNum(top.value)}${unitTxt}). Focus monitoring there first.`
      : `Plus fort ${metricFr} : ${top.label} (${formatNum(top.value)}${unitTxt}). Prioriser le suivi sur ce territoire.`;
  },

  dominantShare(
    locale: ReportLocale,
    top: { label: string; value: number } | undefined,
    total: number
  ): string {
    if (!top || total <= 0) {
      return locale === "en"
        ? "No dominant category emerges from the available data."
        : "Aucune catégorie dominante ne se dégage des données disponibles.";
    }
    const pct = Math.round((top.value / total) * 100);
    return locale === "en"
      ? `"${top.label}" leads with ${pct}% of the total (${formatNum(top.value)}). Check whether this reflects herd structure or reporting bias.`
      : `« ${top.label} » domine avec ${pct} % du total (${formatNum(top.value)}). Vérifier si cela reflète la structure du cheptel ou un biais de saisie.`;
  },

  bornVsStill(
    locale: ReportLocale,
    born: number,
    still: number
  ): string {
    if (born + still <= 0) {
      return locale === "en"
        ? "No birth outcomes recorded — encourage litter entry to unlock this reading."
        : "Aucun résultat de naissance enregistré — encourager la saisie des portées pour activer cette lecture.";
    }
    const rate = born + still > 0 ? Math.round((still / (born + still)) * 100) : 0;
    return locale === "en"
      ? `${formatNum(born)} born alive vs ${formatNum(still)} stillborn (≈ ${rate}% stillbirth share). Spikes may signal recording gaps or a sanitary episode.`
      : `${formatNum(born)} nés vivants vs ${formatNum(still)} mort-nés (≈ ${rate} % de part mort-nés). Un pic peut indiquer un défaut de saisie ou un épisode sanitaire.`;
  },

  farrowing(
    locale: ReportLocale,
    completed: number,
    lost: number
  ): string {
    const total = completed + lost;
    if (total <= 0) {
      return locale === "en"
        ? "No completed gestations to interpret."
        : "Aucune gestation terminée à interpréter.";
    }
    const ok = Math.round((completed / total) * 100);
    return locale === "en"
      ? `${ok}% successful farrowings (${formatNum(completed)} / ${formatNum(total)}). Losses include abortions and lost gestations.`
      : `${ok} % de mises bas réussies (${formatNum(completed)} / ${formatNum(total)}). Les pertes incluent avortements et gestations perdues.`;
  },

  saleVsSlaughter(
    locale: ReportLocale,
    sale: number,
    slaughter: number
  ): string {
    const total = sale + slaughter;
    if (total <= 0) {
      return locale === "en"
        ? "No commercial or slaughter exits declared on the panel."
        : "Aucune sortie commerciale ou d’abattage déclarée sur le panel.";
    }
    const salePct = Math.round((sale / total) * 100);
    return locale === "en"
      ? `Sales account for ${salePct}% of sale+slaughter exits (${formatNum(sale)} vs ${formatNum(slaughter)}). Useful to gauge market orientation of the panel.`
      : `Les ventes représentent ${salePct} % des sorties vente+abattage (${formatNum(sale)} vs ${formatNum(slaughter)}). Utile pour jauger l’orientation marché du panel.`;
  },

  exitMix(
    locale: ReportLocale,
    parts: { label: string; value: number }[]
  ): string {
    const total = parts.reduce((s, p) => s + p.value, 0);
    if (total <= 0) {
      return locale === "en"
        ? "No exits to interpret for the period."
        : "Aucune sortie à interpréter sur la période.";
    }
    const top = [...parts].sort((a, b) => b.value - a.value)[0]!;
    const pct = Math.round((top.value / total) * 100);
    return locale === "en"
      ? `Main exit pathway: ${top.label} (${pct}% of declared exits). Cross-check with mortality and sale rates.`
      : `Principale voie de sortie : ${top.label} (${pct} % des sorties déclarées). Croiser avec les taux de mortalité et de vente.`;
  },

  retention(
    locale: ReportLocale,
    r30: number,
    r90: number
  ): string {
    if (r30 <= 0 && r90 <= 0) {
      return locale === "en"
        ? "Retention indicators unavailable for this extract."
        : "Indicateurs de rétention indisponibles pour cet extrait.";
    }
    return locale === "en"
      ? `Retention ≈ ${r30.toFixed(0)}% at D+30 and ${r90.toFixed(0)}% at D+90. Falling retention suggests onboarding or engagement issues.`
      : `Rétention ≈ ${r30.toFixed(0)} % à J+30 et ${r90.toFixed(0)} % à J+90. Une baisse signale un frein à l’onboarding ou à l’engagement.`;
  }
};

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 10) / 10).toString();
}
