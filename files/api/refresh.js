// This endpoint is called daily at 6:00 UTC by Vercel Cron
// It just hits /api/matches to warm the cache
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  // Vercel cron sends GET with Authorization header
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow internal calls too
    if (!process.env.CRON_SECRET) {
      // no secret set, allow
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const host = req.headers.host || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const r = await fetch(`${protocol}://${host}/api/matches`);
    const data = await r.json();
    return res.status(200).json({
      ok: true,
      date: data.date,
      count: data.matches?.length || 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
