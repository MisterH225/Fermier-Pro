# Échelles figées `mobileTheme` (cohérence visuelle)

## `mobileRadius` (5 valeurs)

| Token | Valeur | Remplace (arrondi au plus proche) |
|-------|--------|-----------------------------------|
| `sm`  | 8      | 1–9, ancien `sm` 10               |
| `md`  | 12     | 10–14, ancien `md` 14             |
| `lg`  | 16     | 15–18                             |
| `xl`  | 22     | 19–36 (cartes rôle buyer/merchant)|
| `pill`| 999    | 99, 999, cercles plein            |

Égalité de distance : on privilégie la valeur **supérieure** (ex. 10 → `md` 12, 14 → `lg` 16).

Les rayons de rôle (`vetRadius.card` 20, `buyerRadius.card` 22, etc.) restent
sur le thème du rôle ; en migration hors rôle, 20 → `mobileRadius.xl` (22).

## `mobileFontSize` (6 valeurs)

| Token | Valeur | Remplace (arrondi au plus proche) |
|-------|--------|-----------------------------------|
| `xs`  | 11     | ≤11, ancien meta 12 → `sm`        |
| `sm`  | 13     | 12–13                             |
| `md`  | 15     | 14–15                             |
| `lg`  | 17     | 16–18                             |
| `xl`  | 22     | 19–24                             |
| `xxl` | 28     | ≥25                               |

`mobileTypography` s’aligne sur cette échelle :
`meta` → `sm` 13, `body` → `md` 15, `cardTitle`/`sectionTitle` → `lg` 17,
`title` → `xl` 22.
