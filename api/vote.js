const { redis, IDS, cors, incrCount, claimSeq, snapshot } = require("../lib/redis");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "not found" });

  const d = req.body || {};
  const clientId = String(d.clientId || "").slice(0, 64) || "anon";
  const seq = parseInt(d.seq, 10);
  if (!isFinite(seq) || seq < 1) return res.status(400).json({ error: "missing seq" });

  const isNew = await claimSeq(clientId, seq);
  if (!isNew) {
    const snap = await snapshot();
    snap.duplicate = true;
    return res.status(200).json(snap);
  }

  const ops = Array.isArray(d.ops) ? d.ops : [];
  let applied = 0;
  let lastBallot = null;

  for (const o of ops) {
    let id, i, delta;
    if (Array.isArray(o)) { [id, i, delta] = o; } else { id = o.b; i = o.i; delta = o.d; }
    if (!IDS.includes(id)) continue;
    i = parseInt(i, 10);
    delta = parseInt(delta, 10);
    if (!isFinite(i) || i < 0) continue;
    if (!isFinite(delta) || delta === 0 || Math.abs(delta) > 1000) continue;
    await incrCount(id, i, delta);
    applied++;
    lastBallot = id;
  }

  if (applied) {
    await redis.incr("rev");
    if (lastBallot) await redis.set("active", lastBallot);
  }

  const snap = await snapshot();
  snap.applied = applied;
  res.status(200).json(snap);
};
