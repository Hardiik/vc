const { redis, IDS, cors, snapshot } = require("../lib/redis");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "not found" });

  const d = req.body || {};
  if (!IDS.includes(d.ballot)) return res.status(400).json({ error: "unknown ballot" });

  const v = parseInt(d.value, 10);
  if (isFinite(v) && v >= 0) await redis.hset("expected", { [d.ballot]: v });
  else await redis.hdel("expected", d.ballot);

  await redis.incr("rev");
  res.status(200).json(await snapshot());
};
