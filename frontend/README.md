# TouchGrass frontend

React 18, TypeScript, Vite, Tailwind CSS, Framer Motion. Setup commands are in the **root [`README.md`](../README.md)**.

```
src/
  pages/        Landing, Planner, Explore (places + activity ideas), Quests, QuestDetail, Progress, About
  components/   shared UI (Button, Modal, FormField, ...), places/, quests/, progress/, landing/
  services/     api.ts (the only place that calls the backend), validators.ts (validates and converts every response),
                profile.ts (anonymous id), geolocation.ts, config.ts, mock/ (demo mode)
  hooks/ types/ data/ utils/ styles/ layouts/
```

Scripts: `npm run dev`, `npm run build` (type-checks first), `npm test`, `npx tsc --noEmit`.

Rules this code follows: components never call `fetch` directly; every response is validated before rendering; geolocation is
requested only from a click handler; missing data is shown as "not listed", never invented; every plan, quest and place says what it is
(AI-generated, fallback, demo, curated, live OpenStreetMap data).

`VITE_USE_MOCK=true` enables a labelled, backend-free demo. `src/e2e.contract.test.ts` runs the API client against a real backend when
`VITE_E2E_URL` is set (see `../docs/testing.md`).
