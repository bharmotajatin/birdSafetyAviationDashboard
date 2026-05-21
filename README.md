# Bird Flight Services — Safety Incident Dashboard

Production-ready Next.js dashboard for **DEL_INCIDENT_FIXED.xlsx** (62 incidents, 6 workbook sheets).

## Stack

- Next.js 16 (App Router) · TypeScript · Tailwind CSS v4
- Zustand · xlsx · Framer Motion · Chart.js · Recharts

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload your Excel workbook.

```bash
npm run build
npm run start   # production
```

## Project structure (Phase 1)

```
src/
├── app/                    # Routes: / + 5 sheet pages
├── components/
│   ├── layout/             # Header, SheetTabs, DashboardShell
│   ├── dashboard/          # Upload, SheetDashboard, ML, tables
│   ├── cards/              # ClickableMetricCard
│   ├── charts/             # TrendLine, HorizontalBar, Donut
│   └── ui/                 # shadcn components
└── lib/
    ├── stores/             # Zustand
    ├── ml/                 # Analysis pipeline
    ├── brand.ts            # Navy + gold tokens
    ├── animations.ts
    ├── parse-workbook.ts
    └── sheets.ts           # Route ↔ Excel sheet map
```

## Implementation guide

See **[COMPLETE_NEXTJS_IMPLEMENTATION_GUIDE.md](./COMPLETE_NEXTJS_IMPLEMENTATION_GUIDE.md)** for phased setup (Phases 1–8).

## Brand

| Token | Value |
|-------|--------|
| Navy | `#1a2a5e` |
| Gold | `#d4af37` |
