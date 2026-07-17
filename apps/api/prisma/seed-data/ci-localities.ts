/** Gazetteer localités → départements (chefs-lieux + principales villes).
 * Couverture initiale : ~chefs-lieux + grandes villes/sous-préfectures.
 * À compléter progressivement (sous-préfectures manquantes).
 */
export type LocalitySeed = {
  id: string;
  nameNormalized: string;
  displayName: string;
  departmentCode: string;
  latitude: number | null;
  longitude: number | null;
};

export const CI_LOCALITIES: LocalitySeed[] = [
  {
    "id": "loc_abidjan_ci-ab",
    "nameNormalized": "abidjan",
    "displayName": "Abidjan",
    "departmentCode": "CI-AB",
    "latitude": 5.36,
    "longitude": -4.0083
  },
  {
    "id": "loc_yamoussoukro_ci-ym",
    "nameNormalized": "yamoussoukro",
    "displayName": "Yamoussoukro",
    "departmentCode": "CI-YM",
    "latitude": 6.8276,
    "longitude": -5.2893
  },
  {
    "id": "loc_bouake_ci-bk",
    "nameNormalized": "bouake",
    "displayName": "Bouaké",
    "departmentCode": "CI-BK",
    "latitude": 7.69,
    "longitude": -5.03
  },
  {
    "id": "loc_beoumi_ci-dep-beoumi",
    "nameNormalized": "beoumi",
    "displayName": "Béoumi",
    "departmentCode": "CI-DEP-BEOUMI",
    "latitude": 7.67,
    "longitude": -5.58
  },
  {
    "id": "loc_botro_ci-dep-botro",
    "nameNormalized": "botro",
    "displayName": "Botro",
    "departmentCode": "CI-DEP-BOTRO",
    "latitude": 7.85,
    "longitude": -5.31
  },
  {
    "id": "loc_sakassou_ci-dep-sakassou",
    "nameNormalized": "sakassou",
    "displayName": "Sakassou",
    "departmentCode": "CI-DEP-SAKASSOU",
    "latitude": 7.45,
    "longitude": -5.29
  },
  {
    "id": "loc_katiola_ci-dep-katiola",
    "nameNormalized": "katiola",
    "displayName": "Katiola",
    "departmentCode": "CI-DEP-KATIOLA",
    "latitude": 8.14,
    "longitude": -5.1
  },
  {
    "id": "loc_dabakala_ci-dep-dabakala",
    "nameNormalized": "dabakala",
    "displayName": "Dabakala",
    "departmentCode": "CI-DEP-DABAKALA",
    "latitude": 8.36,
    "longitude": -4.43
  },
  {
    "id": "loc_niakaramandougou_ci-dep-niakaram",
    "nameNormalized": "niakaramandougou",
    "displayName": "Niakaramandougou",
    "departmentCode": "CI-DEP-NIAKARAM",
    "latitude": 8.66,
    "longitude": -5.29
  },
  {
    "id": "loc_toumodi_ci-dep-toumodi",
    "nameNormalized": "toumodi",
    "displayName": "Toumodi",
    "departmentCode": "CI-DEP-TOUMODI",
    "latitude": 6.55,
    "longitude": -5.02
  },
  {
    "id": "loc_didievi_ci-dep-didievi",
    "nameNormalized": "didievi",
    "displayName": "Didiévi",
    "departmentCode": "CI-DEP-DIDIEVI",
    "latitude": 7.13,
    "longitude": -4.9
  },
  {
    "id": "loc_tiebissou_ci-dep-tiebisso",
    "nameNormalized": "tiebissou",
    "displayName": "Tiébissou",
    "departmentCode": "CI-DEP-TIEBISSO",
    "latitude": 7.16,
    "longitude": -5.23
  },
  {
    "id": "loc_daoukro_ci-dep-daoukro",
    "nameNormalized": "daoukro",
    "displayName": "Daoukro",
    "departmentCode": "CI-DEP-DAOUKRO",
    "latitude": 7.06,
    "longitude": -3.96
  },
  {
    "id": "loc_m-bahiakro_ci-dep-mbahiakr",
    "nameNormalized": "m'bahiakro",
    "displayName": "M'Bahiakro",
    "departmentCode": "CI-DEP-MBAHIAKR",
    "latitude": 7.46,
    "longitude": -4.34
  },
  {
    "id": "loc_prikro_ci-dep-prikro",
    "nameNormalized": "prikro",
    "displayName": "Prikro",
    "departmentCode": "CI-DEP-PRIKRO",
    "latitude": 7.65,
    "longitude": -3.98
  },
  {
    "id": "loc_bongouanou_ci-dep-bongouan",
    "nameNormalized": "bongouanou",
    "displayName": "Bongouanou",
    "departmentCode": "CI-DEP-BONGOUAN",
    "latitude": 6.65,
    "longitude": -4.2
  },
  {
    "id": "loc_arrah_ci-dep-arrah",
    "nameNormalized": "arrah",
    "displayName": "Arrah",
    "departmentCode": "CI-DEP-ARRAH",
    "latitude": 6.67,
    "longitude": -3.97
  },
  {
    "id": "loc_m-batto_ci-dep-mbatto",
    "nameNormalized": "m'batto",
    "displayName": "M'Batto",
    "departmentCode": "CI-DEP-MBATTO",
    "latitude": 6.47,
    "longitude": -4.37
  },
  {
    "id": "loc_dimbokro_ci-dep-dimbokro",
    "nameNormalized": "dimbokro",
    "displayName": "Dimbokro",
    "departmentCode": "CI-DEP-DIMBOKRO",
    "latitude": 6.65,
    "longitude": -4.7
  },
  {
    "id": "loc_bocanda_ci-dep-bocanda",
    "nameNormalized": "bocanda",
    "displayName": "Bocanda",
    "departmentCode": "CI-DEP-BOCANDA",
    "latitude": 7.06,
    "longitude": -4.5
  },
  {
    "id": "loc_kouassi-kouassikro_ci-dep-kouassik",
    "nameNormalized": "kouassi-kouassikro",
    "displayName": "Kouassi-Kouassikro",
    "departmentCode": "CI-DEP-KOUASSIK",
    "latitude": 7.3,
    "longitude": -4.2
  },
  {
    "id": "loc_agboville_ci-dep-agbovill",
    "nameNormalized": "agboville",
    "displayName": "Agboville",
    "departmentCode": "CI-DEP-AGBOVILL",
    "latitude": 5.93,
    "longitude": -4.22
  },
  {
    "id": "loc_tiassale_ci-dep-tiassale",
    "nameNormalized": "tiassale",
    "displayName": "Tiassalé",
    "departmentCode": "CI-DEP-TIASSALE",
    "latitude": 5.9,
    "longitude": -4.83
  },
  {
    "id": "loc_sikensi_ci-dep-sikensi",
    "nameNormalized": "sikensi",
    "displayName": "Sikensi",
    "departmentCode": "CI-DEP-SIKENSI",
    "latitude": 5.67,
    "longitude": -4.57
  },
  {
    "id": "loc_taabo_ci-dep-taabo",
    "nameNormalized": "taabo",
    "displayName": "Taabo",
    "departmentCode": "CI-DEP-TAABO",
    "latitude": 6.23,
    "longitude": -5.13
  },
  {
    "id": "loc_dabou_ci-dep-dabou",
    "nameNormalized": "dabou",
    "displayName": "Dabou",
    "departmentCode": "CI-DEP-DABOU",
    "latitude": 5.33,
    "longitude": -4.38
  },
  {
    "id": "loc_grand-lahou_ci-dep-grandlah",
    "nameNormalized": "grand-lahou",
    "displayName": "Grand-Lahou",
    "departmentCode": "CI-DEP-GRANDLAH",
    "latitude": 5.14,
    "longitude": -5.02
  },
  {
    "id": "loc_jacqueville_ci-dep-jacquevi",
    "nameNormalized": "jacqueville",
    "displayName": "Jacqueville",
    "departmentCode": "CI-DEP-JACQUEVI",
    "latitude": 5.21,
    "longitude": -4.42
  },
  {
    "id": "loc_adzope_ci-dep-adzope",
    "nameNormalized": "adzope",
    "displayName": "Adzopé",
    "departmentCode": "CI-DEP-ADZOPE",
    "latitude": 6.11,
    "longitude": -3.86
  },
  {
    "id": "loc_akoupe_ci-dep-akoupe",
    "nameNormalized": "akoupe",
    "displayName": "Akoupé",
    "departmentCode": "CI-DEP-AKOUPE",
    "latitude": 6.38,
    "longitude": -3.9
  },
  {
    "id": "loc_yakasse-attobrou_ci-dep-yakassea",
    "nameNormalized": "yakasse-attobrou",
    "displayName": "Yakassé-Attobrou",
    "departmentCode": "CI-DEP-YAKASSEA",
    "latitude": 6.18,
    "longitude": -3.65
  },
  {
    "id": "loc_aboisso_ci-dep-aboisso",
    "nameNormalized": "aboisso",
    "displayName": "Aboisso",
    "departmentCode": "CI-DEP-ABOISSO",
    "latitude": 5.47,
    "longitude": -3.2
  },
  {
    "id": "loc_adiake_ci-dep-adiake",
    "nameNormalized": "adiake",
    "displayName": "Adiaké",
    "departmentCode": "CI-DEP-ADIAKE",
    "latitude": 5.29,
    "longitude": -3.3
  },
  {
    "id": "loc_grand-bassam_ci-dep-grandbas",
    "nameNormalized": "grand-bassam",
    "displayName": "Grand-Bassam",
    "departmentCode": "CI-DEP-GRANDBAS",
    "latitude": 5.21,
    "longitude": -3.74
  },
  {
    "id": "loc_tiapoum_ci-dep-tiapoum",
    "nameNormalized": "tiapoum",
    "displayName": "Tiapoum",
    "departmentCode": "CI-DEP-TIAPOUM",
    "latitude": 5.15,
    "longitude": -3.02
  },
  {
    "id": "loc_abengourou_ci-ae",
    "nameNormalized": "abengourou",
    "displayName": "Abengourou",
    "departmentCode": "CI-AE",
    "latitude": 6.73,
    "longitude": -3.5
  },
  {
    "id": "loc_agnibilekrou_ci-dep-agnibile",
    "nameNormalized": "agnibilekrou",
    "displayName": "Agnibilékrou",
    "departmentCode": "CI-DEP-AGNIBILE",
    "latitude": 7.13,
    "longitude": -3.2
  },
  {
    "id": "loc_bettie_ci-dep-bettie",
    "nameNormalized": "bettie",
    "displayName": "Bettié",
    "departmentCode": "CI-DEP-BETTIE",
    "latitude": 6.07,
    "longitude": -3.4
  },
  {
    "id": "loc_gagnoa_ci-gg",
    "nameNormalized": "gagnoa",
    "displayName": "Gagnoa",
    "departmentCode": "CI-GG",
    "latitude": 6.13,
    "longitude": -5.95
  },
  {
    "id": "loc_oume_ci-dep-oume",
    "nameNormalized": "oume",
    "displayName": "Oumé",
    "departmentCode": "CI-DEP-OUME",
    "latitude": 6.38,
    "longitude": -5.42
  },
  {
    "id": "loc_divo_ci-dv",
    "nameNormalized": "divo",
    "displayName": "Divo",
    "departmentCode": "CI-DV",
    "latitude": 5.84,
    "longitude": -5.36
  },
  {
    "id": "loc_guitry_ci-dep-guitry",
    "nameNormalized": "guitry",
    "displayName": "Guitry",
    "departmentCode": "CI-DEP-GUITRY",
    "latitude": 5.52,
    "longitude": -5.25
  },
  {
    "id": "loc_lakota_ci-dep-lakota",
    "nameNormalized": "lakota",
    "displayName": "Lakota",
    "departmentCode": "CI-DEP-LAKOTA",
    "latitude": 5.85,
    "longitude": -5.68
  },
  {
    "id": "loc_soubre_ci-sb",
    "nameNormalized": "soubre",
    "displayName": "Soubré",
    "departmentCode": "CI-SB",
    "latitude": 5.79,
    "longitude": -6.59
  },
  {
    "id": "loc_buyo_ci-dep-buyo",
    "nameNormalized": "buyo",
    "displayName": "Buyo",
    "departmentCode": "CI-DEP-BUYO",
    "latitude": 6.24,
    "longitude": -7
  },
  {
    "id": "loc_gueyo_ci-dep-gueyo",
    "nameNormalized": "gueyo",
    "displayName": "Guéyo",
    "departmentCode": "CI-DEP-GUEYO",
    "latitude": 5.5,
    "longitude": -6.1
  },
  {
    "id": "loc_meagui_ci-dep-meagui",
    "nameNormalized": "meagui",
    "displayName": "Méagui",
    "departmentCode": "CI-DEP-MEAGUI",
    "latitude": 5.4,
    "longitude": -6.55
  },
  {
    "id": "loc_san-pedro_ci-sp",
    "nameNormalized": "san-pedro",
    "displayName": "San-Pédro",
    "departmentCode": "CI-SP",
    "latitude": 4.75,
    "longitude": -6.64
  },
  {
    "id": "loc_tabou_ci-dep-tabou",
    "nameNormalized": "tabou",
    "displayName": "Tabou",
    "departmentCode": "CI-DEP-TABOU",
    "latitude": 4.42,
    "longitude": -7.35
  },
  {
    "id": "loc_sassandra_ci-dep-sassandr",
    "nameNormalized": "sassandra",
    "displayName": "Sassandra",
    "departmentCode": "CI-DEP-SASSANDR",
    "latitude": 4.95,
    "longitude": -6.08
  },
  {
    "id": "loc_fresco_ci-dep-fresco",
    "nameNormalized": "fresco",
    "displayName": "Fresco",
    "departmentCode": "CI-DEP-FRESCO",
    "latitude": 5.08,
    "longitude": -5.57
  },
  {
    "id": "loc_daloa_ci-dl",
    "nameNormalized": "daloa",
    "displayName": "Daloa",
    "departmentCode": "CI-DL",
    "latitude": 6.88,
    "longitude": -6.45
  },
  {
    "id": "loc_issia_ci-dep-issia",
    "nameNormalized": "issia",
    "displayName": "Issia",
    "departmentCode": "CI-DEP-ISSIA",
    "latitude": 6.49,
    "longitude": -6.59
  },
  {
    "id": "loc_vavoua_ci-dep-vavoua",
    "nameNormalized": "vavoua",
    "displayName": "Vavoua",
    "departmentCode": "CI-DEP-VAVOUA",
    "latitude": 7.38,
    "longitude": -6.48
  },
  {
    "id": "loc_zoukougbeu_ci-dep-zoukougb",
    "nameNormalized": "zoukougbeu",
    "displayName": "Zoukougbeu",
    "departmentCode": "CI-DEP-ZOUKOUGB",
    "latitude": 6.77,
    "longitude": -6.87
  },
  {
    "id": "loc_bouafle_ci-dep-bouafle",
    "nameNormalized": "bouafle",
    "displayName": "Bouaflé",
    "departmentCode": "CI-DEP-BOUAFLE",
    "latitude": 6.99,
    "longitude": -5.75
  },
  {
    "id": "loc_sinfra_ci-dep-sinfra",
    "nameNormalized": "sinfra",
    "displayName": "Sinfra",
    "departmentCode": "CI-DEP-SINFRA",
    "latitude": 6.62,
    "longitude": -5.91
  },
  {
    "id": "loc_zuenoula_ci-dep-zuenoula",
    "nameNormalized": "zuenoula",
    "displayName": "Zuénoula",
    "departmentCode": "CI-DEP-ZUENOULA",
    "latitude": 7.43,
    "longitude": -6.05
  },
  {
    "id": "loc_man_ci-mn",
    "nameNormalized": "man",
    "displayName": "Man",
    "departmentCode": "CI-MN",
    "latitude": 7.41,
    "longitude": -7.55
  },
  {
    "id": "loc_biankouma_ci-dep-biankoum",
    "nameNormalized": "biankouma",
    "displayName": "Biankouma",
    "departmentCode": "CI-DEP-BIANKOUM",
    "latitude": 7.74,
    "longitude": -7.61
  },
  {
    "id": "loc_danane_ci-dep-danane",
    "nameNormalized": "danane",
    "displayName": "Danané",
    "departmentCode": "CI-DEP-DANANE",
    "latitude": 7.26,
    "longitude": -8.15
  },
  {
    "id": "loc_zouan-hounien_ci-dep-zouanhou",
    "nameNormalized": "zouan-hounien",
    "displayName": "Zouan-Hounien",
    "departmentCode": "CI-DEP-ZOUANHOU",
    "latitude": 6.92,
    "longitude": -8.21
  },
  {
    "id": "loc_duekoue_ci-dep-duekoue",
    "nameNormalized": "duekoue",
    "displayName": "Duékoué",
    "departmentCode": "CI-DEP-DUEKOUE",
    "latitude": 6.74,
    "longitude": -7.35
  },
  {
    "id": "loc_bangolo_ci-dep-bangolo",
    "nameNormalized": "bangolo",
    "displayName": "Bangolo",
    "departmentCode": "CI-DEP-BANGOLO",
    "latitude": 7.01,
    "longitude": -7.49
  },
  {
    "id": "loc_facobly_ci-dep-facobly",
    "nameNormalized": "facobly",
    "displayName": "Facobly",
    "departmentCode": "CI-DEP-FACOBLY",
    "latitude": 7.38,
    "longitude": -7.38
  },
  {
    "id": "loc_kouibly_ci-dep-kouibly",
    "nameNormalized": "kouibly",
    "displayName": "Kouibly",
    "departmentCode": "CI-DEP-KOUIBLY",
    "latitude": 7.25,
    "longitude": -7.23
  },
  {
    "id": "loc_guiglo_ci-dep-guiglo",
    "nameNormalized": "guiglo",
    "displayName": "Guiglo",
    "departmentCode": "CI-DEP-GUIGLO",
    "latitude": 6.54,
    "longitude": -7.49
  },
  {
    "id": "loc_blolequin_ci-dep-blolequi",
    "nameNormalized": "blolequin",
    "displayName": "Bloléquin",
    "departmentCode": "CI-DEP-BLOLEQUI",
    "latitude": 6.57,
    "longitude": -8
  },
  {
    "id": "loc_toulepleu_ci-dep-touleple",
    "nameNormalized": "toulepleu",
    "displayName": "Toulépleu",
    "departmentCode": "CI-DEP-TOULEPLE",
    "latitude": 6.58,
    "longitude": -8.42
  },
  {
    "id": "loc_boundiali_ci-bn",
    "nameNormalized": "boundiali",
    "displayName": "Boundiali",
    "departmentCode": "CI-BN",
    "latitude": 9.25,
    "longitude": -6.48
  },
  {
    "id": "loc_tengrela_ci-dep-tengrela",
    "nameNormalized": "tengrela",
    "displayName": "Tengréla",
    "departmentCode": "CI-DEP-TENGRELA",
    "latitude": 10.49,
    "longitude": -6.41
  },
  {
    "id": "loc_kouto_ci-dep-kouto",
    "nameNormalized": "kouto",
    "displayName": "Kouto",
    "departmentCode": "CI-DEP-KOUTO",
    "latitude": 9.9,
    "longitude": -6.41
  },
  {
    "id": "loc_korhogo_ci-ko",
    "nameNormalized": "korhogo",
    "displayName": "Korhogo",
    "departmentCode": "CI-KO",
    "latitude": 9.46,
    "longitude": -5.63
  },
  {
    "id": "loc_dikodougou_ci-dep-dikodoug",
    "nameNormalized": "dikodougou",
    "displayName": "Dikodougou",
    "departmentCode": "CI-DEP-DIKODOUG",
    "latitude": 9.07,
    "longitude": -5.77
  },
  {
    "id": "loc_m-bengue_ci-dep-mbengue",
    "nameNormalized": "m'bengue",
    "displayName": "M'Bengué",
    "departmentCode": "CI-DEP-MBENGUE",
    "latitude": 10,
    "longitude": -5.9
  },
  {
    "id": "loc_sinematiali_ci-dep-sinemati",
    "nameNormalized": "sinematiali",
    "displayName": "Sinématiali",
    "departmentCode": "CI-DEP-SINEMATI",
    "latitude": 9.58,
    "longitude": -5.39
  },
  {
    "id": "loc_ferkessedougou_ci-fk",
    "nameNormalized": "ferkessedougou",
    "displayName": "Ferkessédougou",
    "departmentCode": "CI-FK",
    "latitude": 9.59,
    "longitude": -5.2
  },
  {
    "id": "loc_kong_ci-dep-kong",
    "nameNormalized": "kong",
    "displayName": "Kong",
    "departmentCode": "CI-DEP-KONG",
    "latitude": 9.15,
    "longitude": -4.61
  },
  {
    "id": "loc_ouangolodougou_ci-dep-ouangolo",
    "nameNormalized": "ouangolodougou",
    "displayName": "Ouangolodougou",
    "departmentCode": "CI-DEP-OUANGOLO",
    "latitude": 9.97,
    "longitude": -5.1
  },
  {
    "id": "loc_minignan_ci-dep-minignan",
    "nameNormalized": "minignan",
    "displayName": "Minignan",
    "departmentCode": "CI-DEP-MINIGNAN",
    "latitude": 9.98,
    "longitude": -7.84
  },
  {
    "id": "loc_kaniasso_ci-dep-kaniasso",
    "nameNormalized": "kaniasso",
    "displayName": "Kaniasso",
    "departmentCode": "CI-DEP-KANIASSO",
    "latitude": 9.8,
    "longitude": -7.55
  },
  {
    "id": "loc_odienne_ci-od",
    "nameNormalized": "odienne",
    "displayName": "Odienné",
    "departmentCode": "CI-OD",
    "latitude": 9.51,
    "longitude": -7.56
  },
  {
    "id": "loc_madinani_ci-dep-madinani",
    "nameNormalized": "madinani",
    "displayName": "Madinani",
    "departmentCode": "CI-DEP-MADINANI",
    "latitude": 9.6,
    "longitude": -6.94
  },
  {
    "id": "loc_samatiguila_ci-dep-samatigu",
    "nameNormalized": "samatiguila",
    "displayName": "Samatiguila",
    "departmentCode": "CI-DEP-SAMATIGU",
    "latitude": 9.82,
    "longitude": -7.58
  },
  {
    "id": "loc_seguelon_ci-dep-seguelon",
    "nameNormalized": "seguelon",
    "displayName": "Séguélon",
    "departmentCode": "CI-DEP-SEGUELON",
    "latitude": 9.3,
    "longitude": -7.2
  },
  {
    "id": "loc_mankono_ci-dep-mankono",
    "nameNormalized": "mankono",
    "displayName": "Mankono",
    "departmentCode": "CI-DEP-MANKONO",
    "latitude": 8.06,
    "longitude": -6.19
  },
  {
    "id": "loc_kounahiri_ci-dep-kounahir",
    "nameNormalized": "kounahiri",
    "displayName": "Kounahiri",
    "departmentCode": "CI-DEP-KOUNAHIR",
    "latitude": 7.8,
    "longitude": -5.9
  },
  {
    "id": "loc_dianra_ci-dep-dianra",
    "nameNormalized": "dianra",
    "displayName": "Dianra",
    "departmentCode": "CI-DEP-DIANRA",
    "latitude": 8.3,
    "longitude": -6.5
  },
  {
    "id": "loc_touba_ci-dep-touba",
    "nameNormalized": "touba",
    "displayName": "Touba",
    "departmentCode": "CI-DEP-TOUBA",
    "latitude": 8.28,
    "longitude": -7.68
  },
  {
    "id": "loc_koro_ci-dep-koro",
    "nameNormalized": "koro",
    "displayName": "Koro",
    "departmentCode": "CI-DEP-KORO",
    "latitude": 8.55,
    "longitude": -7.4
  },
  {
    "id": "loc_ouaninou_ci-dep-ouaninou",
    "nameNormalized": "ouaninou",
    "displayName": "Ouaninou",
    "departmentCode": "CI-DEP-OUANINOU",
    "latitude": 8.1,
    "longitude": -7.9
  },
  {
    "id": "loc_seguela_ci-dep-seguela",
    "nameNormalized": "seguela",
    "displayName": "Séguéla",
    "departmentCode": "CI-DEP-SEGUELA",
    "latitude": 7.96,
    "longitude": -6.67
  },
  {
    "id": "loc_kani_ci-dep-kani",
    "nameNormalized": "kani",
    "displayName": "Kani",
    "departmentCode": "CI-DEP-KANI",
    "latitude": 8.48,
    "longitude": -6.6
  },
  {
    "id": "loc_bouna_ci-dep-bouna",
    "nameNormalized": "bouna",
    "displayName": "Bouna",
    "departmentCode": "CI-DEP-BOUNA",
    "latitude": 9.27,
    "longitude": -3
  },
  {
    "id": "loc_doropo_ci-dep-doropo",
    "nameNormalized": "doropo",
    "displayName": "Doropo",
    "departmentCode": "CI-DEP-DOROPO",
    "latitude": 9.8,
    "longitude": -3.35
  },
  {
    "id": "loc_nassian_ci-dep-nassian",
    "nameNormalized": "nassian",
    "displayName": "Nassian",
    "departmentCode": "CI-DEP-NASSIAN",
    "latitude": 8.85,
    "longitude": -3.2
  },
  {
    "id": "loc_tehini_ci-dep-tehini",
    "nameNormalized": "tehini",
    "displayName": "Téhini",
    "departmentCode": "CI-DEP-TEHINI",
    "latitude": 9.6,
    "longitude": -3.7
  },
  {
    "id": "loc_bondoukou_ci-bd",
    "nameNormalized": "bondoukou",
    "displayName": "Bondoukou",
    "departmentCode": "CI-BD",
    "latitude": 8.04,
    "longitude": -2.8
  },
  {
    "id": "loc_koun-fao_ci-dep-kounfao",
    "nameNormalized": "koun-fao",
    "displayName": "Koun-Fao",
    "departmentCode": "CI-DEP-KOUNFAO",
    "latitude": 7.5,
    "longitude": -3.2
  },
  {
    "id": "loc_tanda_ci-dep-tanda",
    "nameNormalized": "tanda",
    "displayName": "Tanda",
    "departmentCode": "CI-DEP-TANDA",
    "latitude": 7.8,
    "longitude": -3.17
  },
  {
    "id": "loc_transua_ci-dep-transua",
    "nameNormalized": "transua",
    "displayName": "Transua",
    "departmentCode": "CI-DEP-TRANSUA",
    "latitude": 7.55,
    "longitude": -3
  },
  {
    "id": "loc_bingerville_ci-bg",
    "nameNormalized": "bingerville",
    "displayName": "Bingerville",
    "departmentCode": "CI-BG",
    "latitude": 5.3556,
    "longitude": -3.8853
  },
  {
    "id": "loc_anyama_ci-dep-anyama",
    "nameNormalized": "anyama",
    "displayName": "Anyama",
    "departmentCode": "CI-DEP-ANYAMA",
    "latitude": 5.4947,
    "longitude": -4.0519
  },
  {
    "id": "loc_songon_ci-dep-songon",
    "nameNormalized": "songon",
    "displayName": "Songon",
    "departmentCode": "CI-DEP-SONGON",
    "latitude": 5.3197,
    "longitude": -4.2542
  },
  {
    "id": "loc_brobo_ci-dep-brobo",
    "nameNormalized": "brobo",
    "displayName": "Brobo",
    "departmentCode": "CI-DEP-BROBO",
    "latitude": 7.64,
    "longitude": -4.82
  },
  {
    "id": "loc_kouassi-datekro_ci-dep-kouassid",
    "nameNormalized": "kouassi-datekro",
    "displayName": "Kouassi-Datékro",
    "departmentCode": "CI-DEP-KOUASSID",
    "latitude": 7,
    "longitude": -3.5
  },
  {
    "id": "loc_cocody_ci-ab",
    "nameNormalized": "cocody",
    "displayName": "Cocody",
    "departmentCode": "CI-AB",
    "latitude": 5.35,
    "longitude": -3.986
  },
  {
    "id": "loc_yopougon_ci-ab",
    "nameNormalized": "yopougon",
    "displayName": "Yopougon",
    "departmentCode": "CI-AB",
    "latitude": 5.336,
    "longitude": -4.08
  },
  {
    "id": "loc_marcory_ci-ab",
    "nameNormalized": "marcory",
    "displayName": "Marcory",
    "departmentCode": "CI-AB",
    "latitude": 5.3,
    "longitude": -3.98
  },
  {
    "id": "loc_treichville_ci-ab",
    "nameNormalized": "treichville",
    "displayName": "Treichville",
    "departmentCode": "CI-AB",
    "latitude": 5.3,
    "longitude": -4.01
  },
  {
    "id": "loc_port-bouet_ci-ab",
    "nameNormalized": "port-bouet",
    "displayName": "Port-Bouët",
    "departmentCode": "CI-AB",
    "latitude": 5.25,
    "longitude": -3.92
  },
  {
    "id": "loc_koumassi_ci-ab",
    "nameNormalized": "koumassi",
    "displayName": "Koumassi",
    "departmentCode": "CI-AB",
    "latitude": 5.29,
    "longitude": -3.95
  },
  {
    "id": "loc_abobo_ci-ab",
    "nameNormalized": "abobo",
    "displayName": "Abobo",
    "departmentCode": "CI-AB",
    "latitude": 5.42,
    "longitude": -4.02
  },
  {
    "id": "loc_attecoube_ci-ab",
    "nameNormalized": "attecoube",
    "displayName": "Attécoubé",
    "departmentCode": "CI-AB",
    "latitude": 5.34,
    "longitude": -4.04
  },
  {
    "id": "loc_plateau_ci-ab",
    "nameNormalized": "plateau",
    "displayName": "Plateau",
    "departmentCode": "CI-AB",
    "latitude": 5.32,
    "longitude": -4.02
  },
  {
    "id": "loc_adjame_ci-ab",
    "nameNormalized": "adjame",
    "displayName": "Adjamé",
    "departmentCode": "CI-AB",
    "latitude": 5.35,
    "longitude": -4.03
  },
  {
    "id": "loc_anyama_ci-ab",
    "nameNormalized": "anyama",
    "displayName": "Anyama",
    "departmentCode": "CI-AB",
    "latitude": 5.4947,
    "longitude": -4.0519
  },
  {
    "id": "loc_songon_ci-ab",
    "nameNormalized": "songon",
    "displayName": "Songon",
    "departmentCode": "CI-AB",
    "latitude": 5.3197,
    "longitude": -4.2542
  },
  {
    "id": "loc_assinie_ci-dep-adiake",
    "nameNormalized": "assinie",
    "displayName": "Assinie",
    "departmentCode": "CI-DEP-ADIAKE",
    "latitude": 5.13,
    "longitude": -3.28
  },
  {
    "id": "loc_bonoua_ci-dep-grandlah",
    "nameNormalized": "bonoua",
    "displayName": "Bonoua",
    "departmentCode": "CI-DEP-GRANDLAH",
    "latitude": 5.27,
    "longitude": -3.6
  },
  {
    "id": "loc_alepe_ci-dep-adzope",
    "nameNormalized": "alepe",
    "displayName": "Alepe",
    "departmentCode": "CI-DEP-ADZOPE",
    "latitude": 5.5,
    "longitude": -3.66
  },
  {
    "id": "loc_affery_ci-dep-adzope",
    "nameNormalized": "affery",
    "displayName": "Afféry",
    "departmentCode": "CI-DEP-ADZOPE",
    "latitude": 6.32,
    "longitude": -3.82
  },
  {
    "id": "loc_ferke_ci-fk",
    "nameNormalized": "ferke",
    "displayName": "Ferké",
    "departmentCode": "CI-FK",
    "latitude": 9.59,
    "longitude": -5.2
  },
  {
    "id": "loc_san-pedro_ci-sp",
    "nameNormalized": "san pedro",
    "displayName": "San Pedro",
    "departmentCode": "CI-SP",
    "latitude": 4.75,
    "longitude": -6.64
  },
  {
    "id": "loc_grand-lahou_ci-dep-grandlah",
    "nameNormalized": "grand lahou",
    "displayName": "Grand Lahou",
    "departmentCode": "CI-DEP-GRANDLAH",
    "latitude": 5.14,
    "longitude": -5.02
  },
  {
    "id": "loc_guiberoua_ci-gg",
    "nameNormalized": "guiberoua",
    "displayName": "Guibéroua",
    "departmentCode": "CI-GG",
    "latitude": 6.23,
    "longitude": -6.17
  },
  {
    "id": "loc_ouragahio_ci-gg",
    "nameNormalized": "ouragahio",
    "displayName": "Ouragahio",
    "departmentCode": "CI-GG",
    "latitude": 6.3,
    "longitude": -5.95
  },
  {
    "id": "loc_bouake-sud_ci-bk",
    "nameNormalized": "bouake sud",
    "displayName": "Bouaké Sud",
    "departmentCode": "CI-BK",
    "latitude": 7.65,
    "longitude": -5.03
  },
  {
    "id": "loc_n-douci_ci-dep-tiassale",
    "nameNormalized": "n'douci",
    "displayName": "N'Douci",
    "departmentCode": "CI-DEP-TIASSALE",
    "latitude": 5.87,
    "longitude": -4.75
  },
  {
    "id": "loc_azaguie_ci-dep-agbovill",
    "nameNormalized": "azaguie",
    "displayName": "Azaguié",
    "departmentCode": "CI-DEP-AGBOVILL",
    "latitude": 5.63,
    "longitude": -4.08
  },
  {
    "id": "loc_rubino_ci-dep-agbovill",
    "nameNormalized": "rubino",
    "displayName": "Rubino",
    "departmentCode": "CI-DEP-AGBOVILL",
    "latitude": 6.07,
    "longitude": -4.3
  },
  {
    "id": "loc_cechi_ci-dep-agbovill",
    "nameNormalized": "cechi",
    "displayName": "Céchi",
    "departmentCode": "CI-DEP-AGBOVILL",
    "latitude": 6.2,
    "longitude": -4.4
  },
  {
    "id": "loc_bako_ci-od",
    "nameNormalized": "bako",
    "displayName": "Bako",
    "departmentCode": "CI-OD",
    "latitude": 9.4,
    "longitude": -7.4
  },
  {
    "id": "loc_ouangolo_ci-dep-ouangolo",
    "nameNormalized": "ouangolo",
    "displayName": "Ouangolo",
    "departmentCode": "CI-DEP-OUANGOLO",
    "latitude": 9.97,
    "longitude": -5.1
  },
  {
    "id": "loc_niakara_ci-dep-niakaram",
    "nameNormalized": "niakara",
    "displayName": "Niakara",
    "departmentCode": "CI-DEP-NIAKARAM",
    "latitude": 8.66,
    "longitude": -5.29
  },
  {
    "id": "loc_brobo_ci-bk",
    "nameNormalized": "brobo",
    "displayName": "Brobo",
    "departmentCode": "CI-BK",
    "latitude": 7.64,
    "longitude": -4.82
  },
  {
    "id": "loc_mbahiakro_ci-dep-mbahiakr",
    "nameNormalized": "mbahiakro",
    "displayName": "Mbahiakro",
    "departmentCode": "CI-DEP-MBAHIAKR",
    "latitude": 7.46,
    "longitude": -4.34
  },
  {
    "id": "loc_mbatto_ci-dep-mbatto",
    "nameNormalized": "mbatto",
    "displayName": "Mbatto",
    "departmentCode": "CI-DEP-MBATTO",
    "latitude": 6.47,
    "longitude": -4.37
  },
  {
    "id": "loc_assouinde_ci-dep-adiake",
    "nameNormalized": "assouinde",
    "displayName": "Assouindé",
    "departmentCode": "CI-DEP-ADIAKE",
    "latitude": 5.15,
    "longitude": -3.35
  },
  {
    "id": "loc_noe_ci-dep-aboisso",
    "nameNormalized": "noe",
    "displayName": "Noé",
    "departmentCode": "CI-DEP-ABOISSO",
    "latitude": 5.3,
    "longitude": -2.8
  },
  {
    "id": "loc_ayame_ci-dep-aboisso",
    "nameNormalized": "ayame",
    "displayName": "Ayamé",
    "departmentCode": "CI-DEP-ABOISSO",
    "latitude": 5.6,
    "longitude": -3.15
  },
  {
    "id": "loc_mafere_ci-dep-aboisso",
    "nameNormalized": "mafere",
    "displayName": "Maféré",
    "departmentCode": "CI-DEP-ABOISSO",
    "latitude": 5.4,
    "longitude": -3
  },
  {
    "id": "loc_bonoua_ci-dep-grandbas",
    "nameNormalized": "bonoua",
    "displayName": "Bonoua",
    "departmentCode": "CI-DEP-GRANDBAS",
    "latitude": 5.27,
    "longitude": -3.6
  }
];

/** Indique que le gazetteer est une base à enrichir (pas exhaustif). */
export const CI_LOCALITIES_INCOMPLETE = true;
