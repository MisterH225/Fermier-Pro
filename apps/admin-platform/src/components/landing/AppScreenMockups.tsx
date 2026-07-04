import { cn } from "@/lib/utils";

function StatusBar() {
  return (
    <div className="flex items-center justify-between bg-white px-4 pb-1 pt-2 text-[9px] font-semibold text-gray-800">
      <span>19:04</span>
      <div className="flex gap-1">
        <span className="size-2 rounded-full bg-gray-800" />
        <span className="h-2 w-3 rounded-sm bg-gray-800" />
      </div>
    </div>
  );
}

function BottomNav({ active = "home" }: { active?: "home" | "herd" | "health" | "market" | "finance" }) {
  const items = [
    { key: "home", label: "Accueil", icon: "⌂" },
    { key: "herd", label: "Cheptel", icon: "🐷" },
    { key: "health", label: "Santé", icon: "➕" },
    { key: "market", label: "Com", icon: "@" },
    { key: "finance", label: "Finance", icon: "💰" }
  ] as const;

  return (
    <div className="relative border-t border-gray-200 bg-white px-2 pb-2 pt-2">
      <div className="absolute inset-x-6 top-0 h-8 bg-gradient-to-r from-orange-200/40 via-pink-200/40 to-purple-200/40 blur-xl" />
      <div className="relative flex items-end justify-between text-[7px] font-semibold text-gray-500">
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "flex flex-col items-center gap-0.5",
              active === item.key && "text-[#8B5E3C] font-bold"
            )}
          >
            <span className="text-sm">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        <div className="-mt-3 flex size-9 items-center justify-center rounded-full bg-[#5C6B3A] text-lg text-white shadow-lg">
          +
        </div>
      </div>
    </div>
  );
}

export function HomeScreenMockup() {
  return (
    <div className="bg-[#f4f4f6] text-[8px] leading-tight text-gray-800">
      <StatusBar />
      <div className="space-y-2 px-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-[#5C6B3A]/15 p-1">
              <div className="size-full rounded-full bg-[#5C6B3A]" />
            </div>
            <div>
              <p className="text-[9px] font-bold">Bienvenue Harold</p>
              <p className="text-[7px] text-gray-500">Fermier Pro</p>
            </div>
          </div>
          <div className="flex gap-1.5 text-xs">
            <span className="relative">🔔<span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-red-500 text-[6px] text-white">3</span></span>
            <span>🎧</span>
            <span>⚙️</span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#1f2937] p-3 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[7px] font-bold">XOF</span>
            <span className="text-[8px]">👁</span>
          </div>
          <p className="mt-2 text-lg font-extrabold tracking-widest">••••••</p>
          <p className="mt-1 text-[7px] text-white/70">Voir le portefeuille ›</p>
          <div className="mt-3 flex rounded-xl bg-white/10 p-1">
            <span className="flex-1 rounded-lg py-1.5 text-center text-[7px] font-bold">Transférer</span>
            <span className="mx-1 flex size-6 items-center justify-center rounded-full bg-white text-[#1f2937]">+</span>
            <span className="flex-1 rounded-lg py-1.5 text-center text-[7px] font-bold">Retirer</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[8px] font-bold text-gray-700">🌾 Stock aliment</p>
          <div className="mt-2 space-y-2">
            {[
              { label: "Croissance", pct: 54, color: "#22C55E", sub: "677 kg · ~20 j" },
              { label: "Démarrage", pct: 4, color: "#EF4444", sub: "38,6 kg · ~2 j" },
              { label: "Drêche", pct: 0, color: "#9CA3AF", sub: "0% restant" }
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[7px]">
                  <span className="font-semibold">{row.label}</span>
                  <span style={{ color: row.color }}>{row.pct}% restant</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
                <p className="mt-0.5 text-[6px] text-gray-400">{row.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav active="home" />
    </div>
  );
}

export function HerdOverviewMockup() {
  const slices = [
    { label: "Truies", value: 5, color: "#F472B6" },
    { label: "Verrats", value: 1, color: "#60A5FA" },
    { label: "Porcelets", value: 27, color: "#FDA4AF" },
    { label: "Engraissement", value: 27, color: "#A78BFA" },
    { label: "Démarrage", value: 16, color: "#FB923C" }
  ];

  return (
    <div className="bg-[#f4f4f6] text-[8px] text-gray-800">
      <StatusBar />
      <div className="px-3 pb-2">
        <p className="text-[10px] font-extrabold">Cheptel</p>
        <p className="text-[6px] text-gray-500">Mode mixte · reproducteurs & bandes</p>
        <div className="mt-2 flex gap-3 border-b border-gray-200 text-[7px] font-bold">
          <span className="border-b-2 border-[#8B5E3C] pb-1 text-[#8B5E3C]">Vue d&apos;ensemble</span>
          <span className="pb-1 text-gray-400">Cheptel <span className="rounded-full bg-gray-200 px-1">76</span></span>
        </div>

        <div className="mt-2 rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[7px] font-bold text-gray-500">EFFECTIF TOTAL</p>
          <p className="text-2xl font-extrabold text-[#5C6B3A]">25</p>
          <p className="text-[7px] text-emerald-600">↑ 0,0%</p>
        </div>

        <div className="mt-2 rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[7px] font-bold tracking-wide text-gray-500">RÉPARTITION PAR CATÉGORIE</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative size-20 shrink-0">
              <div
                className="size-full rounded-full"
                style={{
                  background: `conic-gradient(${slices.map((s, i) => {
                    const start = slices.slice(0, i).reduce((a, b) => a + b.value, 0);
                    const total = 76;
                    return `${s.color} ${(start / total) * 100}% ${((start + s.value) / total) * 100}%`;
                  }).join(", ")})`
                }}
              />
              <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white text-center">
                <span className="text-sm font-extrabold">76</span>
                <span className="text-[6px] text-gray-500">Effectif</span>
              </div>
            </div>
            <div className="space-y-1">
              {slices.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-[6px]">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-gray-400">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <BottomNav active="herd" />
    </div>
  );
}

export function BuildingsMockup() {
  const cards = [
    { id: "A-1", title: "Maternité", count: 5, weight: "64,3 kg", age: "28 sem.", color: "#F9A8D4", icon: "♥" },
    { id: "B-1", title: "Croissance", count: 16, weight: "30 kg", age: "12 sem.", color: "#C4B5FD", icon: "↗" },
    { id: "A-2", title: "Verrat", count: 1, weight: "", age: "", color: "#FDBA74", icon: "♂" },
    { id: "B-2", title: "Engraissement", count: 3, weight: "", age: "", color: "#86EFAC", icon: "🍎" }
  ];

  return (
    <div className="bg-[#f4f4f6] text-[8px] text-gray-800">
      <StatusBar />
      <div className="px-3 pb-2">
        <p className="text-[10px] font-extrabold">Cheptel (8)</p>
        <button type="button" className="mt-1 rounded-full bg-[#5C6B3A] px-2 py-1 text-[7px] font-bold text-white">
          + Ajouter bâtiment
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border bg-white p-2 shadow-sm"
              style={{ borderColor: `${card.color}55` }}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-lg px-1.5 py-0.5 text-[7px] font-bold" style={{ background: `${card.color}33`, color: card.color.replace("F9", "BE").replace("C4", "7C") }}>
                  {card.icon} {card.title}
                </span>
                <span className="text-[7px] font-bold text-gray-400">{card.id}</span>
              </div>
              <p className="mt-2 text-lg font-extrabold">{card.count}</p>
              {card.weight ? (
                <p className="text-[6px] text-gray-500">{card.weight} · {card.age}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="herd" />
    </div>
  );
}

export function MarketplaceMockup() {
  const listings = [
    { title: "Lot de 12 porcelets 450 kg", seller: "Brunell Omepieu", farm: "Ferme Noam", price: "1 125 000 FCFA", date: "16 juin 2026" },
    { title: "Lot engraissement 380 kg", seller: "Brunell Omepieu", farm: "Ferme Noam", price: "990 000 FCFA", date: "14 juin 2026" }
  ];

  return (
    <div className="bg-[#f4f4f6] text-[8px] text-gray-800">
      <StatusBar />
      <div className="px-3 pb-2">
        <p className="text-[10px] font-extrabold">Market</p>
        <div className="mt-2 flex rounded-xl bg-gray-200/80 p-1 text-[7px] font-bold">
          <span className="flex-1 py-1 text-center text-gray-500">Annonces</span>
          <span className="flex-1 rounded-lg bg-white py-1 text-center shadow-sm">Envoyées</span>
          <span className="flex-1 py-1 text-center text-gray-500">Fournisseurs</span>
        </div>
        <div className="mt-2 space-y-2">
          {listings.map((item) => (
            <div key={item.title} className="rounded-2xl border border-purple-100 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[7px] text-emerald-700">🏷</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[6px] font-bold text-red-500">Retirée</span>
              </div>
              <p className="mt-2 text-[9px] font-extrabold leading-snug">{item.title}</p>
              <p className="text-[7px] text-gray-500">{item.seller} · {item.farm}</p>
              <p className="mt-1 text-sm font-extrabold text-[#6D28D9]">{item.price}</p>
              <p className="text-[6px] text-gray-400">{item.date}</p>
              <button type="button" className="mt-2 w-full rounded-xl bg-gray-100 py-2 text-[7px] font-bold text-gray-600">
                Contacter le vendeur
              </button>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="market" />
    </div>
  );
}

export function FinanceReportMockup() {
  const rows = [
    ["Nom exploitant", "Harold Bagui"],
    ["Ferme", "La ferme de Harold"],
    ["Localisation", "Bingerville"],
    ["Effectif cheptel", "76 têtes"],
    ["Revenu mensuel", "1 266 300 FCFA"],
    ["Bénéfice net", "847 300 FCFA"],
    ["Score FermierPro", "73 / 100"],
    ["Risque estimé", "MODÉRÉ"]
  ];

  return (
    <div className="bg-white text-[7px] leading-snug text-gray-800">
      <div className="border-l-4 border-[#5C6B3A] bg-[#f8faf6] px-3 py-4">
        <p className="text-[9px] font-extrabold uppercase leading-tight text-gray-900">
          Synthèse bancaire et évaluation de crédit
        </p>
        <p className="mt-1 text-[6px] text-gray-500">
          Document généré par Fermier Pro — Données certifiées
        </p>
      </div>
      <div className="px-3 py-2">
        <table className="w-full overflow-hidden rounded-lg border border-gray-200">
          <thead>
            <tr className="bg-[#5C6B3A] text-left text-[6px] text-white">
              <th className="px-2 py-1.5 font-bold">Indicateur</th>
              <th className="px-2 py-1.5 font-bold">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value], i) => (
              <tr key={label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-2 py-1.5 text-gray-600">{label}</td>
                <td className="px-2 py-1.5 font-bold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[6px] text-gray-400">
          RPT-202606-RRR93ILI · Empreinte SHA-256 certifiée
        </p>
      </div>
    </div>
  );
}

export function DashboardMockup() {
  const kpis = [
    { label: "Effectif total", value: "58", color: "#FB923C", icon: "🐷" },
    { label: "Reproductrices", value: "5 truies", color: "#F472B6", icon: "🐽" },
    { label: "Engraissement", value: "30", color: "#4ADE80", icon: "📈" },
    { label: "Sujets malades", value: "1", color: "#FACC15", icon: "🤒" }
  ];

  return (
    <div className="bg-[#f4f4f6] text-[8px] text-gray-800">
      <StatusBar />
      <div className="px-3 pb-2">
        <p className="text-[10px] font-extrabold">Vue d&apos;ensemble</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl bg-white p-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span>{kpi.icon}</span>
                <span className="size-6 rounded-full border-2" style={{ borderColor: kpi.color }} />
              </div>
              <p className="mt-2 text-lg font-extrabold">{kpi.value}</p>
              <p className="text-[6px] font-semibold text-gray-500">{kpi.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-[7px] font-bold text-amber-800">💡 CONSEILS IA</p>
          <p className="mt-1 text-[7px] leading-relaxed text-amber-900/80">
            Relocaliser les animaux de A-4 vers des cases sous-utilisées pour améliorer le bien-être et l&apos;occupation des bâtiments.
          </p>
        </div>
      </div>
      <BottomNav active="herd" />
    </div>
  );
}
