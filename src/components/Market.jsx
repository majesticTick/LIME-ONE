// src/components/Market.jsx
import React, { useEffect, useState } from "react";

// 무료 공개 API 기반: 가격/시총은 CoinGecko, 공포탐욕은 alternative.me
const COINGECKO_IDS = ["bitcoin", "ethereum", "binancecoin", "solana", "tether", "usd-coin"];

export default function Market({ language = "ko" }) {
  const isLight = typeof document !== "undefined" && document.body?.dataset?.theme === "light";
  const rowBorder = `1px solid ${isLight ? "#d1d5db" : "#1f2633"}`;
  const txt = {
    ko: {
      fgTitle: "피어앤그리드 인덱스",
      fgDesc: "alternative.me F&G API 실시간 지표",
      fgLoading: "지표 불러오는 중",
      fgError: "지표를 불러오지 못했습니다. 데모 값으로 표시합니다.",
      latest: "최신값",
      updated: "업데이트",
      marketTitle: "시장상황",
      marketDesc: "CoinGecko Global 데이터",
      mcap: "총 시총",
      mcapChange: "24h 시총 변동",
      volume: "24h 거래량",
      btcDom: "BTC Dominance",
      priceTitle: "코인 시세",
      priceDesc: "CoinGecko 무료 API (USD 기준)",
      priceLoading: "불러오는 중...",
      priceError: "시세를 불러오지 못했습니다. 데모 값으로 표시합니다.",
      globalLoading: "불러오는 중...",
      globalError: "글로벌 시총을 불러오지 못했습니다. 데모 값으로 표시합니다.",
      assets: "자산",
      price: "가격",
      change24h: "24h",
      mcapCol: "시총"
    },
    en: {
      fgTitle: "Fear & Greed Index",
      fgDesc: "alternative.me F&G API realtime index",
      fgLoading: "Loading index",
      fgError: "Failed to load index. Showing demo values.",
      latest: "Latest",
      updated: "Updated",
      marketTitle: "Market Overview",
      marketDesc: "CoinGecko Global data",
      mcap: "Total Market Cap",
      mcapChange: "24h Market Cap Change",
      volume: "24h Volume",
      btcDom: "BTC Dominance",
      priceTitle: "Coin Prices",
      priceDesc: "CoinGecko free API (USD)",
      priceLoading: "Loading...",
      priceError: "Failed to load prices. Showing demo values.",
      globalLoading: "Loading...",
      globalError: "Failed to load global data. Showing demo values.",
      assets: "Asset",
      price: "Price",
      change24h: "24h",
      mcapCol: "Market Cap"
    }
  }[language] || {};

  const [prices, setPrices] = useState([]);
  const [pricesStatus, setPricesStatus] = useState("loading");
  const [pricesUpdated, setPricesUpdated] = useState("");
  const [globalMcap, setGlobalMcap] = useState(null);
  const [globalStatus, setGlobalStatus] = useState("loading");
  const [globalUpdated, setGlobalUpdated] = useState("");

  const [fgValue, setFgValue] = useState(null);
  const [fgText, setFgText] = useState("");
  const [fgUpdated, setFgUpdated] = useState("");
  const [fgStatus, setFgStatus] = useState("loading");

  const fgStatusText = fgStatus === "loading" ? (txt.fgLoading || "불러오는 중") : fgStatus === "error" ? (txt.fgError || "지표를 불러오지 못했습니다.") : "";
  const globalStatusText = globalStatus === "loading" ? (txt.globalLoading || "불러오는 중...") : globalStatus === "error" ? (txt.globalError || "글로벌 시총을 불러오지 못했습니다.") : "";
  const pricesStatusText = pricesStatus === "loading" ? (txt.priceLoading || "불러오는 중...") : pricesStatus === "error" ? (txt.priceError || "시세를 불러오지 못했습니다.") : "";

  // CoinGecko가 CORS를 막을 때를 대비해 간단한 프록시 fallback
  const fetchWithProxy = async (url) => {
    const fetchJson = async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    try {
      return await fetchJson(url);
    } catch (e) {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      return await fetchJson(proxy);
    }
  };

  const formatUsd = (n, { minFrac = 2, maxFrac = 2 } = {}) => {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac
    }).format(n);
  };

  useEffect(() => {
    let aborted = false;
    const loadPrices = async () => {
      try {
        setPricesStatus("loading");
        const qs = COINGECKO_IDS.join(",");
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${qs}&price_change_percentage=24h`;
        const json = await fetchWithProxy(url);
        if (aborted) return;
        setPrices(
          Array.isArray(json)
            ? json.map((c) => ({
                id: c.id,
                symbol: c.symbol?.toUpperCase(),
                name: c.name,
                image: c.image,
                price: c.current_price,
                change: c.price_change_percentage_24h,
                mcap: c.market_cap
              }))
            : []
        );
        setPricesStatus("");
        setPricesUpdated(new Date().toLocaleString());
      } catch (e) {
        console.warn("price fetch failed", e);
        if (aborted) return;
        setPricesStatus("error");
        setPrices([
          { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67000, change: 1.2, mcap: 1_320_000_000_000 },
          { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3300, change: 0.8, mcap: 400_000_000_000 },
          { id: "binancecoin", symbol: "BNB", name: "BNB", price: 420, change: -0.5, mcap: 64_000_000_000 }
        ]);
        setPricesUpdated("");
      }
    };
    loadPrices();
    const t = setInterval(loadPrices, 1000 * 60 * 5);
    return () => {
      aborted = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let aborted = false;
    const loadGlobal = async () => {
      try {
        setGlobalStatus("loading");
        const json = await fetchWithProxy("https://api.coingecko.com/api/v3/global");
        if (aborted) return;
        const mcapUsd = json?.data?.total_market_cap?.usd;
        const volUsd = json?.data?.total_volume?.usd;
        const btcDom = json?.data?.market_cap_percentage?.btc;
        const mcapChange = json?.data?.market_cap_change_percentage_24h_usd;
        setGlobalMcap({
          mcapUsd: mcapUsd || null,
          volUsd: volUsd || null,
          btcDom: btcDom || null,
          mcapChange: mcapChange || null
        });
        setGlobalStatus("");
        setGlobalUpdated(new Date().toLocaleString());
      } catch (e) {
        console.warn("global fetch failed", e);
        if (aborted) return;
        setGlobalStatus("error");
        setGlobalMcap({
          mcapUsd: 2_600_000_000_000,
          volUsd: 120_000_000_000,
          btcDom: 50.2,
          mcapChange: -0.8
        });
        setGlobalUpdated("");
      }
    };
    loadGlobal();
    const t = setInterval(loadGlobal, 1000 * 60 * 10);
    return () => {
      aborted = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      try {
        setFgStatus("loading");
        const res = await fetch("https://api.alternative.me/fng/?limit=1");
        const json = await res.json();
        const item = json?.data?.[0];
        if (!item) throw new Error("데이터 없음");
        if (aborted) return;
        setFgValue(Number(item.value));
        setFgText(item.value_classification || "");
        setFgUpdated(item.timestamp ? new Date(Number(item.timestamp) * 1000).toLocaleString() : "");
        setFgStatus("");
      } catch (e) {
        console.warn("fear&greed fetch failed", e);
        if (aborted) return;
        setFgStatus("error");
        setFgValue(62);
        setFgText("Greed");
        setFgUpdated("");
      }
    };
    load();
    const t = setInterval(load, 1000 * 60 * 5);
    return () => {
      aborted = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div style={{ width: "min(100%, 950px)", display: "grid", gap: 16 }}>
      {/* 1행: 피어앤그리드 인덱스 / 시장상황 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ margin: "0 0 8px" }}>{txt.fgTitle}</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
            {txt.fgDesc}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: fgValue === null
                  ? (isLight ? "#f3f4f6" : "#111827")
                  : `conic-gradient(#22c55e 0% ${fgValue}%, #facc15 ${fgValue}% 85%, #ef4444 85% 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isLight ? "#0f172a" : "#0b0f25",
                fontWeight: 700,
                fontSize: 20,
                boxShadow: isLight ? "0 0 0 8px rgba(0,0,0,0.06)" : "0 0 0 8px rgba(255,255,255,0.04)"
              }}
            >
              {fgValue === null ? "—" : fgValue}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {fgValue === null ? txt.fgLoading : `${fgText || "Index"} (${fgValue}/100)`}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {fgStatusText || (fgUpdated ? `${txt.updated || "업데이트"}: ${fgUpdated}` : (txt.latest || "최신값"))}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>{txt.marketTitle}</h2>
            <p className="muted" style={{ margin: 0 }}>{txt.marketDesc}</p>
            {globalUpdated && (
              <div className="muted" style={{ marginTop: 4 }}>
                {(txt.updated || "업데이트") + ": " + globalUpdated}
              </div>
            )}
          </div>
          {globalStatusText && <div className="muted">{globalStatusText}</div>}
          {!globalStatusText && globalMcap && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <div>
                <div className="muted">{txt.mcap}</div>
                <div style={{ fontWeight: 700 }}>{formatUsd(globalMcap.mcapUsd, { minFrac: 0, maxFrac: 0 })}</div>
              </div>
              <div>
                <div className="muted">{txt.mcapChange}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: (globalMcap.mcapChange ?? 0) >= 0 ? "#16a34a" : "#ef4444" }}>
                  {globalMcap.mcapChange === null
                    ? "—"
                    : (
                      <>
                        <span style={{ fontSize: 12 }}>{(globalMcap.mcapChange ?? 0) >= 0 ? "▲" : "▼"}</span>
                        <span>{globalMcap.mcapChange.toFixed(2)}%</span>
                      </>
                    )
                  }
                </div>
              </div>
              <div>
                <div className="muted">{txt.volume}</div>
                <div style={{ fontWeight: 700 }}>{formatUsd(globalMcap.volUsd, { minFrac: 0, maxFrac: 0 })}</div>
              </div>
              <div>
                <div className="muted">{txt.btcDom}</div>
                <div style={{ fontWeight: 700 }}>{globalMcap.btcDom ? `${globalMcap.btcDom.toFixed(2)}%` : "—"}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2행: 코인 시세 표 */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 8px" }}>{txt.priceTitle}</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          {txt.priceDesc}
        </p>
        {pricesUpdated && (
          <div className="muted" style={{ marginBottom: 8 }}>
            {(txt.updated || "업데이트") + ": " + pricesUpdated}
          </div>
        )}
        {pricesStatusText && <div className="muted">{pricesStatusText}</div>}
        {!pricesStatusText && (
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "30%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: rowBorder }}>{txt.assets}</th>
                <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: rowBorder }}>{txt.price}</th>
                <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: rowBorder }}>{txt.change24h}</th>
                <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: rowBorder }}>{txt.mcapCol}</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: "12px 14px", borderBottom: rowBorder }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.image ? (
                        <img src={c.image} alt={c.name} style={{ width: 20, height: 20, borderRadius: "50%" }} />
                      ) : (
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#e5e7eb" }} />
                      )}
                      <span>{c.name} ({c.symbol})</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: rowBorder }}>{formatUsd(c.price)}</td>
                  <td style={{ padding: "12px 14px", borderBottom: rowBorder, color: (c.change ?? 0) >= 0 ? "#16a34a" : "#ef4444", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    {c.change === null || c.change === undefined
                      ? "—"
                      : (
                        <>
                          <span style={{ fontSize: 12 }}>
                            {(c.change ?? 0) >= 0 ? "▲" : "▼"}
                          </span>
                          <span>{c.change.toFixed(2)}%</span>
                        </>
                      )
                    }
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: rowBorder }}>{formatUsd(c.mcap, { minFrac: 0, maxFrac: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
