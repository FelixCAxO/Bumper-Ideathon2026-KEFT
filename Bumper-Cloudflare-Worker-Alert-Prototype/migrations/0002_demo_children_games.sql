PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS child_game_status (
  child_id TEXT PRIMARY KEY,
  current_game_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id)
);

INSERT OR IGNORE INTO children (
  id,
  parent_id,
  display_name,
  age_band
) VALUES
  ('child_maya', 'parent_demo', 'Maya', 'teen'),
  ('child_jordan', 'parent_demo', 'Jordan', 'teen');

INSERT OR IGNORE INTO alert_settings (
  child_id,
  new_friends,
  unknown_messages,
  personal_info,
  move_to_other_app
) VALUES
  ('child_alex', 1, 1, 1, 1),
  ('child_maya', 1, 1, 1, 1),
  ('child_jordan', 1, 1, 1, 1);

INSERT OR IGNORE INTO child_game_status (
  child_id,
  current_game_id
) VALUES
  ('child_alex', 'roblox'),
  ('child_maya', 'fortnite'),
  ('child_jordan', 'apex_legends');
