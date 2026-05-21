# Bird Flight Services — Complete Next.js Implementation Guide

**Workbook:** `DEL_INCIDENT_FIXED.xlsx` (62 incidents)  
**Brand:** Navy `#1a2a5e` · Gold `#d4af37`  
**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · Zustand · Framer Motion · Chart.js · xlsx

---

## Phase checklist

| Phase | Focus | Status |
|-------|--------|--------|
| **1** | Project structure (App Router, folders, config) | ✅ Done |
| **2** | Bird Flight colors + glassmorphism (`globals.css`, `brand.ts`) | ✅ Done |
| **3** | Zustand store, Excel parser, animations | ✅ Done |
| **4** | UI shell (Header, Tabs, Uploader, Dialog) | ✅ Done |
| **5** | Cards, Charts, Tables, ML panels | ✅ Done |
| **6** | Six dashboard pages + ML analysis | ✅ Done |
| **7** | Performance (chart sizing, turbopack root) | ✅ Done |
| **8** | Production build & lint | ✅ Done |

---

## PHASE 1 — Project structure

### 1.1 Create project (reference)

```bash
npx create-next-app@latest bird-flight-dashboard \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd bird-flight-dashboard
npm install zustand xlsx framer-motion chart.js react-chartjs-2 recharts lucide-react date-fns
```

> This repo uses **Next.js 16** (compatible with the guide; APIs match App Router patterns from Next.js 14+).

### 1.2 Directory layout

```
bird-flight-dashboard/
├── public/                          # Static assets
├── src/
│   ├── app/                         # App Router pages
│   │   ├── layout.tsx               # Root layout + DashboardShell
│   │   ├── page.tsx                 # Main dashboard (/)
│   │   ├── globals.css              # Tailwind + glass theme
│   │   ├── pan-india-stations/
│   │   ├── station-analysis/
│   │   ├── station-wise-analysis/
│   │   ├── monthly-dashboard/
│   │   └── graphs-dashboard/
│   ├── components/
│   │   ├── layout/                  # Header, SheetTabs, DashboardShell
│   │   ├── dashboard/             # Upload, SheetDashboard, tables, ML
│   │   ├── cards/                   # ClickableMetricCard, MetricCard
│   │   ├── charts/                  # TrendLine, HorizontalBar, Donut
│   │   └── ui/                      # shadcn primitives
│   └── lib/
│       ├── stores/                  # Zustand dashboard-store
│       ├── ml/                      # ML analysis pipeline
│       ├── brand.ts                 # Design tokens
│       ├── animations.ts            # Framer Motion variants
│       ├── card-detail-data.ts      # Modal / sparkline helpers
│       ├── types.ts                 # Domain types
│       ├── sheets.ts                # Sheet ↔ route mapping
│       ├── parse-workbook.ts        # Excel multi-sheet parse
│       └── parse-incidents.ts       # Incident log parse
├── next.config.ts
├── tsconfig.json                    # "@/*" → "./src/*"
├── postcss.config.mjs
├── package.json
└── COMPLETE_NEXTJS_IMPLEMENTATION_GUIDE.md
```

### 1.3 Six dashboard routes

| # | Route | Sheet (Excel) |
|---|--------|----------------|
| — | `/` | Main (Incident Log ML) |
| 1 | `/pan-india-stations` | PAN INDIA STATIONS |
| 2 | `/station-analysis` | STATION ANALYSIS |
| 3 | `/station-wise-analysis` | STATION-WISE ANALYSIS |
| 4 | `/monthly-dashboard` | MONTHLY DASHBOARD |
| 5 | `/graphs-dashboard` | GRAPHS DASHBOARD |

### 1.4 Config files (Phase 1)

- **`tsconfig.json`** — `strict: true`, path alias `@/*`
- **`next.config.ts`** — `turbopack.root` set to project dir (avoids lockfile warning)
- **`postcss.config.mjs`** — Tailwind v4 via `@tailwindcss/postcss`
- **`components.json`** — shadcn/ui config

### 1.5 npm scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

---

## PHASE 2 — Brand & glassmorphism

See `src/lib/brand.ts` and `src/app/globals.css` (`.glass-card`, `.glass-header`, dark theme).

---

## PHASE 3 — State & data

- **Store:** `src/lib/stores/dashboard-store.ts`
- **Parser:** `src/lib/parse-workbook.ts` + `parse-incidents.ts`
- **ML:** `src/lib/ml/index.ts` → `runFullMLAnalysis()`
- **Animations:** `src/lib/animations.ts`

---

## PHASE 4–5 — Components

| Component | Path |
|-----------|------|
| Shell | `components/layout/DashboardShell.tsx` |
| Header | `components/layout/Header.tsx` |
| Tabs | `components/layout/SheetTabs.tsx` |
| Upload | `components/dashboard/upload-screen.tsx` |
| Clickable cards | `components/cards/ClickableMetricCard.tsx` |
| Charts | `components/charts/TrendLineChart.tsx`, etc. |
| Sheet view | `components/dashboard/SheetDashboard.tsx` |
| Data table | `components/dashboard/DataTablePanel.tsx` |

---

## PHASE 6 — Pages

Each sheet page: `<SheetPageView routeId="…" />` → `SheetDashboard` with clusters (metrics · charts · table).

---

## PHASE 7–8 — Run & deploy

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npm run build
npm run start
```

Upload `DEL_INCIDENT_FIXED.xlsx` on the home screen to load all sheets.

---

## Fixes addressed

- ✅ Trend lines (Chart.js `tension: 0.4`, gradient fill)
- ✅ Readable bar labels (horizontal, sorted, `autoSkip: false`)
- ✅ Clickable metric cards → detail modal
- ✅ Framer Motion on cards, tabs, modals
- ✅ Cluster layout (metrics / visualizations / table)
- ✅ Chart drill-down → filters data table
- ✅ Glassmorphism dark UI + gold accents
