# Complete UI Redesign — Implementation Reference

All steps below are **implemented** in this project.

## STEP 1 — ThemeContext
`src/contexts/ThemeContext.tsx` — light/dark state, localStorage, `toggleTheme()`

## STEP 2 — Root layout
`src/app/layout.tsx` — `AppProviders` wraps app, `suppressHydrationWarning` on `<html>`

## STEP 3 — Theme toggle in Header
`src/components/layout/ThemeToggle.tsx` + Header sun/moon button

## STEP 4 — Global CSS
`src/app/globals.css` — 15px body, 14px+ small text, light/dark tokens, glass cards, data table styles, chart containers

## STEP 5 — DataTable
`src/components/dashboard/DataTablePanel.tsx` — readable cells, word-wrap, 10 columns, search, theme-aware

## STEP 6 — HorizontalBarChart
`src/components/charts/HorizontalBarChart.tsx` — dynamic height per station count, 13px labels, theme colors, overflow contained

## STEP 7 — TrendLineChart
`src/components/charts/TrendLineChart.tsx` — 360px card, smooth tension 0.4, rotated x labels, theme-aware

## STEP 8 — MetricCard
`src/components/cards/ClickableMetricCard.tsx` — 16px titles, foreground tokens

## STEP 9 — Run
```bash
npm install
npm run dev
```

## STEP 10 — Verify
- Toggle theme (header moon/sun icon)
- Upload workbook → check charts, table, station names
- Resize window — charts stay in cards
