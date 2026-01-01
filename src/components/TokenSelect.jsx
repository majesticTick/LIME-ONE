import React, { useEffect, useMemo, useRef, useState } from "react";
import bnbLogo from "../assets/bnb-chain.png";
import { bnbLogoDataUrl } from "../assets/bnbLogoData";
import { busdLogoDataUrl } from "../assets/busdLogoData";

const ICON_MAP = {
  BNB: bnbLogo,
  WBNB: bnbLogo,
  BUSD: busdLogoDataUrl
};
const FAVORITE_KEY = "limeone.favTokens";

const getIconSrc = (token) => {
  if (!token) return null;
  if (token.logoURI) return token.logoURI;
  const sym = (token.symbol || "").toUpperCase();
  if (ICON_MAP[sym]) return ICON_MAP[sym];
  if (sym.includes("BNB")) return bnbLogoDataUrl;
  return null;
};

export default function TokenSelect({ list, value, onChange, chainOptions = [], chainKey, onChainChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState([]);
  const wrapRef = useRef(null);
  const isLight = typeof document !== "undefined" && document.body?.dataset?.theme === "light";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch (_) {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));
    } catch (_) {
      /* ignore */
    }
  }, [favorites]);

  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentToken = useMemo(() => list.find((t) => t.address === value) || null, [list, value]);
  const iconSrc = getIconSrc(currentToken);
  const fallback = (currentToken?.symbol || "?").charAt(0).toUpperCase();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const data = list || [];
    const favSet = new Set(favorites);
    const sorted = [...data].sort((a, b) => {
      const aFav = favSet.has(a.address);
      const bFav = favSet.has(b.address);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return (a.symbol || "").localeCompare(b.symbol || "");
    });
    if (!term) return sorted;
    return sorted.filter((t) => {
      const sym = (t.symbol || "").toLowerCase();
      const addr = (t.address || "").toLowerCase();
      return sym.includes(term) || addr.includes(term);
    });
  }, [list, search, favorites]);

  const toggleFavorite = (addr) => {
    setFavorites((prev) => (prev.includes(addr) ? prev.filter((a) => a !== addr) : [...prev, addr]));
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 200 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 10,
          border: isLight ? "1px solid #d1d5db" : "1px solid #293244",
          background: isLight ? "#f9fafb" : "#0f131a",
          color: "inherit",
          cursor: "pointer"
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1f2937",
            color: "#e5e7eb",
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0
          }}
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt={currentToken?.symbol || "token"}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              onError={(e) => {
                if (e?.target) e.target.src = bnbLogoDataUrl;
              }}
            />
          ) : (
            fallback
          )}
        </div>
        <span style={{ flex: 1, textAlign: "left", fontWeight: 700 }}>{(currentToken?.symbol || "").toUpperCase() || "TOKEN"}</span>
        <span style={{ opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(460px, 92vw)",
              maxHeight: "80vh",
              background: isLight ? "#ffffff" : "#0b0f13",
              borderRadius: 14,
              border: isLight ? "1px solid #e5e7eb" : "1px solid #1f2633",
              boxShadow: "0 24px 48px rgba(0,0,0,0.32)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflow: "hidden"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: isLight ? "#0b0f25" : "#e5e7eb" }}>토큰 선택</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: isLight ? "#6b7280" : "#9ca3af",
                  fontSize: 20,
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="토큰 이름 또는 주소 검색"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: isLight ? "1px solid #d1d5db" : "1px solid #293244",
                  background: isLight ? "#f9fafb" : "#111827",
                  color: "inherit",
                  fontSize: 13
                }}
              />
              {chainOptions?.length > 0 && (
                <select
                  value={chainKey}
                  onChange={(e) => onChainChange?.(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: isLight ? "1px solid #d1d5db" : "1px solid #293244",
                    background: isLight ? "#f9fafb" : "#0f131a",
                    color: "inherit",
                    fontWeight: 700
                  }}
                >
                  {chainOptions.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((t, idx) => {
                const selected = t.address === value;
                const icon = getIconSrc(t);
                const initial = (t.symbol || "?").charAt(0).toUpperCase();
                const isFav = favorites.includes(t.address);
                const key = `${(t.address || "").toLowerCase()}-${idx}`;
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 10,
                      cursor: "pointer",
                      background: selected ? (isLight ? "#e5e7eb" : "#1f2633") : "transparent"
                    }}
                    onClick={() => {
                      onChange(t.address);
                      setOpen(false);
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#1f2937",
                        color: "#e5e7eb",
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0
                      }}
                    >
                      {icon ? (
                        <img
                          src={icon}
                          alt={t.symbol || "token"}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                          onError={(e) => {
                            if (e?.target) e.target.src = bnbLogoDataUrl;
                          }}
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{(t.symbol || "").toUpperCase()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(t.address);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 14,
                        color: isFav ? "#f59e0b" : isLight ? "#6b7280" : "#9ca3af"
                      }}
                      title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
