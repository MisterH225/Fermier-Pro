/** Référentiel administratif Côte d'Ivoire — districts, régions, départements. */
export type AdminRegionSeed = {
  code: string;
  name: string;
  level: "district" | "region" | "department";
  parentCode: string | null;
};

export const CI_ADMIN_REGIONS: AdminRegionSeed[] = [
  {
    "code": "CI-AB",
    "name": "Abidjan",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-YM",
    "name": "Yamoussoukro",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-BS",
    "name": "Bas-Sassandra",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-CO",
    "name": "Comoé",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-DE",
    "name": "Denguélé",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-GD",
    "name": "Gôh-Djiboua",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-LA",
    "name": "Lacs",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-LG",
    "name": "Lagunes",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-MO",
    "name": "Montagnes",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-SM",
    "name": "Sassandra-Marahoué",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-SA",
    "name": "Savanes",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-VB",
    "name": "Vallée du Bandama",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-WO",
    "name": "Woroba",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-D-ZA",
    "name": "Zanzan",
    "level": "district",
    "parentCode": null
  },
  {
    "code": "CI-R-AB",
    "name": "Abidjan",
    "level": "region",
    "parentCode": "CI-AB"
  },
  {
    "code": "CI-R-YM",
    "name": "Yamoussoukro",
    "level": "region",
    "parentCode": "CI-YM"
  },
  {
    "code": "CI-R-GB",
    "name": "Gbêkê",
    "level": "region",
    "parentCode": "CI-D-VB"
  },
  {
    "code": "CI-R-HA",
    "name": "Hambol",
    "level": "region",
    "parentCode": "CI-D-VB"
  },
  {
    "code": "CI-R-BE",
    "name": "Bélier",
    "level": "region",
    "parentCode": "CI-D-LA"
  },
  {
    "code": "CI-R-IF",
    "name": "Iffou",
    "level": "region",
    "parentCode": "CI-D-LA"
  },
  {
    "code": "CI-R-MO",
    "name": "Moronou",
    "level": "region",
    "parentCode": "CI-D-LA"
  },
  {
    "code": "CI-R-NZ",
    "name": "N'Zi",
    "level": "region",
    "parentCode": "CI-D-LA"
  },
  {
    "code": "CI-R-AG",
    "name": "Agnéby-Tiassa",
    "level": "region",
    "parentCode": "CI-D-LG"
  },
  {
    "code": "CI-R-GR",
    "name": "Grands-Ponts",
    "level": "region",
    "parentCode": "CI-D-LG"
  },
  {
    "code": "CI-R-LM",
    "name": "La Mé",
    "level": "region",
    "parentCode": "CI-D-LG"
  },
  {
    "code": "CI-R-SU",
    "name": "Sud-Comoé",
    "level": "region",
    "parentCode": "CI-D-CO"
  },
  {
    "code": "CI-R-IN",
    "name": "Indénié-Djuablin",
    "level": "region",
    "parentCode": "CI-D-CO"
  },
  {
    "code": "CI-R-GO",
    "name": "Gôh",
    "level": "region",
    "parentCode": "CI-D-GD"
  },
  {
    "code": "CI-R-LO",
    "name": "Lôh-Djiboua",
    "level": "region",
    "parentCode": "CI-D-GD"
  },
  {
    "code": "CI-R-NA",
    "name": "Nawa",
    "level": "region",
    "parentCode": "CI-D-BS"
  },
  {
    "code": "CI-R-SB",
    "name": "San-Pédro",
    "level": "region",
    "parentCode": "CI-D-BS"
  },
  {
    "code": "CI-R-GBK",
    "name": "Gboklè",
    "level": "region",
    "parentCode": "CI-D-BS"
  },
  {
    "code": "CI-R-HV",
    "name": "Haut-Sassandra",
    "level": "region",
    "parentCode": "CI-D-SM"
  },
  {
    "code": "CI-R-MR",
    "name": "Marahoué",
    "level": "region",
    "parentCode": "CI-D-SM"
  },
  {
    "code": "CI-R-TO",
    "name": "Tonkpi",
    "level": "region",
    "parentCode": "CI-D-MO"
  },
  {
    "code": "CI-R-GC",
    "name": "Guémon",
    "level": "region",
    "parentCode": "CI-D-MO"
  },
  {
    "code": "CI-R-CV",
    "name": "Cavally",
    "level": "region",
    "parentCode": "CI-D-MO"
  },
  {
    "code": "CI-R-BA",
    "name": "Bagoué",
    "level": "region",
    "parentCode": "CI-D-SA"
  },
  {
    "code": "CI-R-PO",
    "name": "Poro",
    "level": "region",
    "parentCode": "CI-D-SA"
  },
  {
    "code": "CI-R-TC",
    "name": "Tchologo",
    "level": "region",
    "parentCode": "CI-D-SA"
  },
  {
    "code": "CI-R-FO",
    "name": "Folon",
    "level": "region",
    "parentCode": "CI-D-DE"
  },
  {
    "code": "CI-R-KA",
    "name": "Kabadougou",
    "level": "region",
    "parentCode": "CI-D-DE"
  },
  {
    "code": "CI-R-BEO",
    "name": "Béré",
    "level": "region",
    "parentCode": "CI-D-WO"
  },
  {
    "code": "CI-R-BAF",
    "name": "Bafing",
    "level": "region",
    "parentCode": "CI-D-WO"
  },
  {
    "code": "CI-R-WOR",
    "name": "Worodougou",
    "level": "region",
    "parentCode": "CI-D-WO"
  },
  {
    "code": "CI-R-BO",
    "name": "Bounkani",
    "level": "region",
    "parentCode": "CI-D-ZA"
  },
  {
    "code": "CI-R-GOU",
    "name": "Gontougo",
    "level": "region",
    "parentCode": "CI-D-ZA"
  },
  {
    "code": "CI-AB",
    "name": "Abidjan",
    "level": "department",
    "parentCode": "CI-R-AB"
  },
  {
    "code": "CI-YM",
    "name": "Yamoussoukro",
    "level": "department",
    "parentCode": "CI-R-YM"
  },
  {
    "code": "CI-BK",
    "name": "Bouaké",
    "level": "department",
    "parentCode": "CI-R-GB"
  },
  {
    "code": "CI-DEP-BEOUMI",
    "name": "Béoumi",
    "level": "department",
    "parentCode": "CI-R-GB"
  },
  {
    "code": "CI-DEP-BOTRO",
    "name": "Botro",
    "level": "department",
    "parentCode": "CI-R-GB"
  },
  {
    "code": "CI-DEP-SAKASSOU",
    "name": "Sakassou",
    "level": "department",
    "parentCode": "CI-R-GB"
  },
  {
    "code": "CI-DEP-KATIOLA",
    "name": "Katiola",
    "level": "department",
    "parentCode": "CI-R-HA"
  },
  {
    "code": "CI-DEP-DABAKALA",
    "name": "Dabakala",
    "level": "department",
    "parentCode": "CI-R-HA"
  },
  {
    "code": "CI-DEP-NIAKARAM",
    "name": "Niakaramandougou",
    "level": "department",
    "parentCode": "CI-R-HA"
  },
  {
    "code": "CI-DEP-TOUMODI",
    "name": "Toumodi",
    "level": "department",
    "parentCode": "CI-R-BE"
  },
  {
    "code": "CI-DEP-DIDIEVI",
    "name": "Didiévi",
    "level": "department",
    "parentCode": "CI-R-BE"
  },
  {
    "code": "CI-DEP-TIEBISSO",
    "name": "Tiébissou",
    "level": "department",
    "parentCode": "CI-R-BE"
  },
  {
    "code": "CI-DEP-DAOUKRO",
    "name": "Daoukro",
    "level": "department",
    "parentCode": "CI-R-IF"
  },
  {
    "code": "CI-DEP-MBAHIAKR",
    "name": "M'Bahiakro",
    "level": "department",
    "parentCode": "CI-R-IF"
  },
  {
    "code": "CI-DEP-PRIKRO",
    "name": "Prikro",
    "level": "department",
    "parentCode": "CI-R-IF"
  },
  {
    "code": "CI-DEP-BONGOUAN",
    "name": "Bongouanou",
    "level": "department",
    "parentCode": "CI-R-MO"
  },
  {
    "code": "CI-DEP-ARRAH",
    "name": "Arrah",
    "level": "department",
    "parentCode": "CI-R-MO"
  },
  {
    "code": "CI-DEP-MBATTO",
    "name": "M'Batto",
    "level": "department",
    "parentCode": "CI-R-MO"
  },
  {
    "code": "CI-DEP-DIMBOKRO",
    "name": "Dimbokro",
    "level": "department",
    "parentCode": "CI-R-NZ"
  },
  {
    "code": "CI-DEP-BOCANDA",
    "name": "Bocanda",
    "level": "department",
    "parentCode": "CI-R-NZ"
  },
  {
    "code": "CI-DEP-KOUASSIK",
    "name": "Kouassi-Kouassikro",
    "level": "department",
    "parentCode": "CI-R-NZ"
  },
  {
    "code": "CI-DEP-AGBOVILL",
    "name": "Agboville",
    "level": "department",
    "parentCode": "CI-R-AG"
  },
  {
    "code": "CI-DEP-TIASSALE",
    "name": "Tiassalé",
    "level": "department",
    "parentCode": "CI-R-AG"
  },
  {
    "code": "CI-DEP-SIKENSI",
    "name": "Sikensi",
    "level": "department",
    "parentCode": "CI-R-AG"
  },
  {
    "code": "CI-DEP-TAABO",
    "name": "Taabo",
    "level": "department",
    "parentCode": "CI-R-AG"
  },
  {
    "code": "CI-DEP-DABOU",
    "name": "Dabou",
    "level": "department",
    "parentCode": "CI-R-GR"
  },
  {
    "code": "CI-DEP-GRANDLAH",
    "name": "Grand-Lahou",
    "level": "department",
    "parentCode": "CI-R-GR"
  },
  {
    "code": "CI-DEP-JACQUEVI",
    "name": "Jacqueville",
    "level": "department",
    "parentCode": "CI-R-GR"
  },
  {
    "code": "CI-DEP-ADZOPE",
    "name": "Adzopé",
    "level": "department",
    "parentCode": "CI-R-LM"
  },
  {
    "code": "CI-DEP-AKOUPE",
    "name": "Akoupé",
    "level": "department",
    "parentCode": "CI-R-LM"
  },
  {
    "code": "CI-DEP-YAKASSEA",
    "name": "Yakassé-Attobrou",
    "level": "department",
    "parentCode": "CI-R-LM"
  },
  {
    "code": "CI-DEP-ABOISSO",
    "name": "Aboisso",
    "level": "department",
    "parentCode": "CI-R-SU"
  },
  {
    "code": "CI-DEP-ADIAKE",
    "name": "Adiaké",
    "level": "department",
    "parentCode": "CI-R-SU"
  },
  {
    "code": "CI-DEP-GRANDBAS",
    "name": "Grand-Bassam",
    "level": "department",
    "parentCode": "CI-R-SU"
  },
  {
    "code": "CI-DEP-TIAPOUM",
    "name": "Tiapoum",
    "level": "department",
    "parentCode": "CI-R-SU"
  },
  {
    "code": "CI-AE",
    "name": "Abengourou",
    "level": "department",
    "parentCode": "CI-R-IN"
  },
  {
    "code": "CI-DEP-AGNIBILE",
    "name": "Agnibilékrou",
    "level": "department",
    "parentCode": "CI-R-IN"
  },
  {
    "code": "CI-DEP-BETTIE",
    "name": "Bettié",
    "level": "department",
    "parentCode": "CI-R-IN"
  },
  {
    "code": "CI-GG",
    "name": "Gagnoa",
    "level": "department",
    "parentCode": "CI-R-GO"
  },
  {
    "code": "CI-DEP-OUME",
    "name": "Oumé",
    "level": "department",
    "parentCode": "CI-R-GO"
  },
  {
    "code": "CI-DV",
    "name": "Divo",
    "level": "department",
    "parentCode": "CI-R-LO"
  },
  {
    "code": "CI-DEP-GUITRY",
    "name": "Guitry",
    "level": "department",
    "parentCode": "CI-R-LO"
  },
  {
    "code": "CI-DEP-LAKOTA",
    "name": "Lakota",
    "level": "department",
    "parentCode": "CI-R-LO"
  },
  {
    "code": "CI-SB",
    "name": "Soubré",
    "level": "department",
    "parentCode": "CI-R-NA"
  },
  {
    "code": "CI-DEP-BUYO",
    "name": "Buyo",
    "level": "department",
    "parentCode": "CI-R-NA"
  },
  {
    "code": "CI-DEP-GUEYO",
    "name": "Guéyo",
    "level": "department",
    "parentCode": "CI-R-NA"
  },
  {
    "code": "CI-DEP-MEAGUI",
    "name": "Méagui",
    "level": "department",
    "parentCode": "CI-R-NA"
  },
  {
    "code": "CI-SP",
    "name": "San-Pédro",
    "level": "department",
    "parentCode": "CI-R-SB"
  },
  {
    "code": "CI-DEP-TABOU",
    "name": "Tabou",
    "level": "department",
    "parentCode": "CI-R-SB"
  },
  {
    "code": "CI-DEP-SASSANDR",
    "name": "Sassandra",
    "level": "department",
    "parentCode": "CI-R-GBK"
  },
  {
    "code": "CI-DEP-FRESCO",
    "name": "Fresco",
    "level": "department",
    "parentCode": "CI-R-GBK"
  },
  {
    "code": "CI-DL",
    "name": "Daloa",
    "level": "department",
    "parentCode": "CI-R-HV"
  },
  {
    "code": "CI-DEP-ISSIA",
    "name": "Issia",
    "level": "department",
    "parentCode": "CI-R-HV"
  },
  {
    "code": "CI-DEP-VAVOUA",
    "name": "Vavoua",
    "level": "department",
    "parentCode": "CI-R-HV"
  },
  {
    "code": "CI-DEP-ZOUKOUGB",
    "name": "Zoukougbeu",
    "level": "department",
    "parentCode": "CI-R-HV"
  },
  {
    "code": "CI-DEP-BOUAFLE",
    "name": "Bouaflé",
    "level": "department",
    "parentCode": "CI-R-MR"
  },
  {
    "code": "CI-DEP-SINFRA",
    "name": "Sinfra",
    "level": "department",
    "parentCode": "CI-R-MR"
  },
  {
    "code": "CI-DEP-ZUENOULA",
    "name": "Zuénoula",
    "level": "department",
    "parentCode": "CI-R-MR"
  },
  {
    "code": "CI-MN",
    "name": "Man",
    "level": "department",
    "parentCode": "CI-R-TO"
  },
  {
    "code": "CI-DEP-BIANKOUM",
    "name": "Biankouma",
    "level": "department",
    "parentCode": "CI-R-TO"
  },
  {
    "code": "CI-DEP-DANANE",
    "name": "Danané",
    "level": "department",
    "parentCode": "CI-R-TO"
  },
  {
    "code": "CI-DEP-ZOUANHOU",
    "name": "Zouan-Hounien",
    "level": "department",
    "parentCode": "CI-R-TO"
  },
  {
    "code": "CI-DEP-DUEKOUE",
    "name": "Duékoué",
    "level": "department",
    "parentCode": "CI-R-GC"
  },
  {
    "code": "CI-DEP-BANGOLO",
    "name": "Bangolo",
    "level": "department",
    "parentCode": "CI-R-GC"
  },
  {
    "code": "CI-DEP-FACOBLY",
    "name": "Facobly",
    "level": "department",
    "parentCode": "CI-R-GC"
  },
  {
    "code": "CI-DEP-KOUIBLY",
    "name": "Kouibly",
    "level": "department",
    "parentCode": "CI-R-GC"
  },
  {
    "code": "CI-DEP-GUIGLO",
    "name": "Guiglo",
    "level": "department",
    "parentCode": "CI-R-CV"
  },
  {
    "code": "CI-DEP-BLOLEQUI",
    "name": "Bloléquin",
    "level": "department",
    "parentCode": "CI-R-CV"
  },
  {
    "code": "CI-DEP-TOULEPLE",
    "name": "Toulépleu",
    "level": "department",
    "parentCode": "CI-R-CV"
  },
  {
    "code": "CI-BN",
    "name": "Boundiali",
    "level": "department",
    "parentCode": "CI-R-BA"
  },
  {
    "code": "CI-DEP-TENGRELA",
    "name": "Tengréla",
    "level": "department",
    "parentCode": "CI-R-BA"
  },
  {
    "code": "CI-DEP-KOUTO",
    "name": "Kouto",
    "level": "department",
    "parentCode": "CI-R-BA"
  },
  {
    "code": "CI-KO",
    "name": "Korhogo",
    "level": "department",
    "parentCode": "CI-R-PO"
  },
  {
    "code": "CI-DEP-DIKODOUG",
    "name": "Dikodougou",
    "level": "department",
    "parentCode": "CI-R-PO"
  },
  {
    "code": "CI-DEP-MBENGUE",
    "name": "M'Bengué",
    "level": "department",
    "parentCode": "CI-R-PO"
  },
  {
    "code": "CI-DEP-SINEMATI",
    "name": "Sinématiali",
    "level": "department",
    "parentCode": "CI-R-PO"
  },
  {
    "code": "CI-FK",
    "name": "Ferkessédougou",
    "level": "department",
    "parentCode": "CI-R-TC"
  },
  {
    "code": "CI-DEP-KONG",
    "name": "Kong",
    "level": "department",
    "parentCode": "CI-R-TC"
  },
  {
    "code": "CI-DEP-OUANGOLO",
    "name": "Ouangolodougou",
    "level": "department",
    "parentCode": "CI-R-TC"
  },
  {
    "code": "CI-DEP-MINIGNAN",
    "name": "Minignan",
    "level": "department",
    "parentCode": "CI-R-FO"
  },
  {
    "code": "CI-DEP-KANIASSO",
    "name": "Kaniasso",
    "level": "department",
    "parentCode": "CI-R-FO"
  },
  {
    "code": "CI-OD",
    "name": "Odienné",
    "level": "department",
    "parentCode": "CI-R-KA"
  },
  {
    "code": "CI-DEP-MADINANI",
    "name": "Madinani",
    "level": "department",
    "parentCode": "CI-R-KA"
  },
  {
    "code": "CI-DEP-SAMATIGU",
    "name": "Samatiguila",
    "level": "department",
    "parentCode": "CI-R-KA"
  },
  {
    "code": "CI-DEP-SEGUELON",
    "name": "Séguélon",
    "level": "department",
    "parentCode": "CI-R-KA"
  },
  {
    "code": "CI-DEP-MANKONO",
    "name": "Mankono",
    "level": "department",
    "parentCode": "CI-R-BEO"
  },
  {
    "code": "CI-DEP-KOUNAHIR",
    "name": "Kounahiri",
    "level": "department",
    "parentCode": "CI-R-BEO"
  },
  {
    "code": "CI-DEP-DIANRA",
    "name": "Dianra",
    "level": "department",
    "parentCode": "CI-R-BEO"
  },
  {
    "code": "CI-DEP-TOUBA",
    "name": "Touba",
    "level": "department",
    "parentCode": "CI-R-BAF"
  },
  {
    "code": "CI-DEP-KORO",
    "name": "Koro",
    "level": "department",
    "parentCode": "CI-R-BAF"
  },
  {
    "code": "CI-DEP-OUANINOU",
    "name": "Ouaninou",
    "level": "department",
    "parentCode": "CI-R-BAF"
  },
  {
    "code": "CI-DEP-SEGUELA",
    "name": "Séguéla",
    "level": "department",
    "parentCode": "CI-R-WOR"
  },
  {
    "code": "CI-DEP-KANI",
    "name": "Kani",
    "level": "department",
    "parentCode": "CI-R-WOR"
  },
  {
    "code": "CI-DEP-BOUNA",
    "name": "Bouna",
    "level": "department",
    "parentCode": "CI-R-BO"
  },
  {
    "code": "CI-DEP-DOROPO",
    "name": "Doropo",
    "level": "department",
    "parentCode": "CI-R-BO"
  },
  {
    "code": "CI-DEP-NASSIAN",
    "name": "Nassian",
    "level": "department",
    "parentCode": "CI-R-BO"
  },
  {
    "code": "CI-DEP-TEHINI",
    "name": "Téhini",
    "level": "department",
    "parentCode": "CI-R-BO"
  },
  {
    "code": "CI-BD",
    "name": "Bondoukou",
    "level": "department",
    "parentCode": "CI-R-GOU"
  },
  {
    "code": "CI-DEP-KOUNFAO",
    "name": "Koun-Fao",
    "level": "department",
    "parentCode": "CI-R-GOU"
  },
  {
    "code": "CI-DEP-TANDA",
    "name": "Tanda",
    "level": "department",
    "parentCode": "CI-R-GOU"
  },
  {
    "code": "CI-DEP-TRANSUA",
    "name": "Transua",
    "level": "department",
    "parentCode": "CI-R-GOU"
  },
  {
    "code": "CI-BG",
    "name": "Bingerville",
    "level": "department",
    "parentCode": "CI-R-AB"
  },
  {
    "code": "CI-DEP-ANYAMA",
    "name": "Anyama",
    "level": "department",
    "parentCode": "CI-R-AB"
  },
  {
    "code": "CI-DEP-SONGON",
    "name": "Songon",
    "level": "department",
    "parentCode": "CI-R-AB"
  },
  {
    "code": "CI-DEP-BROBO",
    "name": "Brobo",
    "level": "department",
    "parentCode": "CI-R-GB"
  },
  {
    "code": "CI-DEP-KOUASSID",
    "name": "Kouassi-Datékro",
    "level": "department",
    "parentCode": "CI-R-IN"
  }
];
