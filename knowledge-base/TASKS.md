# Task Tracker (`TASKS.md`)

This document tracks all developer and agentic tasks for `CA-App-Be`. It is updated continuously on the `knowledge-base` branch whenever changes are requested or completed.

---

## 🚦 Status Legend
- `[x]` **Completed**: Tested, verified, and committed.
- `[/]` **In Progress**: Active work in development.
- `[ ]` **Pending**: Planned task waiting for execution or user request.
- `[-]` **Deferred / On Hold**: Not actively worked on.

---

## 📋 Completed Tasks

| Task ID | Description | Branch | Completed At | Notes |
|---|---|:---:|:---:|---|
| **TASK-001** | Create development branch `dev/prabhash` | `dev/prabhash` | 2026-10-19 | Branch created tracking `origin/dev/prabhash`. |
| **TASK-002** | Design & implement `knowledge-base` backend module | `knowledge-base` | 2026-10-19 | Full module with Articles, Tasks, and Audit Logs models, services, controllers, routes, and workers in `src/knowledge-base`. |
| **TASK-003** | Port `knowledge-base` package to standalone Node.js server | `knowledge-base` | 2026-10-19 | Replicated to `ca-be-node/src/knowledge-base` and registered in both routers for runtime parity. |
| **TASK-004** | Build automated Jest test suite for Knowledge Base | `knowledge-base` | 2026-10-19 | In-memory Mongo tests covering models, services, tasks worker, audit logs, and controllers in `test/modules/knowledge-base/`. |
| **TASK-005** | Establish dedicated `knowledge-base` branch and documentation | `knowledge-base` | 2026-10-19 | Created `knowledge-base` branch with isolated documentation (`README.md`, `ARCHITECTURE.md`, `API_REFERENCE.md`, `TASKS.md`, `LOGS.md`). |

---

## 🎯 Active & Upcoming Tasks

| Task ID | Title | Target Branch | Status | Priority | Description |
|---|---|:---:|:---:|:---:|---|
| **TASK-006** | Branch Separation Protocol | `knowledge-base` & `dev/prabhash` | `[/]` In Progress | High | Enforce isolation: documentation & task/log updates in `knowledge-base`; code implementations in `dev/prabhash`. |
| **TASK-007** | Sub-service Filter AND Logic | `dev/prabhash` | `[ ]` Pending | High | Fix `GET /ca/search?services=...` to require ALL selected sub-services (AND) rather than ANY (OR). (Ref: Issue #1) |
| **TASK-008** | Search Pagination Total Count Fix | `dev/prabhash` | `[ ]` Pending | Medium | Fix `/ca/search` so `totalCount` and `totalPages` are preserved on page 2+ instead of returning `null`. (Ref: Issue #2) |
| **TASK-009** | Sub-service Filter on Submissions | `dev/prabhash` | `[ ]` Pending | Medium | Support sub-service filtering on `GET /ca/submissions`. (Ref: Issue #3) |
| **TASK-010** | Search Relevance Ranking Quality | `dev/prabhash` | `[ ]` Pending | Low | Ensure exact full-name matches rank above partial string matches in `searchSubmissions`. (Ref: Issue #4) |
| **TASK-011** | Location Match Consistency | `dev/prabhash` | `[ ]` Pending | Low | Unify state/city regex match semantics between `/ca/submissions` and `/ca/search`. (Ref: Issue #6) |

---

## 🔄 Protocol for Future Updates
Whenever a user requests changes:
1. Append or update the task entry above with status `[/]` In Progress.
2. Record the change request in [`LOGS.md`](./LOGS.md).
3. Implement code changes on `dev/prabhash`.
4. Return to `knowledge-base` branch to mark task `[x]` Completed and update architectural/API references.
