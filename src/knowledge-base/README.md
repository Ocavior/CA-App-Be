# Knowledge Base Management Package (`knowledge-base`)

A modular, self-contained backend package for managing Knowledge Base articles, task workflows, and comprehensive audit logs in `CA-App-Be`.

---

## 📁 Package Architecture

```
src/knowledge-base/
├── models/
│   ├── KnowledgeBase.js    # Article/doc schema (title, slug, category, tags, markdown content, views)
│   ├── KnowledgeTask.js    # Task lifecycle schema (status, priority, taskType, assignedTo, dueDate)
│   └── KnowledgeLog.js     # Audit log schema (action, entityType, performedBy, details, status)
├── services/
│   ├── KnowledgeBaseService.js  # CRUD, text search, slug generator, categorization, metrics
│   ├── KnowledgeTaskService.js  # Task workflows, transitions, assignments, stats
│   └── KnowledgeLogService.js   # Audit log querying, event metrics, manual log ingestion
├── controllers/
│   ├── KnowledgeBaseController.js  # HTTP controllers for KB articles
│   ├── KnowledgeTaskController.js  # HTTP controllers for KB tasks & maintenance
│   └── KnowledgeLogController.js   # HTTP controllers for KB audit logs
├── routes/
│   └── knowledgeBaseRoutes.js     # Route declarations compatible with the app Router
├── tasks/
│   └── maintenanceTask.js         # Automated periodic review & overdue task worker
├── logs/
│   └── knowledgeLogger.js         # Async non-blocking audit logging helper
├── index.js                       # Package entrypoint exporting all components
└── README.md                      # This documentation
```

---

## 🚀 API Endpoints

### 1. Knowledge Base Articles (`/ca/knowledge-base`)

| Method | Path | Auth | Description |
|---|---|:---:|---|
| `POST` | `/ca/knowledge-base` | Yes | Create an article |
| `GET` | `/ca/knowledge-base` | No | List articles with search (`?q=`), category (`?category=`), tags (`?tag=`), status (`?status=`), pagination (`?page=1&limit=20`) |
| `GET` | `/ca/knowledge-base/categories` | No | List all distinct categories and article counts |
| `GET` | `/ca/knowledge-base/:id` | No | Get an article by ID or slug (pass `?view=true` to increment view count) |
| `PUT` | `/ca/knowledge-base/:id` | Yes | Update an article |
| `DELETE` | `/ca/knowledge-base/:id` | Yes | Delete an article |
| `PATCH` | `/ca/knowledge-base/:id/status` | Yes | Update status (`draft`, `published`, `archived`) |

#### Example: Create Article
```bash
curl -X POST http://localhost:3000/api/v1/ca/knowledge-base \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Income Tax Filing Guidelines 2026",
    "category": "taxation",
    "tags": ["itr", "compliance", "tax"],
    "summary": "Standard operating procedure for annual income tax returns.",
    "content": "# SOP for ITR Filing\n\n1. Collect Form 16\n2. Verify 26AS\n3. File return.",
    "status": "published"
  }'
```

---

### 2. Knowledge Base Tasks (`/ca/knowledge-base/tasks`)

| Method | Path | Auth | Description |
|---|---|:---:|---|
| `POST` | `/ca/knowledge-base/tasks` | Yes | Create a new task (e.g., review, update, audit) |
| `GET` | `/ca/knowledge-base/tasks` | Yes | List tasks filtered by `status`, `priority`, `taskType`, `articleId` |
| `GET` | `/ca/knowledge-base/tasks/stats` | Yes | Get counts grouped by status and priority |
| `POST` | `/ca/knowledge-base/tasks/run-maintenance` | Yes | Trigger maintenance worker (stale doc reviews & overdue check) |
| `GET` | `/ca/knowledge-base/tasks/:id` | Yes | Get single task details |
| `PUT` | `/ca/knowledge-base/tasks/:id` | Yes | Update task details |
| `PATCH` | `/ca/knowledge-base/tasks/:id/status` | Yes | Update task status (`pending`, `in_progress`, `completed`, `cancelled`) |
| `DELETE` | `/ca/knowledge-base/tasks/:id` | Yes | Delete a task |

#### Example: Create Task
```bash
curl -X POST http://localhost:3000/api/v1/ca/knowledge-base/tasks \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review GST changes for Q3",
    "description": "Ensure GST rate amendments are reflected in the article.",
    "taskType": "update",
    "priority": "high",
    "dueDate": "2026-11-01"
  }'
```

---

### 3. Audit & Activity Logs (`/ca/knowledge-base/logs`)

| Method | Path | Auth | Description |
|---|---|:---:|---|
| `GET` | `/ca/knowledge-base/logs` | Yes | Query audit logs (`action`, `entityType`, `status`, `startDate`, `endDate`) |
| `GET` | `/ca/knowledge-base/logs/stats` | Yes | Aggregate stats of actions and entities |
| `POST` | `/ca/knowledge-base/logs` | Yes | Ingest an external/custom system audit log |

#### Example: Query Logs
```bash
curl -X GET "http://localhost:3000/api/v1/ca/knowledge-base/logs?action=create&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## ⚙️ Maintenance Worker

The `maintenanceTask` runner automates:
1. Detecting published articles that haven't been reviewed in `staleThresholdDays` (default: 90 days).
2. Generating automatic `review` tasks assigned for team follow-up.
3. Identifying and flagging overdue open tasks.
4. Writing execution metrics directly to the `KnowledgeLog` collection.
