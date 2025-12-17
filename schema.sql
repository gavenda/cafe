CREATE TABLE IF NOT EXISTS daily_fan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  member_name TEXT NOT NULL,
  fans INTEGER NOT NULL,
  created TEXT NOT NULL,
  UNIQUE(year, month, day, member_id)
);

CREATE TABLE IF NOT EXISTS club_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  fans INTEGER NOT NULL,
  created TEXT NOT NULL,
  UNIQUE(year, month, day)
);

CREATE INDEX IF NOT EXISTS idx_year_month_day ON daily_fan (year, month, day);
CREATE INDEX IF NOT EXISTS idx_club_year_month_day ON club_history (year, month, day);
