# Manual Batch Participations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins add retrospective completed participation records for many students from an activity panel.

**Architecture:** Add one admin-only backend endpoint under activities that accepts selected user IDs and pasted student IDs, resolves them in the caller's scope, and creates or updates `participations` as `checked_out`. Add frontend API types and a dialog on `admin/activities/[id]` with autocomplete search, selected-student chips, paste support, notes, and per-student result feedback.

**Tech Stack:** Rust Axum + SQLx backend, SvelteKit 2/Svelte 5 frontend, existing shadcn-style UI components, existing `request()` API client.

---

### Task 1: Backend Batch Completion Endpoint

**Files:**
- Modify: `backend/src/modules/activities/models.rs`
- Modify: `backend/src/modules/activities/handlers.rs`
- Modify: `backend/src/main.rs`

- [ ] Add request/response models for manual completion batches.
- [ ] Add a small tested helper that trims, filters, and de-duplicates pasted student IDs.
- [ ] Add `manual_complete_participations` handler:
  - require admin auth,
  - require activity management scope,
  - accept `user_ids` and `student_ids`,
  - allow `published`, `ongoing`, and `completed` activities,
  - reject `draft`, `cancelled`, or deleted activities,
  - resolve users in caller scope,
  - insert missing participations as `checked_out`,
  - update `registered`/`checked_in`/`no_show` rows to `checked_out`,
  - leave `checked_out`/`completed` rows unchanged,
  - return per-input result rows and summary counts.
- [ ] Register route `POST /activities/{id}/participations/manual-complete`.
- [ ] Run `cargo test` and `cargo check` from `backend/`.

### Task 2: Frontend API Support

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] Add TypeScript types for manual batch completion request, result rows, and summary.
- [ ] Add `activities.manualCompleteParticipations(activityId, payload)`.
- [ ] Reuse existing `usersApi.list()` for search/autocomplete.

### Task 3: Activity Panel Dialog

**Files:**
- Modify: `frontend/src/routes/admin/activities/[id]/+page.svelte`

- [ ] Add state for dialog, student search, selected students, pasted IDs, notes, submitting, and last results.
- [ ] Add debounced autocomplete using `usersApi.list({ search, status: 'active', per_page: 10 })`.
- [ ] Add selected-student list with remove buttons.
- [ ] Add multiline pasted student ID input.
- [ ] Submit selected `user_ids` and pasted `student_ids` to backend.
- [ ] Refresh activity counts after successful submit.
- [ ] Show summary and per-student statuses after submit.
- [ ] Run `npm run check` and `npm run lint` from `frontend/`.

### Task 4: Commit And Push

**Files:**
- All modified files.

- [ ] Review `git diff`.
- [ ] Commit with an English message.
- [ ] Push `feature/manual-batch-participations` to `origin`.
