const { CFG, cors } = require("../lib/redis");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  res.status(200).json(CFG);
};
