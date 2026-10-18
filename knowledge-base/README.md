# CA-App-Be Knowledge Base (`knowledge-base` branch)

This branch serves as the authoritative, centralized knowledge repository for the `CA-App-Be` project.

---

## 📌 Workflow Policy

1. **Knowledge & Log Isolation**:
   - All system documentation, architecture records, API references, task backlogs, and change logs are maintained and committed exclusively on the `knowledge-base` branch.
2. **Feature & Code Development**:
   - Application feature development, fixes, and production code changes are performed on the `dev/prabhash` branch.
3. **Continuous Tracking**:
   - Whenever changes are requested by the user:
     - The change request details, date/time, and context are recorded in [`LOGS.md`](./LOGS.md).
     - The task tracker [`TASKS.md`](./TASKS.md) is updated with task statuses, priorities, and outcomes.
     - System documentation ([`ARCHITECTURE.md`](./ARCHITECTURE.md), [`API_REFERENCE.md`](./API_REFERENCE.md)) is updated to reflect any behavioral or schema changes.
     - The `knowledge-base` branch is committed with all updates.

---

## 📚 Knowledge Base Index

| Document | Purpose |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | High-level system architecture, dual-runtime model (Azure Functions vs Express in `ca-be-node`), database designs, auth mechanics, and parity guidelines |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | Exhaustive catalog of all API endpoints across all modules, including query params, request bodies, and curl samples |
| [`TASKS.md`](./TASKS.md) | Live task tracker: active, completed, and pending development tasks |
| [`LOGS.md`](./LOGS.md) | Detailed audit & changelog recording every modification requested and implemented |
| [`../src/knowledge-base/`](../src/knowledge-base/) | Backend API module for dynamic Knowledge Base articles, task workflows, and runtime audit logging |
