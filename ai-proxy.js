// Very small proxy to call OpenAI from the browser without CORS issues.
// Run with `node ai-proxy.js` (or set AI_PROXY_PORT). Point AI_ENDPOINT to http://localhost:8788/chat.
const http = require("http");
const { fetch } = require("undici");

const PORT = process.env.AI_PROXY_PORT || 8788;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url !== "/chat" || req.method !== "POST") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      const apiKey = payload.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing API key (set AI_API_KEY env or send apiKey in body)" }));
        return;
      }

      const upstream = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: payload.model || process.env.AI_MODEL || "gpt-3.5-turbo",
          messages: payload.messages || [],
          temperature: payload.temperature ?? 0.4,
          max_tokens: payload.max_tokens ?? 500
        })
      });

      const data = await upstream.json();
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error("AI proxy error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Proxy error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}/chat`);
});
