const { cors, snapshot } = require("../lib/redis");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    res.status(200).json(await snapshot());
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
