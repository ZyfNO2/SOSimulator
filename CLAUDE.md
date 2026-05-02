# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

No test runner is configured yet. When adding tests, use `vitest` (not yet installed).

## Architecture

**Stack**: React 19 + TypeScript 6 + Vite 8. Pure client-side SPA, no backend.

**Game state** lives entirely in `App.tsx` via `useState`:
- `cards: TableCard[]` — all cards on the table (position, stacking, spawn animation)
- `productions: ProductionRun[]` — active/shrinking progress timers
- `nowMs: number` — ticking clock driving animations and production completion
- `draggingId: string | null` — pointer capture state

**Data flow**: `CardKind.json` + `CardOutput.json` → `cardData.ts` (loads+maps) → `App.tsx` → components

**Three core `useEffect` loops** in App.tsx:
1. **Timer tick** (16ms interval) — updates `nowMs` to drive production rings and spawn animations
2. **Recipe detection** — runs when `cards` changes, matches stacked pairs against `CardOutput.json` rules, creates `ProductionRun` or transitions to `shrinking`
3. **Production completion** — runs when `nowMs`/`cards`/`productions` change, handles finished runs (consume child, spawn output, auto-requeue)

**Key modules** (all pure functions operating on `TableCard[]`):
- `src/game/stacking.ts` — drag snap, stack relationship CRUD, z-index, descendant traversal
- `src/game/production.ts` — recipe matching, child consumption, output card spawning
- `src/game/cardData.ts` — JSON loading, definition map, initial table state
- `src/game/constants.ts` — all tunable numbers (card size, snap thresholds, timings)
- `src/game/types.ts` — `TableCard`, `ProductionRun`, `ProductionMatch`, `DragState`, `CardOutputRule`

**Stacking model**: Cards form chains (A→B→C) via `parentCardId`/`childCardId`. Each card has at most one parent and one child. A recipe fires when a parent+child pair matches a `CardOutputRule`. Drag snaps to another card's title line (31px offset).

## Design docs vs. current code

The `doc/` directory describes a **target architecture** that differs significantly from the current prototype:

| Aspect | Current code | Design docs (AI_SDD) |
|--------|-------------|---------------------|
| State | `useState` × 5 in App | `useReducer` with centralized store |
| Interaction | Drag card onto card → auto-trigger | Drag card into action box slot → click Start → click Claim |
| Recipes | parent+child pair matching | Multi-slot recipes with type/tag matching |
| Events | Click event card → detail modal | Event tree with choices, flags, story progression |
| Log | None | Log panel for action feedback |
| Endings | None | Victory (morning-star) + 2 failure endings |
| Card types | resource, clue, routine, event | resource, clue, knowledge, state, tool, ritual, ending |

The design docs are the **source of truth** for future development. The current code is a spike/prototype that validates drag-and-stack UX but doesn't match the target action-slot architecture.

## Key invariants

- Cards have at most one `parentCardId` and one `childCardId` (chain, not tree)
- Recipe matching uses `definitionId`, never display names
- `ProductionRun.pairKey` = `ruleId:parentCardId:childCardId` — globally unique per active match
- State updates use `queueMicrotask` batching to avoid stale closures in `setProductions`/`setCards`
- Pointer events handle capture manually; drag vs. click is disambiguated by 4px movement threshold
- All rules are data-driven from JSON files in `src/data/`

## Rules from AI_Rules.md

- Game rules must be pure functions, never embedded in components
- Reducer must return original state on illegal operations (don't throw)
- Use `definitionId`, `type`, `tags` for logic — never Chinese display names
- Every new recipe needs a matching unit test
- No backend/login/network for MVP
- Reserve click-based interaction as alternative to drag
- Chinese for player-facing text, English for code identifiers
