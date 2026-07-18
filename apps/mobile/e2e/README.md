# Tests E2E Detox — `@fermier/mobile`

Suite Detox exécutée **en local** (jamais en CI par PR — coût et flakiness des
émulateurs). Deux familles de specs :

- **Marchand** (`merchant*.e2e.ts`, `marketplaceListings.e2e.ts`, `submenuTabs.e2e.ts`)
- **Producteur** (`producerCoreGestures`, `producerOnboarding`, `offlineQueue`)

## Prérequis

1. Build Detox à jour : `npm run e2e:build:ios` (ou `e2e:build:android`).
2. API (`npm run dev:api`) + Metro (`npm run dev:mobile`) démarrés.
3. Session **producteur authentifiée** avec au moins un animal actif et une
   bande (les specs producteur ne gèrent pas le login — comme les specs
   marchandes existantes).

## Suite fumée producteur — à exécuter avant chaque release OTA / store

Rituel de pré-release : valider les 3 parcours producteur critiques.

```bash
# iOS
npm run test:e2e:producer

# Android
npm run test:e2e:producer:android
```

Couvre :

| Spec | Parcours |
|------|----------|
| `producerCoreGestures.e2e.ts` | Accueil → FAB → Pesée (sujet + saisie + confirmation avec insight) → FAB → Vendre → « vente déjà conclue » → formulaire pré-réglé `kind=sale` |
| `producerOnboarding.e2e.ts` | Bannière onboarding + reprise du parcours (voir note P-39 ci-dessous) |
| `offlineQueue.e2e.ts` | Coupure réseau → pesée en file (badge « en attente ») → réseau rétabli → synchro → donnée présente |

### Notes

- **P-39 non mergé** : `producerOnboarding.e2e.ts` vérifie le parcours ACTUEL
  (bannière `onboarding-banner` + OnboardingScreen 4 étapes), pas le flux guidé
  « ferme + animal + première pesée » décrit dans P-39. À réaligner si P-39
  arrive.
- **Simulation offline** : `offlineQueue.e2e.ts` utilise `device.setURLBlacklist`
  (API native Detox) faute de helper d'interception réseau. NetInfo reste « en
  ligne » ; c'est l'échec réseau qui déclenche la mise en file. À vérifier
  visuellement sur device réel en mode avion si le résultat automatisé est
  incertain.

## Autres suites

```bash
npm run test:e2e:merchant           # 3 specs marchandes (iOS)
npm run test:e2e:merchant:android
```
