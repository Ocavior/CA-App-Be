# Complete API Reference

All routes are mounted under the base path prefix: `/api/v1` (e.g., `http://127.0.0.1:3000/api/v1` or `http://127.0.0.1:7071/api/v1`).

---

## 1. Authentication & Administrator Management

### `POST /auth/register`
* **Auth**: None
* **Description**: Register a new admin user.
* **Payload**: `{ "email": "admin@example.com", "password": "securepassword", "role": "admin" }`

### `POST /auth/login`
* **Auth**: None
* **Description**: Authenticate with email/password and obtain a JWT bearer token.
* **Payload**: `{ "email": "admin@example.com", "password": "securepassword" }`
* **Response**: `{ "success": true, "token": "<JWT_STRING>", "user": { ... } }`

### `GET /adminUsers`
* **Auth**: Bearer Token
* **Description**: List all registered admin accounts.

### `PUT /auth/update-user/:id`
* **Auth**: Bearer Token
* **Description**: Update user attributes (role, active state, profile).

### `DELETE /auth/delete-user/:id`
* **Auth**: Bearer Token
* **Description**: Remove an administrator account.

---

## 2. CA Submissions & Directory

### `GET /ca/submissions`
* **Auth**: Bearer Token
* **Query Params**: `page`, `limit`, `state`, `city`, `services`
* **Description**: List CA profiles with pagination and service-level filters.

### `GET /ca/search`
* **Auth**: None / Bearer Token
* **Query Params**: `q` (keyword query), `services` (e.g. `incomeTax:compliance`), `state`, `city`, `page`, `limit`
* **Description**: Full-text and multi-attribute search across names, phone numbers, cities, and services.

### `POST /ca/submissions`
* **Auth**: Bearer Token
* **Description**: Create a single CA profile manually.
* **Payload**:
```json
{
  "name": "Rajesh Sharma",
  "mobile": "9876543210",
  "email": "rajesh@example.com",
  "state": "Maharashtra",
  "city": "Mumbai",
  "services": {
    "incomeTax": {
      "offered": true,
      "subServices": { "compliance": true, "taxPlanning": true }
    }
  }
}
```

### `GET /ca/submissions/:id`
* **Auth**: Bearer Token
* **Description**: Fetch single CA submission details.

### `PUT /ca/submissions/:id`
* **Auth**: Bearer Token
* **Description**: Update a CA submission record.

### `DELETE /ca/submissions/:id`
* **Auth**: Bearer Token
* **Description**: Delete a CA submission.

### `POST /ca/import`
* **Auth**: Bearer Token
* **Content-Type**: `multipart/form-data`
* **Description**: Bulk import CA records from CSV / Excel file with automatic phone normalization and deduplication.

### `POST /ca/import/preview`
* **Auth**: Bearer Token
* **Content-Type**: `multipart/form-data`
* **Description**: Dry-run preview of an import file returning forecast of inserts, updates, and validation errors.

---

## 3. Dynamic Services & Sub-Services

### `GET /ca/services`
* **Auth**: Bearer Token
* **Description**: List all top-level services, including inactive and pending items.

### `POST /ca/services`
* **Auth**: Bearer Token
* **Description**: Create a new master service with optional inline sub-services.
* **Payload**:
```json
{
  "name": "Goods and Services Tax",
  "alias": "gst",
  "subServices": [
    { "name": "Monthly Filing", "alias": "monthlyFiling" },
    { "name": "Annual Audit", "alias": "annualAudit" }
  ]
}
```

### `GET /ca/services/:id`
* **Auth**: Bearer Token
* **Description**: Fetch service by ID.

### `PUT /ca/services/:id`
* **Auth**: Bearer Token
* **Description**: Update service metadata or name.

### `PATCH /ca/services/:id/active`
* **Auth**: Bearer Token
* **Description**: Toggle `isActive` status (soft-delete / restore / approve pending).
* **Payload**: `{ "isActive": false }`

### `POST /ca/services/:id/sub-services`
* **Auth**: Bearer Token
* **Description**: Append a new sub-service to an existing service.

### `PUT /ca/services/:id/sub-services/:subServiceId`
* **Auth**: Bearer Token
* **Description**: Modify an existing sub-service.

### `PATCH /ca/services/:id/sub-services/:subServiceId/active`
* **Auth**: Bearer Token
* **Description**: Toggle active state of a sub-service.

---

## 4. WhatsApp Templates & Messaging

### `GET /whatsapp/templates`
* **Auth**: Bearer Token
* **Description**: Fetch all approved WhatsApp message templates.

### `POST /whatsapp/templates`
* **Auth**: Bearer Token
* **Description**: Create a new WhatsApp message template.

### `GET /conversations/:id`
* **Auth**: Bearer Token
* **Description**: Fetch conversation history for a given contact.

---

## 5. Knowledge Base Management

### Articles (`/ca/knowledge-base`)

#### `POST /ca/knowledge-base`
* **Auth**: Bearer Token
* **Payload**:
```json
{
  "title": "Corporate Compliance Handbook 2026",
  "category": "compliance",
  "tags": ["corporate", "roc", "annual-filing"],
  "summary": "Mandatory ROC compliance calendar and procedures.",
  "content": "# Corporate Compliance Guidelines\n\n1. Annual General Meeting (AGM)\n2. Form MGT-7\n3. Form AOC-4",
  "status": "published"
}
```

#### `GET /ca/knowledge-base`
* **Auth**: None / Optional
* **Query Params**: `q`, `category`, `tag`, `status`, `page`, `limit`, `sort`
* **Description**: Paginated search and filtering of articles.

#### `GET /ca/knowledge-base/categories`
* **Auth**: None / Optional
* **Description**: Distinct category list with total and published counts.

#### `GET /ca/knowledge-base/:id`
* **Auth**: None / Optional
* **Query Params**: `view=true` (increments view counter)
* **Description**: Fetch article by ObjectId or URL slug.

#### `PUT /ca/knowledge-base/:id`
* **Auth**: Bearer Token
* **Description**: Update title, content, tags, or metadata (audited in `KnowledgeLog`).

#### `DELETE /ca/knowledge-base/:id`
* **Auth**: Bearer Token
* **Description**: Remove an article (audited in `KnowledgeLog`).

#### `PATCH /ca/knowledge-base/:id/status`
* **Auth**: Bearer Token
* **Payload**: `{ "status": "archived" }`

---

### Tasks & Workflows (`/ca/knowledge-base/tasks`)

#### `POST /ca/knowledge-base/tasks`
* **Auth**: Bearer Token
* **Payload**:
```json
{
  "title": "Verify Transfer Pricing Documentation",
  "description": "Cross-check with latest CBDT notifications.",
  "taskType": "verification",
  "priority": "high",
  "dueDate": "2026-11-15"
}
```

#### `GET /ca/knowledge-base/tasks`
* **Auth**: Bearer Token
* **Query Params**: `status`, `priority`, `taskType`, `articleId`, `page`, `limit`

#### `GET /ca/knowledge-base/tasks/stats`
* **Auth**: Bearer Token
* **Description**: Grouped task counts by status and priority.

#### `PATCH /ca/knowledge-base/tasks/:id/status`
* **Auth**: Bearer Token
* **Payload**:
```json
{
  "status": "completed",
  "resolutionNotes": "Verified against CBDT Circular 14/2026."
}
```

#### `POST /ca/knowledge-base/tasks/run-maintenance`
* **Auth**: Bearer Token
* **Payload**: `{ "staleThresholdDays": 90 }`
* **Description**: Triggers worker to detect stale documents and overdue tasks.

---

### Audit & Activity Logs (`/ca/knowledge-base/logs`)

#### `GET /ca/knowledge-base/logs`
* **Auth**: Bearer Token
* **Query Params**: `action`, `entityType`, `entityId`, `status`, `startDate`, `endDate`, `page`, `limit`

#### `GET /ca/knowledge-base/logs/stats`
* **Auth**: Bearer Token
* **Description**: Activity aggregates grouped by action and entity type.
