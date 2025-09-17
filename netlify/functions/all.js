// /.netlify/functions/all
// CommonJS style so you don't need "type":"module" in package.json

exports.handler = async (event) => {
  // Allow CORS (harmless if same origin) + handle preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      },
      body: ""
    };
  }

  try {
    // --- CONFIG: edit this list or read from a JSON file if you like ---
    const resorts = [
      { name: "cypress-mountain", lat: 49.395, lon: -123.205, bottomElevation: 910 },
      { name: "grouse-mountain",  lat: 49.380, lon: -123.082, bottomElevation: 853 },
      { name: "mt-seymour",       lat: 49.366, lon: -122.948, bottomElevation: 935 },
    ];
    const days = Math.min(parseInt(event.queryStringParameters?.days || "7", 10) || 7, 16);
    const timezone = "America/Vancouver";

    async function fetchOne(r) {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${r.lat}&longitude=${r.lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,windspeed_10m_max` +
        `&timezone=${encodeURIComponent(timezone)}&forecast_days=${days}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const j = await res.json();

      const N = j?.daily?.time?.length ?? 0;
      if (!N) throw new Error("No daily forecast returned");

      const temperatureBlocks = Array.from({ length: N }, (_, i) => [
        Math.round((j.daily.temperature_2m_max[i] + j.daily.temperature_2m_min[i]) / 2)
      ]);
      const snowBlocks = Array.from({ length: N }, (_, i) => [Number(j.daily.snowfall_sum?.[i] ?? 0)]);
      const rainBlocks = Array.from({ length: N }, (_, i) => [Number(j.daily.precipitation_sum?.[i] ?? 0)]);
      const windBlocks = Array.from({ length: N }, (_, i) => [Number(j.daily.windspeed_10m_max?.[i] ?? 0)]);
      const phrasesBlocks = Array.from({ length: N }, (_, i) => [
        snowBlocks[i][0] > 0 ? "Snow" : (rainBlocks[i][0] > 0 ? "Rain" : "Clear")
      ]);

      return {
        name: r.name,
        data: {
          success: true,
          bottomElevation: r.bottomElevation ?? null,
          temperatureBlocks,
          snowBlocks,
          rainBlocks,
          windBlocks,
          phrasesBlocks
          // If your UI expects it, you can later add: freezinglevelBlocks: [...]
        }
      };
    }

    const resortsData = await Promise.all(resorts.map(fetchOne));

    // Your frontend switches between bot/mid/top — reuse same data for now.
    const payload = {
      botData: { resorts: resortsData },
      midData: { resorts: resortsData },
      topData: { resorts: resortsData }
    };

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
