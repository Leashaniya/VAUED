import "dotenv/config";

const API_HOST = process.env.API_HOST || "127.0.0.1";
const API_PORT = process.env.API_PORT || process.env.PORT || "8888";
const API_KEY = process.env.API_KEY || "";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS || "1000");

if (!API_KEY) {
  console.error("Missing API_KEY. Set it in .env or shell env.");
  process.exit(1);
}

const BASE_URL = `http://${API_HOST}:${API_PORT}`;
const SENSOR_IDS = ["1", "2", "3", "4"];

const rand = (min, max) => min + Math.random() * (max - min);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildPayload(tick) {
  const t = tick * 0.05;
  return {
    "1": 22 + 3 * Math.sin(t) + rand(-0.3, 0.3), // temperature
    "2": 50 + 10 * Math.cos(t * 0.7) + rand(-0.3, 0.3), // humidity
    "3": 400 + 150 * Math.sin(t * 1.3) + rand(-6, 6), // wetness
    "4": Math.max(0, 200 + 300 * Math.abs(Math.sin(t * 2.1)) + rand(-20, 20)), // sound
  };
}

async function postReading(sensorId, reading) {
  const res = await fetch(`${BASE_URL}/api/readings/sensors/${sensorId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({ reading: Number(reading.toFixed(4)) }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sensor ${sensorId} -> HTTP ${res.status} ${txt}`);
  }
}

let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
  console.log("\nStopping simulator...");
});

console.log(`Simulator posting every ${INTERVAL_MS}ms to ${BASE_URL}`);
console.log("Press Ctrl+C to stop.");

let tick = 0;
while (!stopped) {
  const values = buildPayload(tick);
  try {
    await Promise.all(SENSOR_IDS.map((id) => postReading(id, values[id])));
    console.log(
      `tick ${tick} | t=${values["1"].toFixed(2)} h=${values["2"].toFixed(2)} w=${values["3"].toFixed(
        2
      )} s=${values["4"].toFixed(2)} | OK`
    );
  } catch (err) {
    console.error(`tick ${tick} | FAIL`, err instanceof Error ? err.message : String(err));
  }
  tick += 1;
  await sleep(INTERVAL_MS);
}