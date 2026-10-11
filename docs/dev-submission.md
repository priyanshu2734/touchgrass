# DEV submission draft: TouchGrass

> **Draft.** Everything in `[SQUARE BRACKETS]` is for you to fill in. Nothing below states a measurement, a user test, a
> deployment or a personal experience that did not happen. Delete this note before publishing.

Tags: #devchallenge #hf26challenge

Title idea: **TouchGrass: an outdoor planner that runs its AI on your own computer**

## What I Built

TouchGrass is a web app that turns the time, budget and energy someone actually has into a realistic plan for going outside, with a
backup plan in case the day does not cooperate.

The problem it targets is the decision overload around going outside. If you have ten minutes, no money, low energy or an
accessibility need, "best hikes near you" does not help. TouchGrass starts from those constraints.

What it does:

- **AI planner:** time, budget, interests, energy, company and accessibility go in; steps, a checklist, a cost estimate, safety
  reminders and a backup plan come out, written by an open-weight model running locally through Ollama.
- **Honest labelling:** every plan says whether it came from the AI or from a built-in fallback (used when Ollama is off, the model is
  missing, slow, or returns unusable output). Quests are labelled as curated, and places as live OpenStreetMap data.
- **Places near you:** parks, gardens, reserves and viewpoints from OpenStreetMap. Location is requested only when you press a button,
  typing a place works too, and directions open in an external map service.
- **Quests and progress:** 25 hand-written quests that can be filtered by practical limits (for example "only 10 to 20 minutes" and
  "almost no budget"), with indoor fallbacks. Progress, streaks and notes are calculated only from what the person records.

[Optional: one sentence on why this matters to you personally. Write this yourself.]

## Demo

- Video: [DEMO VIDEO URL]
- Live site: [DEPLOYED URL, or write "runs locally, see the repository" if you did not deploy it]
- Screenshots: [add images from the `screenshots/` folder]

Demo script (60 to 90 seconds):

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 to 0:08 | Landing page, hero | "TouchGrass turns the time, budget and energy you actually have into a realistic plan for going outside." |
| 0:08 to 0:30 | Planner: choose 20 minutes, free, low energy, nature and photography, solo; press *Build my plan* | "I have twenty minutes, no money and low energy. The plan is written by an open-weight model running on this laptop through Ollama." Point to the green status box and the "AI-generated with gemma3:4b" badge. |
| 0:30 to 0:38 | Scroll the plan: steps, checklist, backup, safety | "Steps, a checklist, an honest cost estimate and a backup in case it rains." |
| 0:38 to 0:55 | Explore: press *Find places near me* (or type a city), open a place, show distance, "not listed" fields, then *Get directions* | "Places come from OpenStreetMap. Location is only requested when I press this button. If a detail is not known, it says not listed." |
| 0:55 to 1:12 | Quests: tick "Only 10 to 20 minutes" and "Almost no budget", open a quest, press *Start quest*, then *I finished it* with a note | "Quests are hand-written, and they narrow to what fits my limits." |
| 1:12 to 1:22 | Progress | "Progress shows only what I actually did." |
| 1:22 to 1:30 | [Optional pre-recorded cut] Ollama stopped, a plan with the "Built-in fallback plan, not AI" notice | "And if the AI is not available, it says so instead of pretending." |

Recording tips: build one plan before recording so the model is already loaded (the first plan can take a minute), set `OSM_CONTACT`,
have internet for the places step, and use a fresh browser profile so progress starts empty.

## Code

Repository: [REPO URL]

License: MIT for the code (add your name in `LICENSE`). The default model, `gemma3:4b`, is under Google's Gemma Terms of Use, which is
open-weight but not an OSI-approved open-source licence. See the README's licensing section.

Structure: `frontend/` (React, TypeScript, Vite, Tailwind, Framer Motion), `backend/app/` (FastAPI planner, catalogue, Ollama client),
`backend/part3/` (places, quests, progress), `docs/`.

## How I Built It

- **Stack:** React, TypeScript, Vite, Tailwind and Framer Motion on the front. FastAPI, Pydantic and SQLite on the back. Ollama serves
  the model. OpenStreetMap supplies place data through Overpass and Nominatim.
- **The AI path:** the backend builds a prompt from the preferences, calls Ollama's `/api/chat` with a JSON schema, parses and validates
  the reply, and corrects what it safely can (for example a cost above the person's budget is clamped and the correction is
  disclosed). Anything unusable becomes a labelled fallback built from a catalogue, so the app always answers.
- **Privacy by design:** coordinates are rounded before leaving the browser, never sent to the model, never stored, and redacted from
  server logs. There are no accounts and no API keys.
- **Honesty by design:** missing data is shown as "not listed", never invented. No ratings, safety claims or live conditions.
- **Testing:** pytest and Vitest suites. The Ollama and OpenStreetMap calls are tested against local stand-ins that speak the same
  protocols, and the frontend's API client was run against the real backend process.
- **What was hard:** [Write this yourself: real difficulties you met, for example integrating two backends or getting a small model to
  return valid JSON.]
- **What I would do next:** [Write this yourself. The README lists ideas.]
- **Tools and assistance:** [State honestly which tools, including AI assistants, you used to build this.]
- **Measurements:** [Add real numbers only if you measure them, for example time to first plan on your hardware with the model you
  chose. Do not estimate.]

## Why Does Open Innovation Matter?

This product handles personal context: free time, money, energy and sometimes health or accessibility needs. Open-weight models make
it possible to keep that on the person's own computer instead of sending it to a hosted AI service. Open map data means place
discovery does not depend on one company's terms or prices, and open code means someone else can swap the quests for their own city
or language, audit what is stored, or run it for a school or community group.

There are honest trade-offs: local models are slower and less polished than hosted ones, "open-weight" is not the same as "open
source" (the default model's licence has restrictions), and community map data can be incomplete. The app is built to be transparent
about all of that rather than hide it.

## Prize Categories

> Only claim categories that genuinely fit, and **copy the exact category names and rules from the official challenge page**. I
> could not check the current list from here, so none are named below.

- [CATEGORY NAME from the rules]: [Why it applies, in a sentence. For example: the AI runs locally through Ollama on an open-weight
  model, and plans fall back transparently when it is unavailable. Only write what is true for your final build.]
- [Delete any category that does not clearly apply.]

#devchallenge #hf26challenge
