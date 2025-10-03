# TALENTFLOW — A Mini Hiring Platform

A single‑page React app that simulates a lightweight ATS (Applicant Tracking System) with **Jobs**, **Candidates**, and **Assessments** — powered entirely in the browser using **MSW** (mock REST API) and **Dexie/IndexedDB** for persistence. Built with **Vite**, **React Router**, and **React Query**.

---

## 🚀 Quick Start

```bash
# 1) Install deps
npm i

# 2) Run dev (http://localhost:5173)
npm run dev

# 3) Lint (optional)
npm run lint

# 4) Production build + preview
npm run build
npm run preview
```

* On first boot the app **seeds** the local DB with **25 jobs**, **1000 candidates**, and **≥3 assessments**.
* Use the floating **“Dev — Reset DB & Reseed”** button (bottom‑left) to clear and reseed IndexedDB at any time.

---

## 📦 Project Scripts

* `npm run dev` — start Vite dev server
* `npm run build` — production build to `dist/`
* `npm run preview` — static preview of `dist/`
* `npm run lint` — lint with ESLint

---

## 🧰 Tech Stack

**Runtime**

* React **19**
* React Router **7**
* @tanstack/react-query **5**

**Dev / Tooling**

* Vite **7**
* ESLint **9**

**Data & API**

* Dexie **4** (IndexedDB)
* MSW **2** (Mock REST API)
* @faker-js/faker **10** (seed data)

**(Installed but currently unused)**

* `@dnd-kit/*`, `react-window`, `nanoid`

---

## 🏗️ Architecture

### Project Structure

```
src/
  components/
    DevBar.jsx         # floating developer utilities (reset & reseed)
    Modal.jsx          # generic modal
    NavBar.jsx         # top navigation (brand, menus)
    TagsInput.jsx      # tags field with chips & limits
    ToastProvider.jsx  # global toasts + useToast()
  features/
    jobs/
      JobsPage.jsx         # list/filter/sort/paginate jobs + create modal
      CreateJobModal.jsx   # create job (slug logic, tags)
      JobDetail.jsx        # (currently contains duplicate CreateJob code; see Issues)
    candidates/
      CandidatesPage.jsx   # search/filter/paginate candidate list (50/page)
      CandidatesKanban.jsx # drag & drop across hiring stages (HTML5 DnD)
      CandidateProfile.jsx # identity, stage, notes with @mentions, submissions, timeline
    assessments/
      AssessmentBuilder.jsx   # sections + questions + validation + conditional logic
      AssessmentFillPage.jsx  # runtime form + client validation + submit
      AssessmentPreview.jsx   # embeddable preview/fill + submit
  lib/
    db.js      # Dexie schema + isSeeded()
    seed.js    # seeds jobs/candidates/assessments
    dev.js     # reset & reseed helper
    team.js    # static teammates for @mentions
  mocks/
    browser.js   # setupWorker(...)
    handlers.js  # REST endpoints (jobs, candidates, notes, assessments)
    utils.js     # simulateLatency + maybeFailWrite
  main.jsx       # boot MSW + seedIfEmpty + providers + router
  App.jsx        # routes and layout shell
  index.css      # theme tokens, utilities, components, layouts
public/
  mockServiceWorker.js  # MSW worker (auto-generated)
```

### Routes

* `/` → redirects to `/jobs`
* `/jobs` → jobs list (search, filter, sort, paginate, create)
* `/jobs/:jobId` → **(placeholder/dup)**; see *Issues*
* `/candidates` → candidates list (search, filter by stage, paginate)
* `/candidates/board` → kanban pipeline (drag candidates across stages)
* `/candidates/:id` → candidate profile (identity, stage, notes, timeline, submissions)
* `/assessments/:jobId` → assessment builder
* `/assessments/:jobId/fill` → runtime form

### Data Model (ERD)

```
Job 1 ────┐                    Assessment 1
          ├─> Candidate N ─┬── Timeline N
          │                 └── Note N
          └─> Submission N  (optionally linked to Candidate)
```

* **jobs**: `id`, `title`, `slug`, `status('active'|'archived')`, `tags[]`, `order`
* **candidates**: `id`, `name`, `email`, `jobId`, `stage('applied'|'screen'|'tech'|'offer'|'hired'|'rejected')`
* **timelines**: `id`, `candidateId`, `at`, `fromStage`, `toStage`, `note`
* **assessments**: `jobId` (PK), `version`, `updatedAt`, `title`, `sections[]` (with `questions[]`)
* **submissions**: `id`, `jobId`, `candidateId?`, `answers`, `createdAt`
* **notes**: `id`, `candidateId`, `text`, `mentions[]`, `createdAt`

### Mock API (MSW)

**Jobs**

* `GET  /jobs?search=&status=&page=&pageSize=&sort=` — list with filters/sort
* `GET  /jobs/:id` — get one
* `GET  /jobs/slug/:slug?excludeId=` — slug availability
* `POST /jobs` — create (slugify + uniqueness fallback)
* `PATCH /jobs/:id` — update (title regenerates unique slug; tags; status)
* `PATCH /jobs/:id/reorder` — reorder using order-shift algorithm

**Candidates**

* `GET  /candidates?stage=` — list by stage (joins job title)
* `POST /candidates` — create (auto-assigns job if omitted)
* `GET  /candidates/:id` — get one (+ job title)
* `PATCH /candidates/:id` — update; stage changes append timeline event
* `GET  /candidates/:id/timeline` — stage history (sorted)

**Notes**

* `GET  /candidates/:id/notes`
* `POST /candidates/:id/notes` — saves `mentions` extracted from `@handles`
* `DELETE /notes/:noteId`

**Assessments**

* `GET  /assessments/exists?jobIds=1,2` — boolean map
* `GET  /assessments/:jobId` — get or return empty shell
* `PUT  /assessments/:jobId` — create/update schema
* `POST /assessments/:jobId/submit` — store submission
* `GET  /assessments/:jobId/submissions?candidateId=` — list submissions (newest first)

**Simulation**

* Latency: `200–1200ms` on calls
* Random write failures via `maybeFailWrite(p=0.08)` to test optimistic UIs

### State Management

* **React Query** for complex server-state screens (e.g., Candidate Profile: candidate, timeline, notes, submissions).
* **Local component state** for simpler fetch lifecycles (Jobs list, Candidates list/kanban).
* **Toasts** via `ToastProvider` for consistent feedback.
* **Routing** uses `<BrowserRouter basename={import.meta.env.BASE_URL}>` for subpath deploys.

### Styling & Design System

* Single `index.css` with **theme tokens**: `--bg`, `--surface`, `--line`, `--text`, `--text-dim`, `--accent`, `--accent2`, radii, blur, shadows.
* Reusable primitives: `.btn`, `.input`, `.select`, `.glass`, `.card`, chips, badges, grids.
* Responsive: jobs toolbar, candidates grid/kanban, modal sizes, mobile navbar.

---

## 🧩 Features

### Jobs

* List, **search**, filter by **status**, **sort** by order/title, **paginate**.
* **Create Job** modal with slug generation + uniqueness fallback; tags via comma input.
* Edit title; **archive/unarchive**; **reorder** with backend order-shift.
* **Assessment badge** on jobs with assessments; quick links to **Builder** & **Form**.

### Candidates

* **List view**: search (name/email/job), filter by stage, 50-per-page pagination.
* **Kanban board**: drag & drop across stages with **optimistic update** and rollback on error.
* **Profile**: edit identity; change stage (adds timeline event); **notes with @mentions** and typeahead; view submissions and **export submission JSON**; full timeline.

### Assessments

* **Builder**: multi-section; types = `single`, `multi`, `short`, `long`, `number`, `file`; validation (required, min/max, maxLength); **conditional display**.
* **Runtime**: normalized schema; client validation; submit to `/submit`; optional candidateId.
* **Preview** component: embeddable preview/fill with submit.

---

## 🧭 Technical Decisions

1. **Browser‑only backend** using MSW + Dexie

   * Portable demo without servers; realistic REST semantics; persistence across reloads.
2. **Routing with subpath support**

   * `basename={import.meta.env.BASE_URL}` ensures correct links on GitHub Pages/Netlify subpaths.
3. **Selective React Query**

   * Heavy server-state screens get caching/invalidations; simple pages kept lean. Future: unify all via React Query.
4. **Schema normalization**

   * Runtime form normalizes question types/conditions so seeded and authored assessments render identically.
5. **Design tokens in vanilla CSS**

   * Minimal deps, consistent visuals, easy theming.
6. **Developer UX**

   * Floating **DevBar** for reset/reseed; simulated latency/failure to exercise UX states.

---

## ☁️ Deployment

1. **Build**

```bash
npm run build
npm run preview   # sanity-check locally
```

2. **Static hosting**

* Deploy `dist/` to Netlify/Vercel static/GitHub Pages/S3.
* Serve over **HTTPS** (Service Worker requirement; `localhost` is allowed).

3. **Base path & MSW**

* App and worker reference `${import.meta.env.BASE_URL}` (e.g., `/talentflow/`), so subpath deploys work.

4. **SPA routing**

* Configure a **fallback to index.html** for unknown routes.

---

## 🐞 Known Issues & Limitations

1. **Case‑sensitive import mismatch**

   * `App.jsx` imports `./components/Navbar`, file is `NavBar.jsx`. On Linux/case‑sensitive FS this fails.
   * **Fix**: rename to match exactly (either file or import path).

2. **`JobDetail.jsx` duplication**

   * Exports a `CreateJobModal` implementation instead of a job detail screen. Routes expect `/jobs/:jobId`.
   * **Fix**: implement real Job Detail (job meta, related candidates, assessment link) and remove duplication.

3. **Unused dependencies**

   * `@dnd-kit/*`, `react-window`, `nanoid` are installed but unused.
   * **Action**: remove or adopt (`dnd-kit` for kanban; `react-window` for virtualization).

4. **File uploads are UI stubs**

   * `file` question type does not persist files.

5. **No auth/security**

   * Demo‑only; all data is local.

6. **Partial React Query adoption**

   * Some pages use raw `fetch`. Consider unifying for caching/retries and better DX.

7. **App.css boilerplate**

   * Vite scaffold; can be removed/merged into `index.css`.

---

## 🛠️ Troubleshooting

* **MSW failed to start**

  * Ensure `public/mockServiceWorker.js` exists; serve via HTTPS (or `localhost`).
  * Worker URL: `${BASE_URL}mockServiceWorker.js` — verify your base path.

* **Data didn’t seed / looks empty**

  * Click **Dev → Reset DB & Reseed** or clear storage for the origin and refresh.

* **404 when refreshing deep links**

  * Configure SPA fallback to `index.html` on your host.

* **Kanban DnD not working**

  * Uses native HTML5 DnD; some webviews may restrict it. Consider using `@dnd-kit`.

---

### Bonus Features

* DevBar (reset & reseed); random write failures; **@mentions** with autocomplete; submission **JSON export**; conditional questions; slug availability + unique fallback; assessment existence badges.

---

## 🗺️ Roadmap / Bonus Ideas

* Replace native DnD with **`@dnd-kit`** for touch & a11y.
* Virtualize large lists with **`react-window`**.
* Central API client + full React Query adoption (retries/backoff, stale‑times, optimistic flows).
* Real **Job Detail** screen with related entities.
* Improved a11y: roles/aria for DnD, focus traps in modals, keyboard reordering.
* Tests: unit (helpers), component (forms), e2e (Playwright + MSW).
* Feature flags/env toggles for seed size, failure rates, and worker enablement.
* Theme switcher (light/dark) via CSS variables.


