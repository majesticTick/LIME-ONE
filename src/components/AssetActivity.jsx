import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import bnbLogo from "../assets/bnb-chain.png";
import { bnbLogoDataUrl } from "../assets/bnbLogoData";
import { CHAIN_ID, WBNB, BUSD, NATIVE_SYMBOL, WRAPPED_SYMBOL, EXPLORER_TX_BASE } from "../config";
import { callChatCompletion } from "../utils/aiClient";

// 조회할 토큰들 (BSC Testnet 기준)
const TOKENS = [
  { symbol: NATIVE_SYMBOL || "BNB", address: null, decimals: 18 }, // native
  { symbol: WRAPPED_SYMBOL || "WBNB", address: WBNB, decimals: 18 },
  { symbol: "BUSD", address: BUSD, decimals: 18 }
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const TOKEN_ICONS = {
  [NATIVE_SYMBOL || "BNB"]: { img: bnbLogo, fallback: bnbLogoDataUrl },
  [WRAPPED_SYMBOL || "WBNB"]: { img: bnbLogo, fallback: bnbLogoDataUrl }
};

export default function AssetActivity({ provider, account, tokenList = [], language = "ko", activityLog = [] }) {
  const [balances, setBalances] = useState({});
  const [statusKey, setStatusKey] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [expandedToken, setExpandedToken] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSig, setAiSig] = useState("");
  const txt = {
    ko: {
      title: "내 자산",
      connect: "상단에서 지갑을 먼저 연결해주세요.",
      loading: "자산 정보를 불러오는 중...",
      loadError: "자산 정보를 불러오는 중 오류가 발생했습니다.",
      activityTitle: "활동 내역",
      activityDesc: "최근 스왑 기록이 여기에 표시됩니다.",
      noActivity: "아직 활동 내역이 없습니다.",
      noInfo: "정보 없음",
      viewMore: "자세히 보기",
      viewLess: "닫기",
      txType: "거래유형",
      balanceChange: "토큰 잔고 변화",
      noChange: "변화 정보 없음",
      from: "보낸 주소",
      to: "받는 주소",
      viewOnExplorer: "블록 탐색기에서 보기",
      aiTitle: "AI 포트폴리오 요약",
      aiHint: "보유 토큰과 최근 활동을 기반으로 간단히 요약합니다.",
      aiNeedKey: "AI 키가 설정되지 않았습니다. 우측 하단 챗봇에서 입력하세요.",
      aiLoading: "AI가 포트폴리오를 분석 중...",
      aiFailed: "AI 요약에 실패했습니다.",
      chartTitle: "보유 비율",
      chartEmpty: "보유 중인 토큰이 없습니다."
    },
    en: {
      title: "My Assets",
      connect: "Please connect your wallet above.",
      loading: "Loading assets...",
      loadError: "Failed to load assets.",
      activityTitle: "Activity",
      activityDesc: "Recent swaps will appear here.",
      noActivity: "No activity yet.",
      noInfo: "No info",
      viewMore: "Details",
      viewLess: "Close",
      txType: "Type",
      balanceChange: "Balance change",
      noChange: "No change data",
      from: "From",
      to: "To",
      viewOnExplorer: "View in explorer",
      aiTitle: "AI Portfolio Summary",
      aiHint: "Brief summary using your holdings and recent activity.",
      aiNeedKey: "AI key is not set. Enter it via the chat widget.",
      aiLoading: "AI is analyzing your portfolio...",
      aiFailed: "Failed to get AI summary.",
      chartTitle: "Holdings Ratio",
      chartEmpty: "No tokens held."
    }
  }[language] || {};
  const isLight = typeof document !== "undefined" && document.body?.dataset?.theme === "light";
  const statusText = statusKey === "loading" ? txt.loading : statusKey === "error" ? txt.loadError : "";

  // 자산 잔액만 로드 (에러는 내부 처리)
  useEffect(() => {
    if (!provider || !account) {
      setBalances({});
      setStatusKey("");
      setAiSummary("");
      return;
    }

    let cancelled = false;

    const loadBalances = async () => {
      try {
        setStatusKey("loading");

        const result = {};

        for (const t of TOKENS) {
          try {
            if (t.address === null) {
              // native BNB
              const bal = await provider.getBalance(account);
              result[t.symbol] = ethers.utils.formatEther(bal);
            } else {
              const c = new ethers.Contract(t.address, ERC20_ABI, provider);
              const [raw, dec] = await Promise.all([
                c.balanceOf(account),
                c.decimals().catch(() => 18)
              ]);
              const formatted = ethers.utils.formatUnits(raw, dec);
              result[t.symbol] = formatted;
            }
          } catch (e) {
            // 개별 토큰 실패 시 0 처리
            result[t.symbol] = "0.0";
          }
        }

        if (!cancelled) {
          setBalances(result);
          setStatusKey("");
        }
      } catch (e) {
        if (!cancelled) {
          setStatusKey("error");
          setBalances({});
        }
      }
    };

    loadBalances();

    return () => {
      cancelled = true;
    };
  }, [provider, account]);

  // AI 요약
  useEffect(() => {
    if (!account) {
      setAiSummary("");
      return;
    }
    const aiKey = (typeof window !== "undefined" && window.localStorage.getItem("limeone.aiKey")) || process.env.AI_API_KEY;
    if (!aiKey) {
      setAiSummary(txt.aiFailed);
      return;
    }

    // holdings 문자열 및 최근 활동 요약
    const holdings = Object.keys(balances)
      .map((k) => `${k}: ${Number(balances[k] || 0).toFixed(6)}`)
      .join(", ");
    const recent = activityLog.slice(0, 3).map((a) => `${a.type || "tx"} - ${a.detail || ""} @ ${a.time || ""}`).join(" | ");
    const sig = `${holdings}-${recent}`;
    if (sig === aiSig) return;
    setAiSig(sig);

    const prompt = [
      `[Portfolio summary request]`,
      `Holdings: ${holdings || "none"}`,
      `Recent activity: ${recent || "none"}`,
      `Chain: ${CHAIN_ID === 56 ? "BSC Mainnet" : "BSC Testnet"}`,
      `Please provide 2-3 concise bullet points about diversification, concentration, and simple risk notes. Avoid financial advice claims. Respond in the same language (ko/en).`
    ].join("\n");

    const run = async () => {
      try {
        setAiLoading(true);
        setAiError("");
        const resp = await callChatCompletion({
          apiKey: aiKey,
          messages: [
            { role: "system", content: "You are a concise portfolio explainer. Keep to 2-3 short bullet lines, no financial advice." },
            { role: "user", content: prompt }
          ]
        });
        setAiSummary(resp);
      } catch (e) {
        console.error(e);
        setAiError(txt.aiFailed);
        setAiSummary("");
      } finally {
        setAiLoading(false);
      }
    };
    run();
  }, [account, balances, activityLog, txt.aiNeedKey, txt.aiFailed]);

  return (
    <div
      style={{
        width: "min(100%,950px)",
        display: "flex",
        gap: 20,
        alignItems: "flex-start"
      }}
    >
      {/* 왼쪽: 보유 자산 */}
      <div className="card" style={{ flex: 1, padding: 20 }}>
        <h2>{txt.title}</h2>

        {!account && (
          <p style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
            {txt.connect}
          </p>
        )}

        {account && statusText && (
          <p style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{statusText}</p>
        )}

        {account &&
          TOKENS.map((t) => {
            const isOpen = expandedToken === t.symbol;
            return (
              <div
                key={t.symbol}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginTop: 10,
                  border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.06)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {renderTokenIcon(t.symbol)}
                  <span style={{ fontWeight: 600 }}>{t.symbol}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>
                    {isOpen
                      ? (balances[t.symbol] ?? "0.0")
                      : Number(balances[t.symbol] || 0).toFixed(4)}
                  </span>
                  <button
                    style={{
                      padding: "4px 9px",
                      borderRadius: 6,
                      border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      color: isLight ? "#0f172a" : "#e5e7eb",
                      cursor: "pointer",
                      fontSize: 11
                    }}
                    onClick={() => setExpandedToken(isOpen ? null : t.symbol)}
                  >
                    {isOpen ? txt.viewLess : txt.viewMore}
                  </button>
                </div>
              </div>
            );
          })}

        {/* 보유 비율 차트 */}
        {account && (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.08)", background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{txt.chartTitle}</h3>
            </div>
            <HoldingsPie balances={balances} />
            {Object.values(balances || {}).every((v) => Number(v || 0) === 0) && (
              <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af", marginTop: 8 }}>{txt.chartEmpty}</div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.08)", background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{txt.aiTitle}</h3>
          </div>
          <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{txt.aiHint}</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {aiLoading ? txt.aiLoading : (aiSummary || txt.aiNeedKey)}
          </div>
          {aiError && <div style={{ fontSize: 12, color: "#ef4444" }}>{aiError}</div>}
        </div>
      </div>

      {/* 오른쪽: 활동 내역 (현재는 안내용) */}
      <div className="card" style={{ width: 320, padding: 20 }}>
        <h2>{txt.activityTitle}</h2>
        <p style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af", lineHeight: 1.6, marginTop: 0 }}>
          {txt.activityDesc}
        </p>
        {activityLog.length === 0 ? (
          <p style={{ fontSize: 12, color: isLight ? "#9ca3af" : "#9ca3af" }}>{txt.noActivity}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxHeight: 280, overflowY: "auto", paddingRight: 6 }}>
                {activityLog.map((a) => {
                  const explorerBase = EXPLORER_TX_BASE || (CHAIN_ID === 56 ? "https://bscscan.com/tx/" : "https://testnet.bscscan.com/tx/");
              const isExpanded = expandedId === a.id;
              const cleanType = (a.type || "TRANSACTION").replace(/[_/]/g, " ").toUpperCase();
              return (
                <div
                  key={a.id}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
                    border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: isLight ? "#0f172a" : "#f9fafb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cleanType}
                    </div>
                    <div style={{ fontWeight: 600, color: isLight ? "#0f172a" : "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.detail || txt.noInfo}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: isLight ? "#0f172a" : "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.time || ""}
                      </span>
                      <button
                        style={{
                          padding: "4px 9px",
                          borderRadius: 6,
                          border: "1px solid rgba(148,163,253,0.35)",
                          background: "transparent",
                          color: isLight ? "#0f172a" : "#e5e7eb",
                          cursor: "pointer",
                          fontSize: 11
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        {isExpanded ? txt.viewLess : txt.viewMore}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        padding: "7px 9px",
                        borderRadius: 7,
                        background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                        border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{txt.txType}</div>
                      <div style={{ fontWeight: 600 }}>{cleanType}</div>

                      <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af", marginTop: 4 }}>{txt.balanceChange}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {(a.changes || []).map((c, idx) => (
                          <span key={idx} style={{ fontSize: 12, color: isLight ? "#0f172a" : "#e5e7eb" }}>
                            {c.token}: {c.change}
                          </span>
                        ))}
                        {(a.changes || []).length === 0 && (
                          <span style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{txt.noChange}</span>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, fontSize: 12 }}>
                        <span style={{ color: isLight ? "#6b7280" : "#9ca3af" }}>{txt.from}</span>
                        <span style={{ wordBreak: "break-all" }}>{a.from || "-"}</span>
                        <span style={{ color: isLight ? "#6b7280" : "#9ca3af" }}>{txt.to}</span>
                        <span style={{ wordBreak: "break-all" }}>{a.to || "-"}</span>
                      </div>

                      {a.txHash && (
                        <a
                          href={`${explorerBase}${a.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "#3b82f6", marginTop: 6 }}
                        >
                          {txt.viewOnExplorer}
                        </a>
                      )}
                      {a.pairAddress && (
                        <span style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
                          LP Pair: {a.pairAddress}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function renderTokenIcon(sym) {
  const meta = TOKEN_ICONS[sym] || {};
  if (meta.img) {
    return (
      <img
        src={meta.img}
        alt={sym}
        width={26}
        height={26}
        style={{ borderRadius: "50%", objectFit: "cover", display: "block" }}
        onError={(e) => {
          if (meta.fallback && e?.target?.src !== meta.fallback) e.target.src = meta.fallback;
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #ffb347, #ff751f)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#0b0f25",
        fontWeight: 700,
        fontSize: 12
      }}
    >
      {sym?.[0] || "?"}
    </div>
  );
}

function HoldingsPie({ balances }) {
  const palette = ["#6366f1", "#22c55e", "#f97316", "#06b6d4", "#f43f5e", "#a855f7"];
  const DECIMALS = TOKENS.reduce((acc, t) => {
    acc[t.symbol] = t.decimals ?? 18;
    return acc;
  }, {});

  const entries = Object.entries(balances || {})
    .map(([sym, val]) => {
      try {
        const dec = DECIMALS[sym] ?? 18;
        const raw = ethers.utils.parseUnits(String(val || "0"), dec);
        return { sym, raw };
      } catch {
        return { sym, raw: ethers.BigNumber.from(0) };
      }
    })
    .filter((e) => !e.raw.isZero())
    .sort((a, b) => {
      if (a.raw.eq(b.raw)) return 0;
      return a.raw.lt(b.raw) ? 1 : -1;
    });

  const total = entries.reduce((sum, e) => sum.add(e.raw), ethers.BigNumber.from(0));
  if (total.isZero()) return null;

  let currentAngle = -Math.PI / 2; // start at top for readability
  const wedges = entries.map((e, idx) => {
    const pctNum = e.raw.mul(10000).div(total).toNumber() / 100; // % with 2 decimals
    const pct = pctNum / 100;
    const start = currentAngle;
    const end = currentAngle + pct * 2 * Math.PI;
    currentAngle = end;

    const largeArc = end - start > Math.PI ? 1 : 0;
    const x1 = 50 + 46 * Math.cos(start);
    const y1 = 50 + 46 * Math.sin(start);
    const x2 = 50 + 46 * Math.cos(end);
    const y2 = 50 + 46 * Math.sin(end);
    const path = `M50,50 L${x1},${y1} A46,46 0 ${largeArc} 1 ${x2},${y2} Z`;

    return { path, color: palette[idx % palette.length], pct: pctNum.toFixed(1), sym: e.sym };
  });

  const topPct = wedges[0]?.pct || "0";

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <svg viewBox="0 0 100 100" width="160" height="160" style={{ flexShrink: 0 }}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="2" />
        {wedges.map((w, idx) => (
          <path key={idx} d={w.path} fill={w.color} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
        ))}
        <circle cx="50" cy="50" r="22" fill="#ffffff" opacity="0.9" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#0f172a" fontWeight="700">
          {topPct}%
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140, fontSize: 12 }}>
        {wedges.map((w, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: w.color }} />
            <span style={{ fontWeight: 700 }}>{w.sym}</span>
            <span style={{ color: "#6b7280" }}>{w.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
