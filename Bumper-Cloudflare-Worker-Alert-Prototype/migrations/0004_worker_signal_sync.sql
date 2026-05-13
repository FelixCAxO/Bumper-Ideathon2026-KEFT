PRAGMA foreign_keys = ON;

ALTER TABLE risk_events ADD COLUMN event_id TEXT;
ALTER TABLE risk_events ADD COLUMN is_parent_visible INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_events_child_event_id
ON risk_events(child_id, event_id)
WHERE event_id IS NOT NULL;
