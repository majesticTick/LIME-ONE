// src/components/Liquidity.jsx

import React, { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import tokenListJson from "../tokens.json";
import { ROUTER_ADDRESS, FACTORY_ADDRESS, WBNB, BUSD, DEFAULT_TOKENS } from "../config";

const CORE_TOKENS = [
  { symbol: "WBNB", address: WBNB },
  { symbol: "BUSD", address: BUSD }
];

const factoryAbi = [
  "function getPair(address tokenA,address tokenB) external view returns (address pair)"
];

const routerAbi = [
  "function addLiquidity(address tokenA,address tokenB,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) external returns (uint amountA,uint amountB,uint liquidity)",
  "function removeLiquidity(address tokenA,address tokenB,uint liquidity,uint amountAMin,uint amountBMin,address to,uint deadline) external returns (uint amountA,uint amountB)"
];

const erc20Abi = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function allowance(address owner,address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

const pairAbi = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function allowance(address owner,address spender) external view returns (uint256)",
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

// -------------------- Token 리스트 구성 --------------------

function buildTokenUniverse(externals) {
  const base = [...CORE_TOKENS];
  const extra = Array.isArray(externals) ? externals : [];

  for (const t of extra) {
    if (!t || !t.address) continue;
    const addr = (t.address || "").trim();
    if (!ethers.utils.isAddress(addr)) continue;
    const lower = addr.toLowerCase();
    if (!base.find((x) => x.address.toLowerCase() === lower)) {
      base.push({
        symbol: t.symbol || "TKN",
        address: addr
      });
    }
  }
  return base;
}

// -------------------- 메인 컴포넌트 --------------------

export default function Liquidity({ provider, account, language = "ko", tokenList = (DEFAULT_TOKENS?.length ? DEFAULT_TOKENS : tokenListJson), onActionSuccess, onRequestConnect }) {
  const [subTab, setSubTab] = useState("add"); // "add" | "manage"
  const isLight = typeof document !== "undefined" && document.body?.dataset?.theme === "light";
  const txt = {
    ko: {
      title: "유동성",
      tabAdd: "유동성 추가",
      tabManage: "내 풀 관리",
      connectPrompt: "먼저 상단에서 지갑을 연결해주세요.",
      connectBtn: "지갑 연결",
      addHeading: "유동성 추가",
      addDesc: "선택한 두 토큰으로 PancakeSwap V2 풀에 유동성을 공급합니다. 완료 후 Factory 기준 공식 LP 풀 주소를 표시합니다.",
      tokenA: "토큰 A",
      tokenB: "토큰 B",
      amount: "수량",
      addBtn: "유동성 추가",
      addProgress: "진행중...",
      manageHeading: "내 LP 포지션",
      manageDesc: "유동성 추가 시 자동으로 채워지는 LP 주소를 바로 조회해 포지션을 보여줍니다.",
      autoSearch: "",
      reload: "",
      manualTitle: "",
      manualPlaceholder: "",
      manualQuery: "",
      manualRemove: "이 풀 전체 유동성 제거",
      lpBalance: "LP 잔액",
      positionDetail: "포지션 자세히 보기",
      noPosition: "자동으로 가져올 LP 주소가 없습니다. 유동성 추가 후 다시 확인해주세요.",
      detailAddress: "LP 주소",
      detailBalance: "LP 잔액",
      detailClose: "닫기"
    },
    en: {
      title: "Liquidity",
      tabAdd: "Add Liquidity",
      tabManage: "My Pools",
      connectPrompt: "Please connect your wallet above first.",
      connectBtn: "Connect Wallet",
      addHeading: "Add Liquidity",
      addDesc: "Supply liquidity to PancakeSwap V2 with the selected tokens. The official LP pool address from Factory will be shown after completion.",
      tokenA: "Token A",
      tokenB: "Token B",
      amount: "Amount",
      addBtn: "Add Liquidity",
      addProgress: "Processing...",
      manageHeading: "My LP Positions",
      manageDesc: "Uses the LP address (auto-filled after adding) and auto-loads your position.",
      autoSearch: "",
      reload: "",
      manualTitle: "",
      manualPlaceholder: "",
      manualQuery: "",
      manualRemove: "Remove all liquidity",
      lpBalance: "LP Balance",
      positionDetail: "View Position",
      noPosition: "No auto-filled LP address found. Add liquidity and re-open to see your position.",
      detailAddress: "LP Address",
      detailBalance: "LP Balance",
      detailClose: "Close"
    }
  }[language] || {};

  const tokens = useMemo(() => buildTokenUniverse(tokenList), [tokenList]);

  // add-liquidity
  const [tokenA, setTokenA] = useState(tokens[0] || CORE_TOKENS[0]);
  const [tokenB, setTokenB] = useState(tokens[1] || CORE_TOKENS[1]);

  useEffect(() => {
    if (tokens.length > 0) setTokenA(tokens[0]);
    if (tokens.length > 1) setTokenB(tokens[1]);
  }, [tokens]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [adding, setAdding] = useState(false);

  // manual
  const [manualPairAddr, setManualPairAddr] = useState("");
  const [manualStatus, setManualStatus] = useState("");
  const [manualPos, setManualPos] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualRemoving, setManualRemoving] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const getActiveAddress = async () => {
    if (!provider) return null;
    try {
      const signer = provider.getSigner();
      return await signer.getAddress();
    } catch {
      return account || null;
    }
  };

  // -------------------- 유동성 추가 --------------------

  const handleAddLiquidity = async () => {
    try {
      if (!provider) {
        setAddStatus("먼저 지갑을 연결해주세요.");
        return;
      }
      const user = await getActiveAddress();
      if (!user) {
        setAddStatus("지갑 주소를 확인할 수 없습니다.");
        return;
      }
      if (!tokenA || !tokenB || tokenA.address === tokenB.address) {
        setAddStatus("서로 다른 두 토큰을 선택해주세요.");
        return;
      }
      if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) {
        setAddStatus("두 토큰 수량을 모두 입력해주세요.");
        return;
      }

      setAdding(true);
      setAddStatus("트랜잭션 준비 중...");

      const signer = provider.getSigner();
      const router = new ethers.Contract(ROUTER_ADDRESS, routerAbi, signer);
      const cA = new ethers.Contract(tokenA.address, erc20Abi, signer);
      const cB = new ethers.Contract(tokenB.address, erc20Abi, signer);

      const [decA, decB] = await Promise.all([cA.decimals(), cB.decimals()]);
      const amtADesired = ethers.utils.parseUnits(amountA, decA);
      const amtBDesired = ethers.utils.parseUnits(amountB, decB);

      const [allowA, allowB] = await Promise.all([
        cA.allowance(user, ROUTER_ADDRESS),
        cB.allowance(user, ROUTER_ADDRESS)
      ]);

      if (allowA.lt(amtADesired)) {
        setAddStatus(`${tokenA.symbol} 승인 중...`);
        const tx = await cA.approve(ROUTER_ADDRESS, amtADesired);
        await tx.wait();
      }

      if (allowB.lt(amtBDesired)) {
        setAddStatus(`${tokenB.symbol} 승인 중...`);
        const tx = await cB.approve(ROUTER_ADDRESS, amtBDesired);
        await tx.wait();
      }

      setAddStatus("유동성 추가 트랜잭션 전송 중...");
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

      const tx = await router.addLiquidity(
        tokenA.address,
        tokenB.address,
        amtADesired,
        amtBDesired,
        0,
        0,
        user,
        deadline
      );

      setAddStatus(`대기 중... (${tx.hash.slice(0, 12)}...)`);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        setAddStatus("유동성 추가 트랜잭션이 실패했습니다.");
        return;
      }

      // ✅ 실제 풀 주소: 트랜잭션 로그(Mint 이벤트) 우선 → Factory.getPair 보조
      const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, provider);
      const MINT_TOPIC = ethers.utils.id("Mint(address,uint256,uint256)");
      const mintLog = receipt.logs?.find?.((l) => l.topics?.[0] === MINT_TOPIC);
      const pairFromLogs = mintLog?.address;
      const pairFromFactory = await factory.getPair(tokenA.address, tokenB.address);
      const pair = pairFromLogs || pairFromFactory;

      if (pair && pair !== ethers.constants.AddressZero) {
        setAddStatus(
          [
            "✅ 유동성 추가 완료!",
            `Tx: ${tx.hash}`,
            `LP 풀(페어) 컨트랙트 주소 (Factory 기준):`,
            pair,
            "",
            "※ MetaMask에서 LP 토큰 주소로 보이는 컨트랙트와 동일해야 합니다.",
            "※ 아래 '내 풀 관리' 또는 수동 입력에 이 주소를 그대로 사용할 수 있습니다."
          ].join("\n")
        );
        setManualPairAddr(pair); // 편하게 자동 세팅
      } else {
        setAddStatus(
          [
            "✅ 유동성 추가 완료!",
            `Tx: ${tx.hash}`,
            "",
            "⚠️ Factory.getPair 결과를 가져오지 못했습니다.",
            "BscScan/MetaMask에서 LP 주소 확인 후 '내 풀 관리'에서 직접 입력해주세요."
          ].join("\n")
        );
      }

      setAmountA("");
      setAmountB("");

      const time = new Date().toLocaleString();
      setToast({
        type: "success",
        message: `${tokenA.symbol}/${tokenB.symbol} 유동성 추가 완료`,
        detail: `${amountA} ${tokenA.symbol} + ${amountB} ${tokenB.symbol}`,
        time
      });
      if (onActionSuccess) {
        onActionSuccess({
          id: `${Date.now()}-add`,
          type: "add_liquidity",
          detail: `${tokenA.symbol}/${tokenB.symbol} add (${amountA} + ${amountB})`,
          time,
          txHash: tx.hash,
          from: user,
          to: ROUTER_ADDRESS,
          changes: [
            { token: tokenA.symbol, change: `-${amountA}` },
            { token: tokenB.symbol, change: `-${amountB}` },
            { token: "LP", change: "+ (minted)" }
          ],
          pairAddress: pairFromLogs || pairFromFactory
        });
      }
    } catch (e) {
      console.error("addLiquidity error:", e);
      const msg =
        e?.reason ||
        e?.data?.message ||
        e?.message ||
        "유동성 추가 중 오류가 발생했습니다.";
      setAddStatus(`❌ ${msg}`);
    } finally {
      setAdding(false);
    }
  };

  // -------------------- 자동 LP 포지션 조회 --------------------

  // -------------------- 수동 풀 주소 입력 --------------------

  const handleManualLoad = async () => {
    setManualPos(null);
    setManualStatus("");

    try {
      if (!provider) {
        setManualStatus("먼저 지갑을 연결해주세요.");
        return;
      }
      const user = await getActiveAddress();
      if (!user) {
        setManualStatus("지갑 주소를 확인할 수 없습니다.");
        return;
      }
      if (!manualPairAddr || !ethers.utils.isAddress(manualPairAddr)) {
        setManualStatus("올바른 LP 풀(페어) 컨트랙트 주소를 입력해주세요.");
        return;
      }

      setManualLoading(true);
      setManualStatus("풀 정보 조회 중...");

      const pair = new ethers.Contract(manualPairAddr, pairAbi, provider);

      const [token0Addr, token1Addr] = await Promise.all([
        pair.token0(),
        pair.token1()
      ]);

      const lpBal = await pair.balanceOf(user);
      if (!lpBal || lpBal.isZero()) {
        setManualStatus("이 풀에 보유한 LP 토큰이 없습니다.");
        setManualPos(null);
        return;
      }

      let lpDec = 18;
      try {
        lpDec = await pair.decimals();
      } catch {}
      const lpFormatted = ethers.utils.formatUnits(lpBal, lpDec);

      const t0 = new ethers.Contract(token0Addr, erc20Abi, provider);
      const t1 = new ethers.Contract(token1Addr, erc20Abi, provider);

      let symbol0 = "TOKEN0";
      let symbol1 = "TOKEN1";
      try {
        symbol0 = await t0.symbol();
      } catch {}
      try {
        symbol1 = await t1.symbol();
      } catch {}

      setManualPos({
        pairAddress: manualPairAddr,
        token0: token0Addr,
        token1: token1Addr,
        symbol0,
        symbol1,
        lpBal,
        lpFormatted
      });

      setManualStatus(
        `이 풀에 LP ${lpFormatted} 보유 중입니다. (${symbol0}/${symbol1})`
      );
    } catch (e) {
      console.warn("manualLoad error:", e);
      const msg =
        e?.reason ||
        e?.data?.message ||
        e?.message ||
        "풀 정보를 불러오는 중 오류가 발생했습니다.";
      setManualStatus(`❌ ${msg}`);
      setManualPos(null);
    } finally {
      setManualLoading(false);
    }
  };

  // LP 주소가 자동으로 채워지면 바로 조회 (버튼 없이)
  useEffect(() => {
    if (
      provider &&
      account &&
      subTab === "manage" &&
      manualPairAddr &&
      ethers.utils.isAddress(manualPairAddr) &&
      !manualLoading
    ) {
      handleManualLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, account, subTab, manualPairAddr]);

  const handleManualRemove = async () => {
    try {
      if (!provider) {
        setManualStatus("먼저 지갑을 연결해주세요.");
        return;
      }
      const user = await getActiveAddress();
      if (!user) {
        setManualStatus("지갑 주소를 확인할 수 없습니다.");
        return;
      }
      if (!manualPos) {
        setManualStatus("먼저 풀을 조회해주세요.");
        return;
      }

      setManualRemoving(true);
      setManualStatus("LP 승인 확인 중...");

      const signer = provider.getSigner();
      const router = new ethers.Contract(ROUTER_ADDRESS, routerAbi, signer);
      const pair = new ethers.Contract(manualPos.pairAddress, pairAbi, signer);

      const lpBal = await pair.balanceOf(user);
      if (!lpBal || lpBal.isZero()) {
        setManualStatus("제거할 LP 토큰이 없습니다.");
        setManualPos(null);
        return;
      }

      const allowance = await pair.allowance(user, ROUTER_ADDRESS);
      if (allowance.lt(lpBal)) {
        const txA = await pair.approve(ROUTER_ADDRESS, lpBal);
        await txA.wait();
      }

      setManualStatus("유동성 제거 트랜잭션 전송 중...");
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

      // token0/token1 기준으로 제거
      const tx = await router.removeLiquidity(
        manualPos.token0,
        manualPos.token1,
        lpBal,
        0,
        0,
        user,
        deadline
      );

      setManualStatus(`대기 중... (${tx.hash.slice(0, 12)}...)`);
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setManualStatus(`✅ 전체 유동성 제거 완료! Tx: ${tx.hash}`);
        const time = new Date().toLocaleString();
        setToast({
          type: "success",
          message: `${manualPos.symbol0}/${manualPos.symbol1} 유동성 제거 완료`,
          detail: `LP 토큰 전량 제거`,
          time
        });
        if (onActionSuccess) {
          onActionSuccess({
            id: `${Date.now()}-manual-remove`,
            type: "remove_liquidity",
            detail: `${manualPos.symbol0}/${manualPos.symbol1} remove`,
            time,
            txHash: tx.hash,
            from: user,
            to: ROUTER_ADDRESS,
            changes: [
              { token: manualPos.symbol0, change: "+ (수령)" },
              { token: manualPos.symbol1, change: "+ (수령)" },
              { token: "LP", change: "- 전량" }
            ],
            pairAddress: manualPos.pairAddress
          });
        }
        setManualPos(null);
      } else {
        setManualStatus("유동성 제거 트랜잭션이 실패했습니다.");
      }
    } catch (e) {
      console.error("manualRemove error:", e);
      const msg =
        e?.reason ||
        e?.data?.message ||
        e?.message ||
        "유동성 제거 중 오류가 발생했습니다.";
      setManualStatus(`❌ ${msg}`);
    } finally {
      setManualRemoving(false);
    }
  };

  // -------------------- UI --------------------

  if (!provider) {
    return (
      <div style={{ padding: 24, color: isLight ? "#0b0f25" : "#e5e7eb" }}>
        <h2>💧 {txt.title}</h2>
        <p style={{ color: isLight ? "#6b7280" : "#aaa" }}>{txt.connectPrompt}</p>
        <button onClick={onRequestConnect} style={{ marginTop: 10 }}>
          {txt.connectBtn}
        </button>
      </div>
    );
  }

  return (
    <>
    <div
      className="card"
      style={{
        width: "min(100%, 760px)",
        padding: 24,
        background: isLight ? "#ffffff" : undefined,
        color: isLight ? "#0b0f25" : undefined,
        border: isLight ? "1px solid #e5e7eb" : undefined
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => setSubTab("add")}
          style={subTab === "add" ? tabActive : tabBtn}
        >
          {txt.tabAdd}
        </button>
        <button
          onClick={() => setSubTab("manage")}
          style={subTab === "manage" ? tabActive : tabBtn}
        >
          {txt.tabManage}
        </button>
      </div>

      {/* 유동성 추가 */}
      {subTab === "add" && (
        <>
          <h2 style={{ marginBottom: 8 }}>{txt.addHeading}</h2>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            {txt.addDesc}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{txt.tokenA}</div>
                <select
                  value={tokenA.address}
                  onChange={(e) => {
                    const t = tokens.find(
                      (x) =>
                        x.address.toLowerCase() ===
                        e.target.value.toLowerCase()
                    );
                    if (t && (!tokenB || t.address !== tokenB.address)) {
                      setTokenA(t);
                    }
                  }}
                  style={selectStyle}
                >
                  {tokens.map((t) => (
                    <option key={t.address} value={t.address}>
                      {t.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{txt.tokenB}</div>
                <select
                  value={tokenB.address}
                  onChange={(e) => {
                    const t = tokens.find(
                      (x) =>
                        x.address.toLowerCase() ===
                        e.target.value.toLowerCase()
                    );
                    if (t && (!tokenA || t.address !== tokenA.address)) {
                      setTokenB(t);
                    }
                  }}
                  style={selectStyle}
                >
                  {tokens.map((t) => (
                    <option key={t.address} value={t.address}>
                      {t.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="number"
                min="0"
                step="0.00000001"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder={txt.amount}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              />
              <input
                type="number"
                min="0"
                step="0.00000001"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder={txt.amount}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleAddLiquidity}
                disabled={
                  adding ||
                  !tokenA ||
                  !tokenB ||
                  tokenA.address === tokenB.address ||
                  !amountA ||
                  !amountB ||
                  Number(amountA) <= 0 ||
                  Number(amountB) <= 0
                }
                style={{
                  ...primaryBtn(
                    adding ||
                    !tokenA ||
                    !tokenB ||
                    tokenA.address === tokenB.address ||
                    !amountA ||
                    !amountB ||
                    Number(amountA) <= 0 ||
                    Number(amountB) <= 0
                  ),
                  marginTop: 0,
                  minWidth: 180
                }}
              >
                {adding ? txt.addProgress : txt.addBtn}
              </button>
            </div>
          </div>

          {addStatus && (
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                whiteSpace: "pre-wrap"
              }}
            >
              {addStatus}
            </p>
          )}
        </>
      )}

      {/* 내 풀 관리 */}
      {subTab === "manage" && (
        <>
          <h2 style={{ marginBottom: 8 }}>{txt.manageHeading}</h2>
          <p style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
            {txt.manageDesc}
          </p>

          {manualStatus && (
            <p
              style={{
                marginTop: 6,
                fontSize: 12,
                whiteSpace: "pre-wrap",
                color: isLight ? "#6b7280" : "#9ca3af"
              }}
            >
              {manualStatus}
            </p>
          )}

          {manualPos ? (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                background: isLight ? "#f3f4f6" : "rgba(0,0,0,0.4)",
                border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(148,163,253,0.2)",
                fontSize: 12,
                color: isLight ? "#0b0f25" : "#e5e7eb"
              }}
            >
              <div style={{ color: "#7ee787", fontWeight: 600 }}>
                {manualPos.symbol0} / {manualPos.symbol1}
              </div>
              <div style={{ color: "#38bdf8", marginTop: 4 }}>
                {txt.lpBalance}: {manualPos.lpFormatted}
              </div>
              <button
                onClick={() => setShowDetail(true)}
                style={{ ...secondaryBtn(false), marginTop: 8, padding: "8px 12px" }}
              >
                {txt.positionDetail}
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: isLight ? "#f3f4f6" : "rgba(0,0,0,0.25)",
                border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(148,163,253,0.25)",
                fontSize: 12,
                color: isLight ? "#6b7280" : "#9ca3af"
              }}
            >
              {txt.noPosition}
            </div>
          )}

          {showDetail && manualPos && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
              <div style={{ background: isLight ? "#ffffff" : "#12161f", color: isLight ? "#0b0f25" : "#e5e7eb", padding: 18, borderRadius: 12, width: "90%", maxWidth: 420, border: isLight ? "1px solid #e5e7eb" : "1px solid #1f2633" }}>
                <h3 style={{ marginTop: 0, marginBottom: 10 }}>
                  {manualPos.symbol0} / {manualPos.symbol1}
                </h3>
                <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af", marginBottom: 6 }}>
                  {txt.detailAddress}
                </div>
                <div style={{ wordBreak: "break-all", fontSize: 12, marginBottom: 10 }}>
                  {manualPos.pairAddress}
                </div>
                <div style={{ fontSize: 13, marginBottom: 12 }}>
                  {txt.detailBalance}: {manualPos.lpFormatted}
                </div>
                {manualStatus && (
                  <p style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 0, color: isLight ? "#6b7280" : "#9ca3af" }}>
                    {manualStatus}
                  </p>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleManualRemove}
                    disabled={!manualPos || manualRemoving}
                    style={dangerBtn(!manualPos || manualRemoving)}
                  >
                    {manualRemoving ? "..." : txt.manualRemove}
                  </button>
                  <button onClick={() => setShowDetail(false)} style={secondaryBtn(false)}>
                    {txt.detailClose}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    {toast && (
      <div style={{ position: "fixed", left: "50%", top: 20, transform: "translateX(-50%)", zIndex: 9999, width: "100%", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div
          style={{
            background: toast.type === "success" ? "#0f5132" : "#111827",
            color: "#ffffff",
            padding: "14px 16px",
            borderRadius: 14,
            boxShadow: "0 14px 40px rgba(0,0,0,0.28)",
            fontSize: 15,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 240,
            maxWidth: "92vw",
            animation: "toast-pop 240ms ease, toast-hide 200ms ease 3s forwards",
            willChange: "transform, opacity",
            pointerEvents: "auto"
          }}
        >
          <span style={{ fontWeight: 700 }}>{toast.message}</span>
          {toast.detail && <span style={{ fontSize: 13, opacity: 0.9 }}>{toast.detail}</span>}
          {toast.time && <span style={{ fontSize: 12, opacity: 0.7 }}>{toast.time}</span>}
        </div>
      </div>
    )}
    </>
  );
}

// -------------------- 스타일 --------------------

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(148,163,253,0.25)",
  backgroundColor: "transparent",
  color: "inherit",
  fontSize: 13,
  marginTop: 4
};

const selectStyle = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(75,85,99,0.8)",
  backgroundColor: "transparent",
  color: "inherit",
  fontSize: 13,
  marginTop: 2
};

const tabBtn = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid rgba(148,163,253,0.35)",
  background: "transparent",
  color: "inherit",
  fontSize: 14,
  cursor: "pointer"
};

const tabActive = {
  ...tabBtn,
  background: "#ff751f",
  border: "1px solid #ff751f",
  color: "#0f172a",
  fontWeight: 600
};

const primaryBtn = (disabled) => ({
  marginTop: 16,
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  backgroundColor: disabled ? "rgba(255,117,31,0.45)" : "#ff751f",
  color: "white",
  fontWeight: 600
});

const secondaryBtn = (disabled) => ({
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid rgba(148,163,253,0.35)",
  cursor: disabled ? "not-allowed" : "pointer",
  backgroundColor: "transparent",
  color: "inherit",
  fontSize: 12
});

const dangerBtn = (disabled) => ({
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  backgroundColor: disabled ? "rgba(239,68,68,0.4)" : "#ef4444",
  color: "white",
  fontSize: 12,
  fontWeight: 600
});
