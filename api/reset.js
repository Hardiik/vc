const { redis, IDS, cors, resetCounts, snapshot } = require("../lib/redis");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "not found" });

  const d = req.body || {};
  if (!IDS.includes(d.ballot)) return res.status(400).json({ error: "unknown ballot" });

  await resetCounts(d.ballot);
  await redis.incr("rev");
  res.status(200).json(await snapshot());
};
