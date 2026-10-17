CREATE TABLE IF NOT EXISTS challenges (
  nonce text PRIMARY KEY, wallet text NOT NULL, message text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, wallet text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY, wallet text NOT NULL, installation uuid NOT NULL,
  request_key text NOT NULL, kind text NOT NULL CHECK(kind IN ('score','boosters')),
  lamports bigint NOT NULL CHECK(lamports > 0), treasury text NOT NULL,
  reference text NOT NULL UNIQUE, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),
  signature text UNIQUE, transaction_base64 text, blockhash text, last_valid_height bigint,
  created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz,
  UNIQUE(wallet,request_key)
);
CREATE INDEX IF NOT EXISTS orders_wallet_installation ON orders(wallet,installation,created_at DESC);
CREATE TABLE IF NOT EXISTS scores (
  wallet text NOT NULL, level integer NOT NULL CHECK(level BETWEEN 1 AND 100),
  score integer NOT NULL CHECK(score >= 0), stars integer NOT NULL,
  assisted boolean NOT NULL, order_id uuid NOT NULL REFERENCES orders(id),
  achieved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(wallet,level)
);
CREATE INDEX IF NOT EXISTS scores_level_ranking ON scores(level,score DESC,achieved_at);
