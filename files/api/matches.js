const fetch = require("node-fetch");

let cache = { date: null, matches: [] };

function today() {
  return new Date().toISOString().slice(0, 10);
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
  if (t.includes("lyon") || t.includes("cattolica") || t.includes("hamburg") || t.includes("bastad") || t.includes("umag") || t.includes("gstaad") || t.includes("kitzbuhel") || t.includes("roland")) return "Tierra";
  return "Pista Dura";
}

async function fetchMatches() {
  const date = today();
  // Tennis API - ATP WTA ITF endpoint
  const url = `https://tennis-api-atp-wta-itf.p.rapidapi.com/tennis/v2/atp/schedule/date/${date}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": "tennis-api-atp-wta-itf.p.rapidapi.com",
      "x-rapidapi-key": process.env.RAPIDAPI_KEY
    }
  });

  if (!res.ok) throw new Error(`RapidAPI error: ${res.status}`);
  return await res.json();
}

async function fetchMatchesWTA() {
  const date = today();
  const url = `https://tennis-api-atp-wta-itf.p.rapidapi.com/tennis/v2/wta/schedule/date/${date}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": "tennis-api-atp-wta-itf.p.rapidapi.com",
      "x-rapidapi-key": process.env.RAPIDAPI_KEY
    }
  });
  if (!res.ok) throw new Error(`RapidAPI WTA error: ${res.status}`);
  return await res.json();
}

function parseMatch(m, forcedType) {
  const home = m.home?.name || m.player1?.name || m.player_1?.name || "Jugador 1";
  const away = m.away?.name || m.player2?.name || m.player_2?.name || "Jugador 2";
  const tournament = m.tournament?.name || m.competition?.name || m.league?.name || "Torneo";
  const surface = getSurface(tournament);
  const type = forcedType || getTourType(tournament);

  // Skip doubles
  if (tournament.toLowerCase().includes("double")) return null;

  let status = "scheduled";
  const st = (m.status || m.match_status || m.state || "").toLowerCase();
  if (st.includes("live") || st.includes("progress") || st.includes("inplay") || st === "1st" || st === "2nd" || st === "3rd") status = "in_progress";
  else if (st.includes("finish") || st.includes("ended") || st.includes("final") || st === "ft" || st === "aot") status = "final";

  let score = null;
  let sets = [];
  if (m.scores || m.score) {
    const sc = m.scores || m.score;
    const s1 = parseInt(sc.home_score ?? sc.player_1_score ?? sc.home ?? 0);
    const s2 = parseInt(sc.away_score ?? sc.player_2_score ?? sc.away ?? 0);
    score = [s1, s2];
    for (let i = 1; i <= 5; i++) {
      const a = sc[`set_${i}_home`] ?? sc[`home_set_${i}`] ?? sc[`set${i}home`];
      const b = sc[`set_${i}_away`] ?? sc[`away_set_${i}`] ?? sc[`set${i}away`];
      if (a !== undefined && b !== undefined) sets.push([parseInt(a)||0, parseInt(b)||0]);
    }
  }

  return {
    id: String(m.id || m.match_id || Math.random()),
    status,
    teams: [{ name: home }, { name: away }],
    tournament,
    surface,
    type,
    score,
    sets
  };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (cache.date === today() && cache.matches.length > 0) {
    return res.status(200).json({ date: cache.date, matches: cache.matches, cached: true });
  }

  if (!process.env.RAPIDAPI_KEY) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured in Vercel Environment Variables" });
  }

  try {
    // Fetch ATP and WTA in parallel
    const [atpRaw, wtaRaw] = await Promise.allSettled([fetchMatches(), fetchMatchesWTA()]);

    let matches = [];

    if (atpRaw.status === "fulfilled") {
      const items = atpRaw.value?.results || atpRaw.value?.data || atpRaw.value || [];
      const parsed = (Array.isArray(items) ? items : []).map(m => parseMatch(m, null)).filter(Boolean);
      matches = matches.concat(parsed);
    }

    if (wtaRaw.status === "fulfilled") {
      const items = wtaRaw.value?.results || wtaRaw.value?.data || wtaRaw.value || [];
      const parsed = (Array.isArray(items) ? items : []).map(m => parseMatch(m, "wta")).filter(Boolean);
      matches = matches.concat(parsed);
    }

    // Deduplicate by id
    const seen = new Set();
    matches = matches.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });

    cache = { date: today(), matches };
    return res.status(200).json({ date: cache.date, matches, cached: false });

  } catch (err) {
    console.error("Error:", err.message);
    if (cache.matches.length > 0) {
      return res.status(200).json({ date: cache.date, matches: cache.matches, cached: true, stale: true });
    }
    return res.status(500).json({ error: err.message });
  }
};
