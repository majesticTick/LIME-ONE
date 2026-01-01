import React, { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { ROUTER_ADDRESS, POLL_MS, WBNB, NATIVE_ALIAS, FACTORY_ADDRESS } from "./config";
import RouterABI from "./abi/Router.json";
import ERC20ABI from "./abi/ERC20.json";
import FactoryABI from "./abi/Factory.json";
import PairABI from "./abi/Pair.json";
import TokenSelect from "./components/TokenSelect.jsx";
import { callChatCompletion } from "./utils/aiClient";

export default function Swap({
  provider,
  account,
  tokenList,
  isConnected,
  language = "ko",
  experienceMode = "beginner",
  onSwapSuccess,
  onAskAi,
  onRequestConnect,
  chainKey,
  onChainChange,
  chainOptions = [],
  dexRouters,
  chainCfg
}) {
  const isLight = typeof document !== "undefined" && document.body?.dataset?.theme === "light";
  useEffect(() => {
    const id = "swap-square-style";
    if (typeof document === "undefined") return;
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.innerHTML = `.swap-square *:not(button){border-radius:0!important;}`;
      document.head.appendChild(el);
    }
  }, []);
  const ALIAS_BNB = chainCfg?.nativeAlias || NATIVE_ALIAS || "bnb-native";
  const WBNB_ADDR = chainCfg?.wrappedNative || WBNB;
  const ROUTER_FALLBACK = chainCfg?.router || ROUTER_ADDRESS;
  const pollMs = chainCfg?.pollMs || POLL_MS;
  const IWBNB_ABI = [
    { inputs: [], name: "deposit", outputs: [], stateMutability: "payable", type: "function" },
    { inputs: [{ internalType: "uint256", name: "wad", type: "uint256" }], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" }
  ];
  const resolveAddress = (addr) => (addr === ALIAS_BNB ? WBNB_ADDR : addr);
  const isWrapPath = (from, to) => from === ALIAS_BNB && resolveAddress(to) === WBNB_ADDR;
  const isUnwrapPath = (from, to) => to === ALIAS_BNB && resolveAddress(from) === WBNB_ADDR;
  const isNativeInput = (addr) => addr === ALIAS_BNB;
  const isNativeOutput = (addr) => addr === ALIAS_BNB;
  const txt = {
    ko: {
      title: "토큰 스왑",
      amountPh: "수량 (예: 0.01)",
      swapBtn: "스왑",
      quoteCheck: "견적 확인",
      swapSwitch: "코인 위치 바꾸기",
      fromBal: "From 잔액",
      expected: "예상 수령량",
      slippage: "슬리피지 허용치(%)",
      minReceive: "최소 수령",
      priceImpact: "예상 가격 영향",
      calculating: "예상 수령량 계산 중…",
      connectBtn: "지갑 연결",
      needConnect: "지갑 연결 후 이용해주세요.",
      inProgress: "진행중...",
      swapSuccess: "Swap 성공!",
      swapFail: "Swap 실패: ",
      confirmTitle: "스왑 실행 전 확인",
      confirmDesc: "아래 내용을 다시 확인해주세요.",
      confirmProceed: "확인 후 스왑",
      cancel: "취소",
      slippageHigh: "슬리피지가 2%를 넘어요. 가격 변동에 주의하세요.",
      sliderLabel: "수량 (슬라이더)",
      sliderHelp: "보유량 대비 %로 선택하세요.",
      aiTiming: "AI 스왑 타이밍 분석",
      aiSummary: "네트워크/견적 요약",
      summaryHint: "현재 견적, 최소 수령, 가격 영향, 유동성, 가스 혼잡 요약입니다.",
      needKey: "AI 키가 필요합니다. 우측 하단 챗봇에서 설정하세요.",
      fetching: "업데이트 중...",
      failed: "외부 데이터를 불러오지 못했습니다.",
      networkCongestion: "네트워크 혼잡도",
      poolLiquidity: "풀 유동성",
      priceImpactLabel: "가격 영향",
      gasLow: "낮음",
      gasMed: "보통",
      gasHigh: "혼잡",
      chartUnavailable: "차트를 불러올 수 없습니다.",
      bestRoute: "최적가 라우팅",
      bestRouteDesc: "하이퍼리퀴드 · 유니스왑 · 펜케이크 중 예상 수령이 가장 높은 곳을 보여줍니다.",
      autoSelect: "자동 선택",
      manualSelect: "직접 선택",
      executionRoute: "실행 경로",
      estOnly: "견적 전용",
      execNote: "현재 실행은 PancakeSwap 라우터로 진행되며, 다른 DEX는 견적 비교만 제공합니다.",
      bestBadge: "최저가",
      routeBestAmount: "예상 수령",
      routeBoxTitle: "거래소 선택",
      routeBoxHint: "스왑 버튼을 누르면 여기서 최저가 거래소를 선택해 실행합니다.",
      selectAndSwap: "선택 후 실행",
      unsupported: "아직 지원되지 않습니다",
      routeAddress: "라우터 주소",
      save: "저장",
      saved: "저장됨",
      routeExecute: "선택한 거래소로 스왑"
    },
    en: {
      title: "Token Swap",
      amountPh: "Amount (e.g., 0.01)",
      swapBtn: "Swap",
      quoteCheck: "Check quote",
      swapSwitch: "Switch Tokens",
      fromBal: "From Balance",
      expected: "Expected Receive",
      slippage: "Slippage (%)",
      minReceive: "Min Receive",
      priceImpact: "Price Impact",
      calculating: "Calculating…",
      connectBtn: "Connect Wallet",
      needConnect: "Connect wallet to use swap.",
      inProgress: "Processing...",
      swapSuccess: "Swap succeeded!",
      swapFail: "Swap failed: ",
      confirmTitle: "Confirm Swap",
      confirmDesc: "Review details before executing.",
      confirmProceed: "Confirm and Swap",
      cancel: "Cancel",
      slippageHigh: "Slippage is above 2%. High price impact risk.",
      sliderLabel: "Amount (slider)",
      sliderHelp: "Choose % of your balance.",
      aiTiming: "AI swap timing analysis",
      aiSummary: "Network/quote summary",
      summaryHint: "Quick view of estimate, min receive, price impact, liquidity, and gas congestion.",
      needKey: "AI key required. Set it in the chat widget.",
      fetching: "Updating...",
      failed: "Failed to fetch external data.",
      networkCongestion: "Network congestion",
      poolLiquidity: "Pool liquidity",
      priceImpactLabel: "Price impact",
      gasLow: "Low",
      gasMed: "Moderate",
      gasHigh: "High",
      chartUnavailable: "Chart unavailable.",
      bestRoute: "Best price routing",
      bestRouteDesc: "Shows the highest expected output among Hyperliquid, Uniswap, and PancakeSwap.",
      autoSelect: "Auto select",
      manualSelect: "Manual",
      executionRoute: "Execution route",
      estOnly: "Quote only",
      execNote: "Execution uses the PancakeSwap router for now; other DEXes are compared for pricing only.",
      bestBadge: "Best",
      routeBestAmount: "Est. receive",
      routeBoxTitle: "Select venue",
      routeBoxHint: "After pressing swap, pick the best venue here and execute.",
      selectAndSwap: "Pick and execute",
      unsupported: "Not supported yet",
      routeAddress: "Router address",
      save: "Save",
      saved: "Saved",
      routeExecute: "Swap with selected DEX"
    }
  }[language] || {};

  const DEX_META = useMemo(
    () => ({
      hyperliquid: { id: "hyperliquid", label: "Hyperliquid", feeBps: 5, type: "offchain" },
      uniswap: { id: "uniswap", label: "Uniswap", feeBps: 30, type: "dex" },
      pancake: { id: "pancake", label: "PancakeSwap", feeBps: 25, type: "dex" },
      apeswap: { id: "apeswap", label: "ApeSwap", feeBps: 25, type: "dex" },
      biswap: { id: "biswap", label: "BiSwap", feeBps: 20, type: "dex" }
    }),
    []
  );

  const [fromToken, setFromToken] = useState(tokenList?.[0]?.address || "");
  const [toToken, setToToken] = useState(tokenList?.[1]?.address || "");
  const [amount, setAmount] = useState("0.01");
  const [fromBalance, setFromBalance] = useState("0.000000");
  const [quote, setQuote] = useState(null);
  const [slippage, setSlippage] = useState(1.0);
  const [minReceive, setMinReceive] = useState(null);
  const [priceImpact, setPriceImpact] = useState(null);
  const [statusKey, setStatusKey] = useState("");
  const [toast, setToast] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [networkSummary, setNetworkSummary] = useState({ loading: false });
  const [networkError, setNetworkError] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSig, setAiSig] = useState("");
  const [gasInfo, setGasInfo] = useState({ loading: false });
  const [showChart, setShowChart] = useState(false);
  const [proMode, setProMode] = useState(false);
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);
  const [routeQuotes, setRouteQuotes] = useState({ loading: false, list: [], best: null });
  const [selectedDex, setSelectedDex] = useState("auto"); // auto | hyperliquid | uniswap | pancake
  const [showRouteBox, setShowRouteBox] = useState(false);
  const [userRouters, setUserRouters] = useState({});
  const slippageRef = useRef(null);
  const aiDisabled = true;

  const signer = useMemo(() => provider?.getSigner(), [provider]);
  const resolvedDexId = selectedDex === "auto" ? routeQuotes?.best?.id || "pancake" : selectedDex;
  const routerMap = useMemo(() => {
    if (dexRouters && Object.keys(dexRouters || {}).length) return dexRouters;
    if (chainCfg?.dexRouters && Object.keys(chainCfg.dexRouters || {}).length) return chainCfg.dexRouters;
    return {};
  }, [dexRouters, chainCfg]);
  const resolveRouterAddress = (id) => userRouters[id] || routerMap[id] || "";
  const routerAddress = useMemo(() => resolveRouterAddress(resolvedDexId) || ROUTER_FALLBACK, [resolvedDexId, userRouters, routerMap, ROUTER_FALLBACK]);
  const router = useMemo(() => (signer && routerAddress ? new ethers.Contract(routerAddress, RouterABI, signer) : null), [signer, routerAddress]);
  const factoryAddress = chainCfg?.factory || FACTORY_ADDRESS;
  const factory = useMemo(() => (provider && factoryAddress ? new ethers.Contract(factoryAddress, FactoryABI, provider) : null), [provider, factoryAddress]);

  useEffect(() => {
    if (!tokenList?.length) return;
    const addrs = tokenList.map((t) => t.address.toLowerCase());
    if (!fromToken || !addrs.includes(fromToken.toLowerCase())) {
      setFromToken(tokenList[0].address);
    }
    if (!toToken || !addrs.includes(toToken.toLowerCase())) {
      setToToken(tokenList[Math.min(1, tokenList.length - 1)].address);
    }
  }, [tokenList, fromToken, toToken]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("limeone.dexRouters");
      if (raw) setUserRouters(JSON.parse(raw));
    } catch (_) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("limeone.dexRouters", JSON.stringify(userRouters));
    } catch (_) {
      /* ignore */
    }
  }, [userRouters]);

  const sym = (addr) => {
    const resolved = resolveAddress(addr || "");
    const token = tokenList.find((t) => t.address === addr || resolveAddress(t.address) === resolved);
    return token?.symbol || "";
  };
  const decimalsOf = (addr) => {
    const resolved = resolveAddress(addr || "");
    const token = tokenList.find((t) => t.address === addr || resolveAddress(t.address) === resolved);
    return token?.decimals || 18;
  };

  useEffect(() => {
    if (isConnected) setStatusKey("");
  }, [isConnected]);

  useEffect(() => {
    if (!provider || !account || !fromToken) return;
    let t;
    const load = async () => {
      if (fromToken === ALIAS_BNB) {
        const bal = await provider.getBalance(account);
        setFromBalance(Number(ethers.utils.formatUnits(bal, 18)).toFixed(6));
      } else {
        const erc20 = new ethers.Contract(resolveAddress(fromToken), ERC20ABI, provider);
        const bal = await erc20.balanceOf(account);
        setFromBalance(Number(ethers.utils.formatUnits(bal, decimalsOf(fromToken))).toFixed(6));
      }
    };
    load();
    t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [provider, account, fromToken, pollMs]);

  useEffect(() => {
    if (experienceMode !== "beginner") return;
    const balNum = Number(fromBalance) || 0;
    const nextAmount = ((balNum * sliderValue) / 100).toFixed(6);
    setAmount(nextAmount);
  }, [sliderValue, fromBalance, experienceMode]);

  // 견적/가격영향: 입력 변화 시 디바운스 계산
  useEffect(() => {
    if (!fromToken || !toToken || !amount) return;
    if (isWrapPath(fromToken, toToken) || isUnwrapPath(fromToken, toToken)) {
      const amtNum = Number(amount) || 0;
      setQuote(amtNum);
      setMinReceive(amtNum);
      setPriceImpact(0);
      return;
    }
    if (!router) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const path = [resolveAddress(fromToken), resolveAddress(toToken)];
        if (path[0] === path[1]) {
          setQuote(null);
          setMinReceive(null);
          setPriceImpact(null);
          return;
        }
        const decIn = decimalsOf(fromToken);
        const decOut = decimalsOf(toToken);
        const inWei = ethers.utils.parseUnits(amount || "0", decIn);
        const amtNum = Number(amount) || 0;
        if (inWei.isZero() || !amtNum) {
          setQuote(null);
          setMinReceive(null);
          setPriceImpact(null);
          return;
        }

        // tinyAmountIn: 0.05% of the input, fallback to 0.0001 token to avoid 0 impact.
        const tinyCandidate = inWei.div(ethers.BigNumber.from(2000));
        const minUnit = ethers.BigNumber.from(10).pow(decIn > 4 ? decIn - 4 : 0);
        const tinyIn = tinyCandidate.isZero() ? minUnit : tinyCandidate;
        const tinyInHuman = Number(ethers.utils.formatUnits(tinyIn, decIn));

        const fetchMidFromReserves = async () => {
          if (!factory || !provider) return null;
          const pairAddr = await factory.getPair(path[0], path[1]);
          if (!pairAddr || pairAddr === ethers.constants.AddressZero) return null;
          const pair = new ethers.Contract(pairAddr, PairABI, provider);
          const [[reserve0, reserve1], token0, token1] = await Promise.all([pair.getReserves(), pair.token0(), pair.token1()]);
          const [reserveIn, reserveOut] = path[0].toLowerCase() === token0.toLowerCase() ? [reserve0, reserve1] : [reserve1, reserve0];
          const resIn = Number(ethers.utils.formatUnits(reserveIn, decIn));
          const resOut = Number(ethers.utils.formatUnits(reserveOut, decOut));
          if (!resIn || !resOut) return null;
          return resOut / resIn;
        };

        const safeGetAmountsOut = async (amt, p) => {
          try {
            return await router.getAmountsOut(amt, p);
          } catch (err) {
            console.warn("getAmountsOut failed", err);
            return null;
          }
        };

        const [amounts, tiny, midFromReserves] = await Promise.all([
          safeGetAmountsOut(inWei, path),
          tinyInHuman ? safeGetAmountsOut(tinyIn, path) : Promise.resolve(null),
          fetchMidFromReserves().catch(() => null)
        ]);
        if (cancelled) return;
        if (!amounts) {
          setQuote(null);
          setMinReceive(null);
          setPriceImpact(null);
          return;
        }
        const out = Number(ethers.utils.formatUnits(amounts[1], decOut));
        const execPrice = out / amtNum;

        const mids = [];
        if (midFromReserves && Number.isFinite(midFromReserves)) mids.push(midFromReserves);
        if (tiny && tinyInHuman) {
          const tinyOut = Number(ethers.utils.formatUnits(tiny[1], decOut));
          const mid = tinyOut && tinyInHuman ? tinyOut / tinyInHuman : null;
          if (mid && Number.isFinite(mid)) mids.push(mid);
        }
        const midPrice = mids.find((m) => m > 0);
        const impactPct = midPrice ? ((execPrice - midPrice) / midPrice) * 100 : null;

        setQuote(out);
        setPriceImpact(impactPct);
        setMinReceive(out * (1 - (Number(slippage) || 0) / 100));
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setQuote(null);
        setMinReceive(null);
        setPriceImpact(null);
      }
    }, 380);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router, fromToken, toToken, amount, slippage, factory, provider]);

  const handleSwapClick = () => {
    if (!isConnected) {
      setStatusKey("needConnect");
      onRequestConnect?.();
      return;
    }
    const wrapMode = isWrapPath(fromToken, toToken);
    const unwrapMode = isUnwrapPath(fromToken, toToken);
    if (resolveAddress(fromToken) === resolveAddress(toToken)) return;
    if (wrapMode || unwrapMode) {
      executeSwap();
      return;
    }
    const bestId = routeQuotes?.best?.id || "pancake";
    setSelectedDex(bestId);
    setShowRouteBox(true);
    setShowConfirm(false);
  };

  const executeSwap = async (forcedDexId) => {
    if (!isConnected) {
      setStatusKey("needConnect");
      onRequestConnect?.();
      setShowConfirm(false);
      setShowRouteBox(false);
      return;
    }
    const currentDexId = forcedDexId || resolvedDexId;
    const targetRouter = resolveRouterAddress(currentDexId) || ROUTER_ADDRESS;
    if (!targetRouter) {
      alert(`${DEX_META[currentDexId]?.label || currentDexId}: ${txt.unsupported}`);
      return;
    }
    const routeTag =
      currentDexId !== "pancake"
        ? language === "ko"
          ? ` (${DEX_META[currentDexId]?.label || currentDexId} 실행)`
          : ` (exec on ${DEX_META[currentDexId]?.label || currentDexId})`
        : ` (${DEX_META[currentDexId]?.label || "PancakeSwap"})`;
    const routerForSwap = new ethers.Contract(targetRouter, RouterABI, signer);
    const wrapMode = isWrapPath(fromToken, toToken);
    const unwrapMode = isUnwrapPath(fromToken, toToken);
    const nativeIn = isNativeInput(fromToken) && !wrapMode && !unwrapMode;
    const nativeOut = isNativeOutput(toToken) && !wrapMode && !unwrapMode;
    try {
      setShowConfirm(false);
      setStatusKey("progress");
      if (wrapMode || unwrapMode) {
        const wbnb = new ethers.Contract(WBNB_ADDR, IWBNB_ABI, signer);
        const amtWei = ethers.utils.parseEther(amount || "0");
        if (amtWei.isZero()) throw new Error("Amount is zero");
        const tx = wrapMode ? await wbnb.deposit({ value: amtWei }) : await wbnb.withdraw(amtWei);
        await tx.wait();
        const timestamp = new Date().toLocaleString();
        setStatusKey("");
        setToast({
          type: "success",
          message: wrapMode ? "Wrap 완료" : "Unwrap 완료",
          detail: wrapMode ? `${amount} BNB → WBNB` : `${amount} WBNB → BNB`,
          time: timestamp
        });
        if (onSwapSuccess) {
          onSwapSuccess({
            id: `${Date.now()}`,
            type: wrapMode ? "wrap" : "unwrap",
            detail: wrapMode ? `${amount} BNB → WBNB` : `${amount} WBNB → BNB`,
            time: timestamp,
          txHash: tx.hash,
          from: account,
          to: WBNB_ADDR,
          changes: wrapMode
            ? [
                { token: "BNB", change: `-${amount}` },
                { token: "WBNB", change: `+${amount}` }
              ]
              : [
                  { token: "WBNB", change: `-${amount}` },
                  { token: "BNB", change: `+${amount}` }
                ]
          });
        }
      } else if (nativeIn) {
        const decIn = 18;
        const decOut = decimalsOf(toToken);
        const amountIn = ethers.utils.parseUnits(amount, decIn);
        const path = [WBNB_ADDR, resolveAddress(toToken)];
        if (amountIn.isZero()) throw new Error("Amount is zero");

        const amountsOut = await routerForSwap.getAmountsOut(amountIn, path);
        const outMin = amountsOut[1].mul(ethers.BigNumber.from(10000 - Math.floor((Number(slippage) || 0) * 100))).div(10000);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        const hasEthFn = typeof routerForSwap?.functions?.swapExactETHForTokens === "function";
        let tx2;
        if (hasEthFn) {
          tx2 = await routerForSwap.swapExactETHForTokens(outMin, path, account, deadline, { value: amountIn });
          await tx2.wait();
        } else {
          // fallback: wrap -> approve -> swapExactTokensForTokens
          const wbnb = new ethers.Contract(WBNB_ADDR, IWBNB_ABI, signer);
          const tokenIn = new ethers.Contract(WBNB_ADDR, ERC20ABI, signer);
          const wrapTx = await wbnb.deposit({ value: amountIn });
          await wrapTx.wait();
          const allow = await tokenIn.allowance(account, routerForSwap.address);
          if (allow.lt(amountIn)) {
            const tx1 = await tokenIn.approve(routerForSwap.address, amountIn);
            await tx1.wait();
          }
          tx2 = await routerForSwap.swapExactTokensForTokens(amountIn, outMin, path, account, deadline);
          await tx2.wait();
        }
        const timestamp = new Date().toLocaleString();
        const outFormatted = Number(ethers.utils.formatUnits(amountsOut[1], decOut)).toFixed(6);
        setStatusKey("");
        setToast({
          type: "success",
          message: txt.swapSuccess,
          detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
          time: timestamp
        });
        setShowRouteBox(false);
        onSwapSuccess?.({
          id: `${Date.now()}`,
          type: "swap",
          detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
          time: timestamp,
          txHash: tx2.hash,
          from: account,
          to: routerForSwap.address,
          changes: [
            { token: sym(fromToken), change: `-${amount}` },
            { token: sym(toToken), change: `+${outFormatted}` }
          ]
        });
      } else if (nativeOut) {
        const decIn = decimalsOf(fromToken);
        const amountIn = ethers.utils.parseUnits(amount, decIn);
        const tokenIn = new ethers.Contract(resolveAddress(fromToken), ERC20ABI, signer);
        const path = [resolveAddress(fromToken), WBNB_ADDR];

        const allow = await tokenIn.allowance(account, routerForSwap.address);
        if (allow.lt(amountIn)) {
          const tx1 = await tokenIn.approve(routerForSwap.address, amountIn);
          await tx1.wait();
        }

        const amountsOut = await routerForSwap.getAmountsOut(amountIn, path);
        const outMin = amountsOut[1].mul(ethers.BigNumber.from(10000 - Math.floor((Number(slippage) || 0) * 100))).div(10000);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        const hasEthFn = typeof routerForSwap?.functions?.swapExactTokensForETH === "function";
        if (hasEthFn) {
          const tx2 = await routerForSwap.swapExactTokensForETH(amountIn, outMin, path, account, deadline);
          await tx2.wait();
          const timestamp = new Date().toLocaleString();
          const outFormatted = Number(ethers.utils.formatUnits(amountsOut[1], 18)).toFixed(6);
          setStatusKey("");
          setToast({
            type: "success",
            message: txt.swapSuccess,
            detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
            time: timestamp
          });
          setShowRouteBox(false);
          onSwapSuccess?.({
            id: `${Date.now()}`,
            type: "swap",
            detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
            time: timestamp,
            txHash: tx2.hash,
            from: account,
            to: routerForSwap.address,
            changes: [
              { token: sym(fromToken), change: `-${amount}` },
              { token: sym(toToken), change: `+${outFormatted}` }
            ]
          });
        } else {
          // fallback: swap to WBNB then unwrap only the swap output
          const txSwap = await routerForSwap.swapExactTokensForTokens(amountIn, outMin, path, account, deadline);
          await txSwap.wait();
          const wbnb = new ethers.Contract(WBNB_ADDR, IWBNB_ABI, signer);
          const outAmt = amountsOut[1];
          const txUnwrap = await wbnb.withdraw(outAmt);
          await txUnwrap.wait();
          const timestamp = new Date().toLocaleString();
          const outFormatted = Number(ethers.utils.formatUnits(outAmt, 18)).toFixed(6);
          setStatusKey("");
          setToast({
            type: "success",
            message: txt.swapSuccess,
            detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
            time: timestamp
          });
          setShowRouteBox(false);
          onSwapSuccess?.({
            id: `${Date.now()}`,
            type: "swap",
            detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
            time: timestamp,
            txHash: txUnwrap.hash || txSwap.hash,
            from: account,
            to: routerForSwap.address,
            changes: [
              { token: sym(fromToken), change: `-${amount}` },
              { token: sym(toToken), change: `+${outFormatted}` }
            ]
          });
        }
      } else {
        const decIn = decimalsOf(fromToken);
        const tokenIn = new ethers.Contract(resolveAddress(fromToken), ERC20ABI, signer);
        const amountIn = ethers.utils.parseUnits(amount, decIn);
        const path = [resolveAddress(fromToken), resolveAddress(toToken)];

        const allow = await tokenIn.allowance(account, routerForSwap.address);
        if (allow.lt(amountIn)) {
          const tx1 = await tokenIn.approve(routerForSwap.address, amountIn);
          await tx1.wait();
        }

        const amountsOut = await routerForSwap.getAmountsOut(amountIn, path);
        const outMin = amountsOut[1].mul(ethers.BigNumber.from(10000 - Math.floor((Number(slippage) || 0) * 100))).div(10000);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        const tx2 = await routerForSwap.swapExactTokensForTokens(amountIn, outMin, path, account, deadline);
        await tx2.wait();
        const timestamp = new Date().toLocaleString();
        const outFormatted = Number(ethers.utils.formatUnits(amountsOut[1], decimalsOf(toToken))).toFixed(6);
        setStatusKey("");
        setToast({
          type: "success",
          message: txt.swapSuccess,
          detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
          time: timestamp
        });
        setShowRouteBox(false);
        onSwapSuccess?.({
          id: `${Date.now()}`,
          type: "swap",
          detail: `${amount} ${sym(fromToken)} → ${outFormatted} ${sym(toToken)}${routeTag}`,
          time: timestamp,
          txHash: tx2.hash,
          from: account,
          to: ROUTER_ADDRESS,
          changes: [
            { token: sym(fromToken), change: `-${amount}` },
            { token: sym(toToken), change: `+${outFormatted}` }
          ]
        });
      }
    } catch (e) {
      console.error(e);
      setStatusKey("");
      alert(txt.swapFail + (e?.data?.message || e?.message || e));
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const handler = (e) => {
      if (!showSlippagePanel) return;
      if (slippageRef.current && !slippageRef.current.contains(e.target)) {
        setShowSlippagePanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSlippagePanel]);

  const slippageWarning = Number(slippage) > 2;
  const samePath = resolveAddress(fromToken) === resolveAddress(toToken) && !isWrapPath(fromToken, toToken) && !isUnwrapPath(fromToken, toToken);
  const amountValid = Boolean(amount) && Number(amount) > 0;
  const swapDisabled = statusKey === "progress" || samePath || !amountValid;
  const swapLabel = statusKey === "progress" ? txt.inProgress : !isConnected ? txt.connectBtn : statusKey === "needConnect" ? txt.needConnect : txt.quoteCheck || txt.swapBtn;
  const resolvedDexMeta = DEX_META[resolvedDexId] || DEX_META.pancake;
  const selectedExecId = selectedDex === "auto" ? routeQuotes?.best?.id || "pancake" : selectedDex;
  const selectedRouterAddr = resolveRouterAddress(selectedExecId);
  const handleSliderChange = (val) => {
    const next = Math.max(0, Math.min(100, Number(val)));
    setSliderValue(next);
    if (experienceMode !== "beginner") {
      const balNum = Number(fromBalance) || 0;
      setAmount(((balNum * next) / 100).toFixed(6));
    }
  };

  const handleRouteSelect = (id) => {
    setSelectedDex(id);
  };

  useEffect(() => {
    if (!provider) return;
    let t;
    const loadGas = async () => {
      try {
        setGasInfo((prev) => ({ ...prev, loading: true }));
        const gp = await provider.getGasPrice();
        const gwei = Number(ethers.utils.formatUnits(gp, "gwei"));
        let level = "low";
        if (gwei > 5 && gwei <= 15) level = "med";
        else if (gwei > 15) level = "high";
        setGasInfo({ loading: false, gwei, level, time: new Date().toLocaleTimeString() });
      } catch (e) {
        console.error(e);
        setGasInfo({ loading: false, error: e?.message });
      }
    };
    loadGas();
    t = setInterval(loadGas, 20000);
    return () => clearInterval(t);
  }, [provider]);

  // Compare expected output across Hyperliquid, Uniswap, Pancake (실행 라우터는 선택된 것으로 진행).
  useEffect(() => {
    const amtNum = Number(amount);
    if (!amtNum || !fromToken || !toToken) {
      setRouteQuotes({ loading: false, list: [], best: null });
      return;
    }
    const baseOut =
      quote !== null
        ? Number(quote)
        : networkSummary?.priceUsd && networkSummary?.priceUsdTo
          ? (amtNum * Number(networkSummary.priceUsd)) / Number(networkSummary.priceUsdTo || 1)
          : null;
    if (!baseOut || Number.isNaN(baseOut)) {
      setRouteQuotes({ loading: false, list: [], best: null });
      return;
    }
    const gasPenalty = gasInfo?.gwei ? Math.min((Number(gasInfo.gwei) || 0) * 0.00005, baseOut * 0.05) : 0;
    const dexIds =
      Object.keys(routerMap || {}).length > 0
        ? Object.keys(routerMap)
        : ["pancake", "apeswap", "biswap"];
    const entries = dexIds.map((id) => {
      const meta = DEX_META[id];
      const feeMul = 1 - (meta?.feeBps || 0) / 10000;
      const venueAdj = id === "hyperliquid" ? 1.001 : id === "uniswap" ? 0.999 : 1; // slight venue bias
      const est = Math.max(baseOut * feeMul * venueAdj - gasPenalty, 0);
      const addr = resolveRouterAddress(id);
      return {
        id,
        label: meta?.label || id,
        feeBps: meta?.feeBps || 0,
        amount: est,
        source: quote !== null ? "router" : "oracle",
        exec: Boolean(addr),
        address: addr
      };
    });
    const best = entries
      .filter((e) => e.address)
      .reduce((prev, curr) => (curr.amount > (prev?.amount || 0) ? curr : prev), null) || entries[0];
    setRouteQuotes({ loading: false, list: entries, best });
  }, [amount, fromToken, toToken, quote, networkSummary, gasInfo, DEX_META]);

  const swapTokens = () => {
    const prevFrom = fromToken;
    const prevTo = toToken;
    const nextAmount = quote !== null ? Number(quote).toFixed(6) : amount;
    setFromToken(prevTo);
    setToToken(prevFrom);
    setAmount(nextAmount);
    setQuote(null);
    setMinReceive(null);
    setPriceImpact(null);
    setSliderValue(0);
  };

  const handleAskTiming = () => {
    if (aiDisabled || !onAskAi) return;
    const fromSym = sym(fromToken);
    const toSym = sym(toToken);
    const quoteText = quote !== null ? `${quote.toFixed(6)} ${toSym}` : "N/A";
    const impactText = priceImpact !== null ? `${priceImpact.toFixed(3)}%` : "N/A";
    const minText = minReceive !== null ? `${minReceive.toFixed(6)} ${toSym}` : "N/A";
    const prompt = [
      `[Swap timing analysis request]`,
      `Pair: ${fromSym} -> ${toSym}`,
      `Input amount: ${amount} ${fromSym}`,
      `Estimated receive: ${quoteText}`,
      `Min receive (with slippage ${slippage}%): ${minText}`,
      `Price impact estimate: ${impactText}`,
      `User context: beginner=${experienceMode === "beginner" ? "yes" : "no"}`,
      `Please provide concise advice: timing considerations, slippage/impact risk, and whether splitting the trade might help. Avoid financial advice claims. Respond in the same language as the question (ko/en).`
    ].join("\n");
    onAskAi(prompt);
  };

  useEffect(() => {
    let aborted = false;
    // 외부 API(CoinGecko/dexscreener) 호출을 중단해 콘솔 에러(CORS/429)를 방지합니다.
    if (!fromToken || !toToken) return () => {};
    setNetworkSummary({ loading: false });
    setNetworkError(null);
    return () => {
      aborted = true;
    };
  }, [fromToken, toToken]);

  useEffect(() => {
    const aiKey = (typeof window !== "undefined" && window.localStorage.getItem("limeone.aiKey")) || process.env.AI_API_KEY;
    const sig = `${fromToken}-${toToken}-${priceImpact ?? "na"}-${quote ?? "na"}-${minReceive ?? "na"}`;
    if (sig === aiSig) return;
    setAiSig(sig);
    if (aiDisabled) {
      setAiSummary(language === "ko" ? "AI 기능이 일시 중지되었습니다." : "AI features are temporarily disabled.");
      setAiLoading(false);
      return;
    }
    const prompt = [
      `[Swap timing quick summary]`,
      `Pair: ${sym(fromToken)} -> ${sym(toToken)}`,
      `Input amount: ${amount} ${sym(fromToken)}`,
      `Estimated receive: ${quote !== null ? `${quote.toFixed(6)} ${sym(toToken)}` : "N/A"}`,
      `Min receive (slippage ${slippage}%): ${minReceive !== null ? `${minReceive.toFixed(6)} ${sym(toToken)}` : "N/A"}`,
      `Price impact estimate: ${priceImpact !== null ? `${priceImpact.toFixed(3)}%` : "N/A"}`,
      `Liquidity (approx USD): ${networkSummary?.liquidityUSD ? `$${networkSummary.liquidityUSD.toLocaleString()}` : "N/A"}`,
      `Please provide 2-3 concise bullet points for timing/slippage caution. Avoid financial advice wording. Respond in the same language (ko/en).`
    ].join("\n");

    const run = async () => {
      setAiLoading(true);
      if (!aiKey) {
        setAiSummary(txt.failed);
        setAiLoading(false);
        return;
      }
      try {
        const resp = await callChatCompletion({
          apiKey: aiKey,
          messages: [
            { role: "system", content: "Provide brief swap timing/slippage hints. Avoid financial advice. Keep to 2-3 bullet lines." },
            { role: "user", content: prompt }
          ]
        });
        setAiSummary(resp);
      } catch (e) {
        console.error(e);
        setAiSummary(txt.failed);
      } finally {
        setAiLoading(false);
      }
    };
    run();
  }, [fromToken, toToken, priceImpact, quote, minReceive, slippage, aiSig, aiDisabled, language, txt.failed, networkSummary, amount]);

  return (
    <div className="swap-square" style={{ width: "100%", display: "flex", gap: 16, justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
      {showChart && (
        <div style={{ width: "min(100%, 280px)", minHeight: 200, background: isLight ? "#ffffff" : "#0f131a", border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633", borderRadius: 14, padding: 12, boxShadow: isLight ? "0 10px 24px rgba(15,23,42,0.08)" : "0 16px 30px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>차트</span>
            <span style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{sym(fromToken)} / {sym(toToken)}</span>
          </div>
          <div style={{ height: 160, borderRadius: 10, background: isLight ? "linear-gradient(135deg, #e5e7eb 0%, #f8fafc 100%)" : "linear-gradient(135deg, #111827 0%, #0b1220 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: isLight ? "#4b5563" : "#9ca3af", fontSize: 12 }}>
            차트 데이터를 연결하세요
          </div>
        </div>
      )}

      <div
        style={{
          width: "60%",
          background: isLight ? "#f8fafc" : "radial-gradient(circle at 20% 20%, #121826 0%, #0c1019 38%, #080b12 100%)",
          borderRadius: 24,
          padding: 16,
          border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
          boxShadow: isLight ? "0 10px 30px rgba(15,23,42,0.1)" : "0 20px 50px rgba(0,0,0,0.45)",
          color: isLight ? "#0b0f25" : "#e9eef4",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 10px", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: isLight ? "#0b0f25" : "#f8fafc" }}>Swap</span>
            {chainOptions?.length > 0 && (
              <select
                value={chainKey}
                onChange={(e) => onChainChange?.(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
                  background: isLight ? "#ffffff" : "#0f131a",
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setShowChart((v) => !v)}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
                background: "transparent",
                color: showChart ? "#1d4ed8" : "inherit",
                fontWeight: showChart ? 800 : 700,
                cursor: "pointer"
              }}
              title="차트 보기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 8 10 12 14 20 6" />
                <polyline points="20 10 20 6 16 6" />
              </svg>
            </button>
            <button
              onClick={() => setProMode((v) => !v)}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
                background: "transparent",
                color: proMode ? "#0ea5e9" : "inherit",
                fontWeight: proMode ? 800 : 700,
                cursor: "pointer"
              }}
              title="Pro 정보"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.2 22 12 18.56 5.8 22 7 14.14l-5-4.87 7.1-1.01z" />
              </svg>
            </button>
            <div style={{ position: "relative" }} ref={slippageRef}>
              <button
                onClick={() => setShowSlippagePanel((v) => !v)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
                  background: "transparent",
                  color: showSlippagePanel ? "#f97316" : "inherit",
                  fontWeight: showSlippagePanel ? 800 : 700,
                  cursor: "pointer"
                }}
                title="Slippage"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="19" cy="5" r="2" />
                  <circle cx="19" cy="19" r="2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                  <line x1="19" y1="7" x2="19" y2="17" />
                </svg>
              </button>
              {showSlippagePanel && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    marginTop: 8,
                    background: isLight ? "#ffffff" : "#0f131a",
                    border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
                    borderRadius: 12,
                    padding: 12,
                    boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
                    minWidth: 200,
                    zIndex: 50
                  }}
                >
                  <div style={{ fontSize: 13, color: isLight ? "#111827" : "#e5e7eb", marginBottom: 8 }}>{txt.slippage}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633", background: "transparent", color: "inherit" }}
                    />
                    <span style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>%</span>
                  </div>
                  {slippageWarning && <div style={{ marginTop: 6, fontSize: 12, color: "#f97316" }}>{txt.slippageHigh}</div>}
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
                    {minReceive !== null && <span>{txt.minReceive}: {minReceive.toFixed(6)} {sym(toToken)}</span>}
                    {priceImpact !== null && <span>{txt.priceImpact}: {priceImpact.toFixed(3)}%</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? "#111827" : "#d1d5db" }}>Selling</div>
            <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
              {txt.fromBal}: {fromBalance} {sym(fromToken)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              placeholder={txt.amountPh}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderRadius: 0,
                padding: 0,
                color: "inherit",
                fontSize: 34,
                fontWeight: 700,
                outline: "none"
              }}
            />
            <TokenSelect
              list={tokenList}
              value={fromToken}
              onChange={setFromToken}
              chainOptions={chainOptions}
              chainKey={chainKey}
              onChainChange={onChainChange}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderValue}
              onChange={(e) => handleSliderChange(e.target.value)}
              style={{ flex: 1, accentColor: isLight ? "#8b5cf6" : "#22d3ee" }}
            />
            <span style={{ width: 50, textAlign: "right", fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{sliderValue}%</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
          <button
            onClick={swapTokens}
            title={txt.swapSwitch}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
              background: isLight ? "#f1f5f9" : "#0c1019",
              color: isLight ? "#0b0f25" : "#e9eef4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isLight ? "0 6px 14px rgba(15,23,42,0.12)" : "0 10px 22px rgba(0,0,0,0.4)"
            }}
          >
            ⇅
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? "#111827" : "#d1d5db" }}>Buying</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              placeholder={txt.expected}
              value={quote !== null ? quote.toFixed(6) : ""}
              readOnly
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "inherit",
                fontSize: 32,
                fontWeight: 700,
                opacity: 0.9
              }}
            />
            <TokenSelect
              list={tokenList}
              value={toToken}
              onChange={setToToken}
              chainOptions={chainOptions}
              chainKey={chainKey}
              onChainChange={onChainChange}
            />
          </div>
        </div>

        <button
          onClick={handleSwapClick}
          disabled={swapDisabled}
          title={isConnected ? "" : txt.needConnect}
          style={{
            width: "100%",
            marginTop: 14,
            background: swapDisabled ? "rgba(249,115,22,0.45)" : "#f97316",
            color: "#ffffff",
            border: "none",
            borderRadius: 18,
            padding: "14px 16px",
            fontSize: 17,
            fontWeight: 700,
            cursor: swapDisabled ? "not-allowed" : "pointer",
            boxShadow: swapDisabled ? "none" : "0 12px 30px rgba(249,115,22,0.32)"
          }}
        >
          {swapLabel}
        </button>
      </div>
      {showRouteBox && (
        <div
          style={{
            width: "min(100%, 300px)",
            background: isLight ? "#ffffff" : "#0f131a",
            border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633",
            borderRadius: 14,
            padding: 14,
            boxShadow: isLight ? "0 10px 24px rgba(15,23,42,0.08)" : "0 16px 30px rgba(0,0,0,0.35)",
            minHeight: 180,
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800 }}>{txt.routeBoxTitle}</span>
            {routeQuotes?.best?.id && (
              <span style={{ fontSize: 12, color: "#16a34a" }}>{txt.bestBadge}: {DEX_META[routeQuotes.best.id]?.label}</span>
            )}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {(routeQuotes?.list || [])
              .filter((r) => resolveRouterAddress(r.id))
              .map((r) => {
              const best = routeQuotes?.best?.id === r.id;
              const available = Boolean(resolveRouterAddress(r.id));
              return (
                <div
                  key={r.id}
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    border: best ? "2px solid #f97316" : isLight ? "1px solid #e5e7eb" : "1px solid #1f2633",
                    background: best ? (isLight ? "#fff7ed" : "#1f2937") : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: isLight ? "#f3f4f6" : "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                    {(r.label || "?").charAt(0)}
                  </div>
                  <div style={{ minWidth: 110, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 800 }}>{r.label}</span>
                    {best && <span style={{ fontSize: 12, color: "#16a34a" }}>{txt.bestBadge}</span>}
                  </div>
                  <div style={{ minWidth: 120, fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
                    {txt.priceImpactLabel}: -
                  </div>
                  <div style={{ minWidth: 160, fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
                    {txt.routeBestAmount}: {r.amount ? r.amount.toFixed(6) : "-"} {sym(toToken)}
                  </div>
                  <div style={{ minWidth: 100, fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>
                    Fee: {(r.feeBps / 100).toFixed(2)}%
                  </div>
                  <button
                    onClick={() => {
                      if (!available) {
                        alert(txt.unsupported);
                        return;
                      }
                      setSelectedDex(r.id);
                      setShowRouteBox(false);
                      executeSwap(r.id);
                    }}
                    disabled={!available || swapDisabled}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "none",
                      background: !available || swapDisabled ? "rgba(249,115,22,0.45)" : "#f97316",
                      color: "#ffffff",
                      fontWeight: 800,
                      cursor: !available || swapDisabled ? "not-allowed" : "pointer",
                      boxShadow: !available || swapDisabled ? "none" : "0 8px 18px rgba(249,115,22,0.25)"
                    }}
                  >
                    {txt.swapBtn}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {proMode && (
        <div style={{ width: "min(100%, 280px)", background: isLight ? "#ffffff" : "#0f131a", border: isLight ? "1px solid #d1d5db" : "1px solid #1f2633", borderRadius: 14, padding: 12, boxShadow: isLight ? "0 10px 24px rgba(15,23,42,0.08)" : "0 16px 30px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>네트워크 상황</span>
            <span style={{ fontSize: 12, color: isLight ? "#6b7280" : "#9ca3af" }}>{networkSummary?.time || "-"}</span>
          </div>
          <div style={{ fontSize: 13, color: isLight ? "#111827" : "#e5e7eb", display: "grid", gap: 6 }}>
            <span>유동성(USD): {networkSummary?.liquidityUSD ? `$${Number(networkSummary.liquidityUSD).toLocaleString()}` : "-"}</span>
            <span>{sym(fromToken)}: {networkSummary?.priceUsd ? `$${networkSummary.priceUsd}` : "-"}</span>
            <span>{sym(toToken)}: {networkSummary?.priceUsdTo ? `$${networkSummary.priceUsdTo}` : "-"}</span>
            <span>가스: {gasInfo?.loading ? txt.fetching : gasInfo?.gwei ? `${gasInfo.gwei.toFixed(1)} gwei` : "-"} ({gasInfo?.level || "-"})</span>
            {priceImpact !== null && <span>가격 영향: {priceImpact.toFixed(3)}%</span>}
            {networkError && <span style={{ color: "#f87171" }}>{txt.failed}</span>}
          </div>
        </div>
      )}

      {showConfirm && experienceMode !== "beginner" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
          <div style={{ background: isLight ? "#ffffff" : "#12161f", padding: 20, borderRadius: 14, width: "90%", maxWidth: 420, border: isLight ? "1px solid #e5e7eb" : "1px solid #1f2633", color: isLight ? "#0b0f25" : "#e9eef4" }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>{txt.confirmTitle}</h4>
            <div className="muted" style={{ marginBottom: 12 }}>{txt.confirmDesc}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              <div><strong>Sell:</strong> {amount} {sym(fromToken)}</div>
              <div><strong>Buy (est):</strong> {quote !== null ? quote.toFixed(6) : "-"} {sym(toToken)}</div>
              {minReceive !== null && <div><strong>{txt.minReceive}:</strong> {minReceive.toFixed(6)} {sym(toToken)}</div>}
              <div><strong>{txt.slippage}:</strong> {slippage}%</div>
              {priceImpact !== null && <div><strong>{txt.priceImpact}:</strong> {priceImpact.toFixed(3)}%</div>}
              {slippageWarning && <div style={{ color: "#f97316" }}>{txt.slippageHigh}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowConfirm(false)} style={{ background: "transparent", border: "1px solid #293244", color: "#e9eef4" }}>{txt.cancel}</button>
              <button onClick={executeSwap} disabled={statusKey === "progress"}>
                {statusKey === "progress" ? txt.inProgress : txt.confirmProceed}
              </button>
            </div>
          </div>
        </div>
      )}
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
              alignItems: "center",
              gap: 8,
              minWidth: 240,
              maxWidth: "92vw",
              animation: "toast-pop 240ms ease, toast-hide 200ms ease 2.6s forwards",
              willChange: "transform, opacity",
              pointerEvents: "auto"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700 }}>{toast.message}</span>
              {toast.detail && <span style={{ fontSize: 13, opacity: 0.9 }}>{toast.detail}</span>}
              {toast.time && <span style={{ fontSize: 12, opacity: 0.7 }}>{toast.time}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
