# Dernière release OTA preview : 2026-07-21T01:56Z — dossier véto enrichi (vet-summary + onglets) #251
# Dernière release OTA preview : 2026-07-20T23:36Z — FAB véto + clavier params acheteur/véto #246 #247
# Dernière release OTA preview : 2026-07-20T15:37Z — nettoyage A (code mort + perf buyerMeteo) #239
# Dernière release OTA preview : 2026-07-19T10:54Z — fond photo cochon écran auth
# Dernière release OTA preview : 2026-07-19T08:30Z — migrations unitLabel/frais/CGU + refresh preview
# Dernière release OTA preview : 2026-07-17T20:47Z — archivage boutique, re-soumission produit et suivi commandes
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
