export async function callChatCompletion({ apiKey, messages, endpoint, model }) {
  const resolvedKey = (apiKey || process.env.AI_API_KEY || "").trim();
  if (!resolvedKey) {
    throw new Error("API key is missing");
  }

  const defaultEndpoint = "https://api.openai.com/v1/chat/completions";
  const targetEndpoint = endpoint || process.env.AI_ENDPOINT || defaultEndpoint;
  const targetModel = model || process.env.AI_MODEL || "gpt-3.5-turbo";
  const isBrowser = typeof window !== "undefined";
  const usingOpenAIDirect = targetEndpoint.includes("api.openai.com");
  const proxyEndpoint = isBrowser && usingOpenAIDirect ? `http://localhost:${process.env.AI_PROXY_PORT || 8788}/chat` : null;
  // 브라우저에서 openai.com을 직접 두드리면 CORS가 막히므로, 가능하면 로컬 프록시로 우선 전송
  const finalEndpoint = proxyEndpoint || targetEndpoint;

  const doFetch = async (url) => {
    return fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: 0.4,
        max_tokens: 500
      })
    });
  };

  let res;
  try {
    res = await doFetch(finalEndpoint);
  } catch (err) {
    const corsHint = "브라우저에서 OpenAI를 직접 호출하면 CORS로 차단됩니다. ai-proxy.js 실행 또는 AI_ENDPOINT를 프록시로 지정하세요.";
    throw new Error(`AI 요청 실패: ${err.message}${usingOpenAIDirect ? ` (${corsHint})` : ""}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI 요청 실패: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI 응답이 비어 있습니다.");
  }
  return content;
}
