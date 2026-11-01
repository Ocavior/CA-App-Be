-- Initial PostgreSQL schema, mirroring the former Mongoose models.
--
-- Choices made to keep the HTTP API byte-compatible with the MongoDB version
-- (see MIGRATION_NOTES.md, "MongoDB to PostgreSQL"):
--   * Primary keys stay 24-hex ObjectId strings, so existing URLs, frontend
--     state and issued JWTs (which carry userId) keep working.
--   * JSON, not JSONB: JSONB reorders object keys, which would change the key
--     order of `services`/`bodyParams` in API responses.
--   * "version" is Mongoose's __v and is exposed under that name by the models.

CREATE TABLE admins (
  id               TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  username         TEXT NOT NULL UNIQUE,
  password         TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  -- Mongo's non-sparse unique index allows only ONE document with a missing
  -- phoneNumber. NULLS NOT DISTINCT preserves that (a plain UNIQUE would not).
  phone_number     TEXT UNIQUE NULLS NOT DISTINCT,
  application_code TEXT DEFAULT 'CaApp',
  is_active        BOOLEAN,
  role             TEXT NOT NULL DEFAULT 'operational' CHECK (role IN ('admin', 'operational')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  version          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE services (
  id         TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  name       TEXT NOT NULL,
  alias      TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('seed', 'manual', 'csv_import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sub_services (
  id                 TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  service_id         TEXT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  -- Array position in the old embedded subServices array; API order depends on it.
  position           INTEGER NOT NULL,
  name               TEXT NOT NULL,
  alias              TEXT NOT NULL,
  is_offered_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  source             TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('seed', 'manual', 'csv_import')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sub_services_service_id_position_idx ON sub_services (service_id, position);

CREATE TABLE ca_submissions (
  id                         TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  "timestamp"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  name                       TEXT NOT NULL,
  mobile                     TEXT,
  mobile_last10              TEXT,
  email                      TEXT,
  new_email                  TEXT,
  whatsapp_number            TEXT,
  state                      TEXT,
  city                       TEXT,
  other_branches             TEXT[] NOT NULL DEFAULT '{}',
  top3_services              TEXT[] NOT NULL DEFAULT '{}',
  -- { "<service alias>": { offered, details, subServices: { "<alias>": bool } } }
  services                   JSON NOT NULL DEFAULT '{}',
  foreign_which_country      TEXT,
  govt_subsidies_which_state TEXT,
  other_services             TEXT,
  remarks                    TEXT,
  project_help_details       TEXT,
  employer                   TEXT,
  form_filed_by              TEXT,
  source                     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'api', 'web_form')),
  imported_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data                   JSON,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  version                    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ca_submissions_timestamp_idx      ON ca_submissions ("timestamp" DESC);
CREATE INDEX ca_submissions_name_mobile_idx    ON ca_submissions (name, mobile);
CREATE INDEX ca_submissions_mobile_idx         ON ca_submissions (mobile);
CREATE INDEX ca_submissions_mobile_last10_idx  ON ca_submissions (mobile_last10);
CREATE INDEX ca_submissions_email_idx          ON ca_submissions (email);
CREATE INDEX ca_submissions_state_city_idx     ON ca_submissions (state, city);
CREATE INDEX ca_submissions_city_idx           ON ca_submissions (city);
CREATE INDEX ca_submissions_created_at_idx     ON ca_submissions (created_at DESC);
CREATE INDEX ca_submissions_source_created_idx ON ca_submissions (source, created_at DESC);

CREATE TABLE whatsapp_templates (
  id            TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  template_name TEXT NOT NULL UNIQUE,
  preview       TEXT NOT NULL,
  -- [{ label, type }]
  body_params   JSON NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX whatsapp_templates_created_at_idx ON whatsapp_templates (created_at DESC);
