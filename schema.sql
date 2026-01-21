CREATE TABLE IF NOT EXISTS daily_fan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  club_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  member_name TEXT NOT NULL,
  fans INTEGER NOT NULL,
  created TEXT NOT NULL,
  unix_date INTEGER NOT NULL,
  UNIQUE(year, month, day, member_id)
);

CREATE TABLE IF NOT EXISTS club (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  leader TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS club_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  club_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  fans INTEGER NOT NULL,
  created TEXT NOT NULL,
  UNIQUE(year, month, day)
);

CREATE TABLE IF NOT EXISTS discord_message (
  discord_guild_id TEXT PRIMARY KEY,
  discord_text_channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_name ON daily_fan(member_name);
CREATE INDEX IF NOT EXISTS idx_year_month_name ON daily_fan(year, month, member_name);
CREATE INDEX IF NOT EXISTS idx_year_month_day ON daily_fan (year, month, day);
CREATE INDEX IF NOT EXISTS idx_club_year_month_day ON club_history (year, month, day);
