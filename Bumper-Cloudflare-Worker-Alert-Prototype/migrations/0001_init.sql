PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  age_band TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_settings (
  child_id TEXT PRIMARY KEY,
  new_friends INTEGER NOT NULL DEFAULT 1,
  unknown_messages INTEGER NOT NULL DEFAULT 1,
  personal_info INTEGER NOT NULL DEFAULT 1,
  move_to_other_app INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (child_id) REFERENCES children(id)
);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  contact_handle_hash TEXT,
  description TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  reason TEXT NOT NULL,
  parent_action TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id)
);

CREATE INDEX IF NOT EXISTS idx_risk_events_child_created
ON risk_events(child_id, created_at DESC);

INSERT OR IGNORE INTO children (
  id,
  parent_id,
  display_name,
  age_band
) VALUES (
  'child_alex',
  'parent_demo',
  'Alex',
  'teen'
);

INSERT OR IGNORE INTO alert_settings (
  child_id,
  new_friends,
  unknown_messages,
  personal_info,
  move_to_other_app
) VALUES (
  'child_alex',
  1,
  1,
  1,
  1
);

INSERT OR IGNORE INTO risk_events (
  id,
  child_id,
  platform,
  event_type,
  contact_handle_hash,
  description,
  risk_score,
  risk_level,
  reason,
  parent_action,
  metadata_json
) VALUES (
  'alert_demo_1',
  'child_alex',
  'Roblox',
  'unknown_messages',
  'anon-contact-1',
  'Unknown user sent 18 messages in 10 minutes',
  85,
  'High',
  'New contact + high message frequency + asked to move to Discord',
  'Talk to child before blocking or reporting',
  '{"signals":["new_contact","high_frequency","move_to_other_app"],"messageCount":18,"windowMinutes":10}'
);
