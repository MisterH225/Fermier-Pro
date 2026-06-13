# Documentation : Intégration du Volet Paiement Sécurisé (Escrow) dans la Marketplace

Ce document détaille les implémentations réalisées pour intégrer le **volet paiement** (dashboard de transactions séquestre) dans l'application mobile, ainsi que les configurations locales ou variables d'environnement que votre collaborateur doit configurer.

---

## 1. Ce qui a été implémenté

Nous avons conçu et mis en place une interface de gestion des transactions financières sécurisées ("Volet Paiement"). L'architecture repose sur les API existantes de gestion des offres et de l'escrow (séquestre).

### A. Écrans et composants créés
* **`MarketplacePaymentDashboardScreen.tsx`** ([code](file:///c:/Users/ASUS/fermier_work/Fermier-Pro/apps/mobile/src/screens/marketplace/MarketplacePaymentDashboardScreen.tsx))
  * **Sélecteur de Rôle Dynamique** : Permet de basculer entre le rôle **Vendeur (Producteur)** et **Acheteur** si l'utilisateur possède les deux profils dans sa session. S'il n'en a qu'un, le sélecteur s'adapte automatiquement et n'affiche que le rôle actif.
  * **Système à 3 Onglets** :
    1. **En cours** : Affiche les transactions actives en attente de paiement, de livraison, de déclaration ou validation de poids (statuts séquestre intermédiaires).
    2. **Produits vendus / achetés** : Affiche les transactions terminées (`TRANSACTION_CLOSED`).
    3. **Historique & Négociations** : Regroupe les transactions annulées/échouées ainsi que les offres de prix actives (reçues ou envoyées) qui n'ont pas encore été converties en transactions.
  * **Tri Temporel** : Les listes dans tous les onglets sont automatiquement triées par date décroissante (les transactions et propositions les plus récentes apparaissent en premier).
  * **Navigation** : Redirection directe au clic sur une transaction vers l'écran de détail de transaction séquestre (`MarketplaceTransaction`), et sur une offre vers le détail de l'annonce (`MarketplaceListingDetail`).
  * **Esthétique & Ergonomie** : Design moderne avec indicateurs de statut colorés, prise en compte des marges de sécurité (`useBottomInset`) et gestion des états de chargement / listes vides localisées.

### B. Intégration dans la Marketplace
* **Point d'Entrée Header** : Ajout d'un bouton de portefeuille (`wallet-outline`) dans le header de `MarketplaceListScreen.tsx` ([code](file:///c:/Users/ASUS/fermier_work/Fermier-Pro/apps/mobile/src/screens/MarketplaceListScreen.tsx#L315-L330)) pour un accès direct et intuitif au dashboard de paiement.
* **Re-exportation** : Déclaration du nouvel écran dans `apps/mobile/src/features/marketplace/index.ts`.

### C. Routage & Navigation Stack
* **Typage de navigation** : Ajout de la route `MarketplacePaymentDashboard: undefined` dans `apps/mobile/src/types/navigation.ts`.
* **Stack Navigator** : Déclaration de l'écran dans le navigateur principal (`MainNavigationShell.tsx` [code](file:///c:/Users/ASUS/fermier_work/Fermier-Pro/apps/mobile/src/components/MainNavigationShell.tsx#L448-L452)) avec titre internationalisé.

### D. Internationalisation & Traductions
Ajout des clés de traduction dans le namespace `paymentsDashboard` (y compris les statuts d'offres traduits bilingues sous `paymentsDashboard.status`) :
* **Français (`apps/mobile/src/i18n/fr.ts`)** : Libellés des onglets, messages d'état vide, étiquettes vendeur/acheteur, et traduction des statuts d'offres (En attente, Acceptée, Accord crédit, etc.).
* **Anglais (`apps/mobile/src/i18n/en.ts`)** : Versions équivalentes en anglais (Pending, Accepted, Credit agreed, etc.) pour assurer le support bilingue complet.

---

## 2. Ce que votre collaborateur doit ajouter / faire en local

Puisque les fichiers `.env` et `.env.example` sont ignorés par git, votre collaborateur doit s'assurer que sa configuration locale contient les informations suivantes :

### A. Configuration du fichier `.env` (à la racine du projet)
Il doit s'assurer d'avoir ou d'ajouter ces variables d'environnement dans son `.env` local pour faire fonctionner le système avec sa base de données Supabase :

```env
# URL de connexion directe à la base de données Supabase
DATABASE_URL="postgresql://postgres.[ton-id-projet]:[ton-mot-de-pass]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# Clé de signature JWT pour valider l'authentification locale
SUPABASE_JWT_SECRET="[la-cle-jwt-supabase-recuperee-sur-le-dashboard]"

# URL du projet Supabase
SUPABASE_URL="https://[ton-id-projet].supabase.co"

# Feature Flags (Assurez-vous que la Marketplace est activée)
FEATURE_MARKETPLACE=true
```

### B. Commandes à exécuter en local
Pour initialiser et faire fonctionner le projet après avoir récupéré les modifications :

1. **Installer les dépendances** (sans exécuter de scripts racines automatiques qui échoueraient sans les variables d'environnement) :
   ```bash
   npm install --ignore-scripts
   ```
2. **Générer le client Prisma** :
   ```bash
   PRISMA_GENERATE_SKIP_AUTOINSTALL=true npm run prisma:generate
   ```
3. **Pousser la structure de la base de données** (si des tables ne sont pas à jour sur Supabase) :
   ```bash
   npm run prisma:push --workspace @fermier/api
   ```
4. **Lancer le serveur de développement API** (NestJS) :
   ```bash
   npm run dev:api
   ```
5. **Lancer l'application Mobile Expo Metro** :
   ```bash
   npm run dev:mobile
   ```

---

## 3. Liste des fichiers modifiés (Git Status)

* `apps/mobile/src/screens/marketplace/MarketplacePaymentDashboardScreen.tsx` (Nouveau)
* `apps/mobile/src/components/MainNavigationShell.tsx` (Modifié)
* `apps/mobile/src/screens/MarketplaceListScreen.tsx` (Modifié)
* `apps/mobile/src/types/navigation.ts` (Modifié)
* `apps/mobile/src/features/marketplace/index.ts` (Modifié)
* `apps/mobile/src/i18n/fr.ts` (Modifié)
* `apps/mobile/src/i18n/en.ts` (Modifié)
