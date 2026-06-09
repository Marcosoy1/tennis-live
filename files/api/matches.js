const fetch = require("node-fetch");

// In-memory cache (resets on cold start, but fine for daily use)
let cache = {
  date: null,
  matches: []
};

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getTourType(tournament = "") {
  const t = tournament.toUpperCase();
  if (t.includes("WTA") || t.includes("WOMEN")) return "wta";
  if (t.includes("CHALLENGER")) return "ch";
  return "atp";
}

function getSurface(tournament = "") {
  const t = tournament.toLowerCase();
  if (t.includes("stuttgart") || t.includes("hertogenbosch") || t.includes("ilkley") || t.includes("wimbledon") || t.includes("queen")) return "Hierba";
  if (t.includes("lyon") || t.includes("cattolica") || t.includes("roland") || t.includes("hamburg") || t.includes("bastad") || t.includes("umag") || t.includes("gstaad") || t.includes("kitzbuhel") || t.includes("umag") || t.includes("mercedes")) return "Tierra";
  return "Pista Dura";
}

async function fetchFromRapidAPI() {
  const date = today();
  const url = `https://api-tennis.p.rapidapi.com/matches?date=${date}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": "api-tennis.p.rapidapi.com",
      "x-rapidapi-key": process.env.RAPIDAPI_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

function parseMatches(rawData) {
  // api-tennis returns { result: [...] }
  const items = rawData.result || rawData || [];
  const singles = items.filter(m => {
    const name = (m.tournament?.name || m.league?.name || "").toLowerCase();
    // Only singles, skip doubles and futures/ITF low level
    return !name.includes("double") && !name.includes("itf") && !name.includes("utr");
  });

  return singles.map((m, idx) => {
    const home = m.home?.name || m.player_1?.name || "Jugador 1";
    const away = m.away?.name || m.player_2?.name || "Jugador 2";
    const tournament = m.tournament?.name || m.league?.name || "Torneo";
    const surface = getSurface(tournament);
    const type = getTourType(tournament);

    // Status mapping
    let status = "scheduled";
    const st = (m.status || m.match_status || "").toLowerCase();
    if (st.includes("live") || st.includes("progress") || st.includes("inplay")) status = "in_progress";
    else if (st.includes("finish") || st.includes("ended") || st.includes("ft") || st.includes("final")) status = "final";

    // Score
    let score = null;
    let sets = [];
    if (m.scores) {
      const sc = m.scores;
      const s1 = parseInt(sc.home_score || sc.player_1_score || 0);
      const s2 = parseInt(sc.away_score || sc.player_2_score || 0);
      score = [s1, s2];
      // Parse sets
      for (let i = 1; i <= 5; i++) {
        const set1 = sc[`set_${i}_home`] ?? sc[`set${i}_home`] ?? sc[`home_set${i}`];
        const set2 = sc[`set_${i}_away`] ?? sc[`set${i}_away`] ?? sc[`away_set${i}`];
        if (set1 !== undefined && set2 !== undefined && (set1 !== 0 || set2 !== 0)) {
          sets.push([parseInt(set1), parseInt(set2)]);
        }
      }
    }

    return {
      id: m.id || m.match_id || `m${idx}`,
      status,
      teams: [{ name: home }, { name: away }],
      tournament,
      surface,
      type,
      score,
      sets
    };
  });
}

module.exports = async (req, res) => {
  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Return cached if same day
  if (cache.date === today() && cache.matches.length > 0) {
    return res.status(200).json({
      date: cache.date,
      matches: cache.matches,
      cached: true
    });
  }

  if (!process.env.RAPIDAPI_KEY) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not set in environment variables" });
  }

  try {
    const raw = await fetchFromRapidAPI();
    const matches = parseMatches(raw);
    cache = { date: today(), matches };
    return res.status(200).json({ date: cache.date, matches, cached: false });
  } catch (err) {
    console.error("Fetch error:", err.message);
    // Return stale cache if available
    if (cache.matches.length > 0) {
      return res.status(200).json({ date: cache.date, matches: cache.matches, cached: true, stale: true });
    }
    return res.status(500).json({ error: err.message });
  }
};
