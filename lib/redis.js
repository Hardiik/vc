// Thin wrapper around @upstash/redis, plus the small pieces of shared
// logic every /api function needs (loading ballots.json, building a
// snapshot, CORS headers). Kept in one file to keep the functions short.

const { Redis } = require("@upstash/redis");
const CFG = require("../ballots.json");

const redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL / _TOKEN

const IDS = CFG.ballots.map((b) => b.id);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

function countsKey(ballotId) {
  return `counts:${ballotId}`;
}

// Atomic, clamped-at-zero increment of one candidate's count. Using a
// Lua script (EVAL) means concurrent votes from several tablets can
// never race each other into a wrong number, and a count can never go
// negative — same guarantee the original file-based server gave you.
const INCR_SCRIPT = `
local cur = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
local v = cur + tonumber(ARGV[2])
if v < 0 then v = 0 end
redis.call('HSET', KEYS[1], ARGV[1], v)
return v
`;

async function incrCount(ballotId, index, delta) {
  return redis.eval(INCR_SCRIPT, [countsKey(ballotId)], [String(index), String(delta)]);
}

async function resetCounts(ballotId) {
  const names = CFG.ballots.find((b) => b.id === ballotId).names;
  const zeros = {};
  names.forEach((_, i) => { zeros[i] = 0; });
  await redis.del(countsKey(ballotId));
  await redis.hset(countsKey(ballotId), zeros);
}

async function getCounts(ballotId) {
  const names = CFG.ballots.find((b) => b.id === ballotId).names;
  const h = (await redis.hgetall(countsKey(ballotId))) || {};
  return names.map((_, i) => Number(h[i]) || 0);
}

async function snapshot() {
  const b = {};
  for (const ballot of CFG.ballots) {
    const counts = await getCounts(ballot.id);
    const expected = await redis.hget("expected", ballot.id);
    b[ballot.id] = { counts, expected: expected === null || expected === undefined ? null : Number(expected) };
  }
  const rev = Number((await redis.get("rev")) || 0);
  const active = (await redis.get("active")) || IDS[0];
  return { rev, active, b, t: Date.now() };
}

// Idempotency: one key per (clientId, seq). SETNX-style "set if absent"
// means duplicates and out-of-order retries are both handled correctly
// with no extra bookkeeping — simpler and more robust than a rolling
// sequence window, and it's what actually matters for this app: never
// double-count the same tap, regardless of what order requests land in.
async function claimSeq(clientId, seq) {
  const key = `seen:${clientId}:${seq}`;
  // NX = only set if not already present; EX = expire after 30 days so
  // the key space doesn't grow forever.
  const res = await redis.set(key, 1, { nx: true, ex: 60 * 60 * 24 * 30 });
  return res !== null; // true = we just claimed it (not a duplicate)
}

module.exports = {
  redis, CFG, IDS, cors, incrCount, resetCounts, getCounts, snapshot, claimSeq,
};
