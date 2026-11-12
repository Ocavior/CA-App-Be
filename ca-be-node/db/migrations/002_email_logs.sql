-- Email logs for mail sent directly over Gmail SMTP (EmailApiService, when no
-- EMAIL_SERVICE_URL is configured). Shaped like the items the external email
-- service returned from /emailLogs, so GET /emailLogs responds the same way.

CREATE TABLE email_logs (
  id            TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
  app_code      TEXT,
  email_message TEXT,
  recipients    JSON NOT NULL DEFAULT '[]',
  subject       TEXT,
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  -- { provider, messageId } on success, { provider, error } on failure
  email_details JSON,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_logs_created_at_idx ON email_logs (created_at DESC);
