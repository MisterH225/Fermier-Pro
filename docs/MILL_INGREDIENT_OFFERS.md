# Offres d'intrants moulin (`MillIngredientOffer`)

## Décision marketplace : synchronisation → `MerchantProduct`

Les offres avec `isPubliclyListed=true` créent / mettent à jour un
**`MerchantProduct`** lié (`merchantProductId`).

**Pourquoi :** réutiliser le flux commande, escrow, chat et modération existants
sans nouveau circuit d'achat. Le feed marketplace expose ces produits avec
`kind: "bulk_feed"` (toujours commandables via `MerchantProduct`).

Les offres **privées** (`isPubliclyListed=false`) ne créent pas de produit
public (ou le repassent en `draft`) — elles servent uniquement la composition /
comparaison de prix (J4).

## Source unique de prix

`MillIngredientOffer.pricePerUnit` (+ `unitToKg`) est la seule saisie.
Le `MerchantProduct` synchronisé lit ces valeurs — pas de double saisie
marketplace / composition.

## API

| Route | Rôle |
|-------|------|
| `GET/POST /merchant/mill/offers` | CRUD moulin (flag `mills` + `merchantKind=mill`) |
| `GET /merchant/mill/ingredients?q=` | Recherche `FeedIngredient` (alias) |
| `GET /admin/mill/offers` | Liste superadmin |
| Modération produit | `DELETE /admin/merchant/products/:id` (inchangé) |
