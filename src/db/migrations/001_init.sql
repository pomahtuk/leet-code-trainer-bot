CREATE TABLE lc_users (
  telegram_id  BIGINT PRIMARY KEY,
  username     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  settings     JSONB DEFAULT '{}'
);

CREATE TABLE lc_attempts (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT REFERENCES lc_users(telegram_id),
  problem_id   INT NOT NULL,
  quiz_index   INT NOT NULL,
  selected     INT NOT NULL,
  correct      BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lc_user_stats (
  telegram_id    BIGINT PRIMARY KEY REFERENCES lc_users(telegram_id),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_correct  INT DEFAULT 0,
  total_attempts INT DEFAULT 0,
  xp             INT DEFAULT 0,
  last_active    DATE
);

CREATE TABLE lc_sessions (
  telegram_id  BIGINT PRIMARY KEY REFERENCES lc_users(telegram_id),
  problem_id   INT NOT NULL,
  quiz_index   INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_lc_attempts_user ON lc_attempts(telegram_id);
CREATE INDEX idx_lc_attempts_problem ON lc_attempts(problem_id);
