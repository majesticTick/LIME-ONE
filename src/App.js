import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { ethers } from "ethers";
import { CHAIN_ID, WBNB, BUSD, POLL_MS, DEFAULT_TOKENS, CHAINS, DEFAULT_CHAIN_KEY } from "./config";
import tokenListJson from "./tokens.json";
import Market from "./components/Market.jsx";
import AssetActivity from "./components/AssetActivity.jsx";
import { bnbLogoDataUrl } from "./assets/bnbLogoData";
import { busdLogoDataUrl } from "./assets/busdLogoData";
import { logoLightDataUrl, logoDarkDataUrl } from "./assets/logoData";
import Liquidity from "./components/Liquidity";
import { metamaskLogoDataUrl } from "./assets/metamaskLogoData";
import { trustWalletLogoDataUrl } from "./assets/trustWalletLogoData";
import { phantomWalletLogoDataUrl } from "./assets/phantomWalletLogoData";
import Swap from "./Swap";
import { callChatCompletion } from "./utils/aiClient";
import tetherLogo from "./assets/tether.svg";
import ethLogo from "./assets/eth.svg";
import tronLogo from "./assets/tron.svg";

const tokenLogoFallback =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%231f2937'/%3E%3Cpath d='M18 32h28M32 18v28' stroke='%23f97316' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E";
const resolveImgSrc = (src) => (typeof src === "string" ? src : src?.default || tokenLogoFallback);

const ERC20_BAL_ABI = [
  { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], type: "function" }
];

const themeConfig = {
  dark: {
    background: "#000000",
    surface: "#000000",
    text: "#ffffff",
    subtext: "#9ca3af",
    accent: "#ff751f",
    border: "#2f3746"
  },
  light: {
    background: "#ffffff",
    surface: "#ffffff",
    text: "#0b0f25",
    subtext: "#6b7280",
    accent: "#ff751f",
    border: "#d1d5db"
  }
};

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState("trade");
  const [tradeView, setTradeView] = useState("swap");
  const [tradeTabMenuOpen, setTradeTabMenuOpen] = useState(false);
  const tradeTabHoverTimer = useRef(null);
  const [balances, setBalances] = useState({ native: "0.0", wbnb: "0.0", busd: "0.0" });
  const fallbackTokens = Array.isArray(DEFAULT_TOKENS) && DEFAULT_TOKENS.length > 0 ? DEFAULT_TOKENS : tokenListJson || [];
  const [tokenList, setTokenList] = useState(fallbackTokens);
  const [showSettings, setShowSettings] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [theme, setTheme] = useState("light");
  const [chainId, setChainId] = useState(null);
  const [chainKey, setChainKey] = useState(DEFAULT_CHAIN_KEY);
  const activeChainCfg = useMemo(() => CHAINS[chainKey] || CHAINS[DEFAULT_CHAIN_KEY] || CHAINS.bscTestnet, [chainKey]);
  const chainOptions = useMemo(() => Object.values(CHAINS).map((c) => ({ key: c.key, name: c.name })), []);
  const defaultDexRouters = useMemo(() => CHAINS[DEFAULT_CHAIN_KEY]?.dexRouters || CHAINS.bscTestnet?.dexRouters || {}, []);
  const [language, setLanguage] = useState("ko");
  const [copied, setCopied] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [experienceMode, setExperienceMode] = useState("beginner"); // beginner | expert
  const [toast, setToast] = useState(null);
  const envAiKey = process.env.AI_API_KEY || "";
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [aiApiKey, setAiApiKey] = useState(envAiKey || "");
  const [introReveal, setIntroReveal] = useState({ hero: false, nft: false, features: false, why: false, cta: false });
  const introHeroRef = useRef(null);
  const introNftRef = useRef(null);
  const introFeaturesRef = useRef(null);
  const introWhyRef = useRef(null);
  const introCtaRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeTheme = themeConfig[theme];
  const logoSrc = theme === "light" ? logoLightDataUrl : logoDarkDataUrl;
  const logoFallbackSrc = logoSrc;

  useEffect(() => {
    const nextTheme = themeConfig[theme];
    document.body.setAttribute("data-theme", theme);
    document.body.style.background = nextTheme.background;
    document.body.style.color = nextTheme.text;
  }, [theme]);
  useEffect(() => {
    if (activeChainCfg?.tokens) setTokenList(activeChainCfg.tokens);
  }, [activeChainCfg]);
  // 체인 드롭다운 전환 시 연결 상태 초기화
  useEffect(() => {
    setProvider(null);
    setAccount(null);
    setChainId(null);
  }, [chainKey]);
  useEffect(() => {
    if (tab !== "trade") setTradeTabMenuOpen(false);
  }, [tab]);
  const openTradeTabMenu = () => {
    if (tradeTabHoverTimer.current) clearTimeout(tradeTabHoverTimer.current);
    setTradeTabMenuOpen(true);
  };
  const closeTradeTabMenu = () => {
    if (tradeTabHoverTimer.current) clearTimeout(tradeTabHoverTimer.current);
    tradeTabHoverTimer.current = setTimeout(() => setTradeTabMenuOpen(false), 120);
  };
  const toggleTradeTabMenu = () => {
    if (tradeTabHoverTimer.current) clearTimeout(tradeTabHoverTimer.current);
    setTradeTabMenuOpen((prev) => !prev);
  };
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (cid) => {
      const num = typeof cid === "string" ? parseInt(cid, 16) || parseInt(cid, 10) : Number(cid);
      setChainId(num);
      const expected = activeChainCfg?.chainId;
      if (expected && num !== expected) {
        setProvider(null);
        setAccount(null);
      }
    };
    window.ethereum.on("chainChanged", handler);
    return () => {
      try {
        window.ethereum.removeListener("chainChanged", handler);
      } catch (_) {
        /* ignore */
      }
    };
  }, [activeChainCfg]);
  useEffect(() => {
    if (tab !== "intro") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIntroReveal((prev) => ({
              ...prev,
              [entry.target.dataset.key]: true
            }));
          }
        });
      },
      { threshold: 0.2 }
    );
    const targets = [
      { ref: introHeroRef, key: "hero" },
      { ref: introNftRef, key: "nft" },
      { ref: introFeaturesRef, key: "features" },
      { ref: introWhyRef, key: "why" },
      { ref: introCtaRef, key: "cta" }
    ];
    targets.forEach(({ ref, key }) => {
      if (ref.current) {
        ref.current.dataset.key = key;
        observer.observe(ref.current);
      }
    });
    return () => observer.disconnect();
  }, [tab]);

  const revealStyle = (show) => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(26px)",
    transition: "opacity 360ms ease, transform 360ms ease"
  });
  useEffect(() => {
    return () => {
      if (tradeTabHoverTimer.current) clearTimeout(tradeTabHoverTimer.current);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    const shouldLock = showWalletSelect || showSettings || mobileNavOpen;
    document.body.style.overflow = shouldLock ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = prev || "auto";
    };
  }, [showWalletSelect, showSettings, mobileNavOpen]);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const i18n = {
    ko: {
      tabTrade: "거래",
      tabNft: "NFT 마켓",
      tabMarket: "마켓",
      tabAssets: "자산",
      tabDocs: "Docs",
      connect: "지갑 연결",
      connecting: "연결중...",
      walletSelectTitle: "지갑 선택",
      walletSelectDesc: "연결할 지갑을 선택하세요.",
      metamask: "메타마스크",
      trustWallet: "트러스트월렛",
      phantomWallet: "팬텀월렛",
      comingSoon: "조만간 지원 예정",
      notConnected: "지갑을 연결해주세요...",
      tradeNotice: "지갑을 연결하면 스왑/랩핑이 활성화됩니다. 연결 없이도 화면은 볼 수 있어요.",
      swap: "스왑",
      liquidity: "유동성",
      wrap: "랩핑",
      settings: "설정",
      settingsTitle: "설정",
      theme: "테마",
      language: "언어",
      close: "닫기",
      disconnect: "지갑 연결해제",
      bscTestnet: "BSC Testnet",
      chain: "Chain",
      copy: "복사",
      copied: "복사됨",
      connectingWallet: "지갑을 연결하는 중입니다...",
      metamaskInstall: "Metamask를 설치해주세요.",
      switchToBsc: "BSC 네트워크(56/97)로 맞춰주세요.",
      copyFailed: "복사에 실패했습니다. 다시 시도해주세요.",
      mode: "모드",
      beginner: "초보자 모드",
      expert: "숙련자 모드",
      walletConnected: "지갑이 연결되었습니다.",
      walletDisconnected: "지갑 연결이 해제되었습니다.",
      chatTitle: "Ask AI",
      chatPlaceholder: "메시지를 입력하세요.",
      chatSend: "➤",
      aiKeyLabel: "OpenAI API Key",
      aiKeyPlaceholder: "sk-...",
      aiKeyHint: "키를 입력하면 로컬에만 저장됩니다.",
      aiKeyMissing: "API 키를 입력해주세요.",
      chatGuide: "",
      chatClose: "닫기",
      chatOpen: "AI 챗봇",
      chatError: "AI 응답에 실패했습니다.",
      chatClear: "↺",
      tabIntro: "소개",
      introTitle: "소개 1",
      introSubtitle: "소개 2",
      introStart: "시작하기",
      nftSectionTitle: "NFT 마켓",
      nftSectionDesc: "멤버십 NFT를 민팅하고 온체인 혜택을 받아보세요.",
      nftCtaMint: "민팅하기",
      nftCtaView: "컬렉션 보기",
      nftConnectHint: "지갑을 연결하면 바로 민팅할 수 있어요."
    },
    en: {
      tabTrade: "Trade",
      tabNft: "NFT Market",
      tabMarket: "Market",
      tabAssets: "Assets",
      tabDocs: "Docs",
      connect: "Connect Wallet",
      connecting: "Connecting...",
      walletSelectTitle: "Select Wallet",
      walletSelectDesc: "Choose a wallet to connect.",
      metamask: "MetaMask",
      trustWallet: "Trust Wallet",
      phantomWallet: "Phantom",
      comingSoon: "Coming soon",
      notConnected: "Please connect your wallet...",
      tradeNotice: "Connect your wallet to enable swap/wrap. You can still browse without connecting.",
      swap: "Swap",
      liquidity: "Liquidity",
      wrap: "Wrap",
      settings: "Settings",
      settingsTitle: "Settings",
      theme: "Theme",
      language: "Language",
      close: "Close",
      disconnect: "Disconnect Wallet",
      bscTestnet: "BSC Testnet",
      chain: "Chain",
      copy: "Copy",
      copied: "Copied",
      connectingWallet: "Connecting wallet...",
      metamaskInstall: "Please install Metamask.",
      switchToBsc: "Please switch to the correct BSC network (56/97).",
      copyFailed: "Failed to copy. Please try again.",
      mode: "Mode",
      beginner: "Beginner",
      expert: "Expert",
      walletConnected: "Wallet connected.",
      walletDisconnected: "Wallet disconnected.",
      chatTitle: "Ask AI",
      chatPlaceholder: "Type a message",
      chatSend: "➤",
      aiKeyLabel: "OpenAI API Key",
      aiKeyPlaceholder: "sk-...",
      aiKeyHint: "Key is stored locally only.",
      aiKeyMissing: "Please enter your API key.",
      chatGuide: "",
      chatClose: "Close",
      chatOpen: "AI Chat",
      chatError: "AI response failed.",
      chatClear: "↺",
      tabIntro: "Intro",
      introTitle: "Intro 1",
      introSubtitle: "Intro 2",
      introStart: "Start Trading",
      nftSectionTitle: "NFT Market",
      nftSectionDesc: "Mint membership NFTs and unlock on-chain perks.",
      nftCtaMint: "Mint now",
      nftCtaView: "View collection",
      nftConnectHint: "Connect your wallet to mint instantly."
    }
  };
  const t = (key) => i18n[language]?.[key] || key;
  const baseSystemPrompt = `You are LIME ONE's DeFi assistant. Keep answers concise (3-6 bullet lines max). Default language is Korean when the user writes Korean; otherwise answer in the user's language.
- Focus on wallet connection help, slippage explanation, liquidity/price impact, and swap timing considerations.
- Do not give financial advice; frame as informational suggestions only.
- When asked for timing analysis, mention liquidity/price impact, recent quote trend if provided, and whether splitting trades can reduce impact.`;

  const connectWallet = async () => {
    if (!window.ethereum) return alert(t("metamaskInstall"));
    const prov = new ethers.providers.Web3Provider(window.ethereum);
    const expectedChainId = activeChainCfg?.chainId || CHAIN_ID;
    const expectedHex = "0x" + expectedChainId.toString(16);
    await prov.send("eth_requestAccounts", []);
    let net = await prov.getNetwork();
    if (net.chainId !== expectedChainId) {
      try {
        await prov.send("wallet_switchEthereumChain", [{ chainId: expectedHex }]);
        net = await prov.getNetwork();
      } catch (e) {
        // 체인 추가 후 재시도
        if (e?.code === 4902 && activeChainCfg?.rpcUrls?.length) {
          try {
            await prov.send("wallet_addEthereumChain", [
              {
                chainId: expectedHex,
                chainName: activeChainCfg.name || "BSC",
                nativeCurrency: { name: activeChainCfg.nativeSymbol || "BNB", symbol: activeChainCfg.nativeSymbol || "BNB", decimals: 18 },
                rpcUrls: activeChainCfg.rpcUrls,
                blockExplorerUrls: activeChainCfg.explorerTx ? [activeChainCfg.explorerTx.replace(/\/tx\/?$/, "")] : []
              }
            ]);
            await prov.send("wallet_switchEthereumChain", [{ chainId: expectedHex }]);
            net = await prov.getNetwork();
          } catch (addErr) {
            console.error(addErr);
            alert(activeChainCfg?.name ? `${activeChainCfg.name} (${expectedChainId})로 맞춰주세요.` : t("switchToBsc"));
            return;
          }
        } else {
          alert(activeChainCfg?.name ? `${activeChainCfg.name} (${expectedChainId})로 맞춰주세요.` : t("switchToBsc"));
          return;
        }
      }
    }
    setChainId(net.chainId);
    if (net.chainId !== expectedChainId) {
      alert(activeChainCfg?.name ? `${activeChainCfg.name} (${expectedChainId})로 맞춰주세요.` : t("switchToBsc"));
      return;
    }
    setProvider(prov);
    const signer = prov.getSigner();
    const addr = await signer.getAddress();
    setAccount(addr);
    return { provider: prov, address: addr };
  };

  const connectViaMetaMask = async () => {
    try {
      setConnecting(true);
      const result = await connectWallet();
      setShowWalletSelect(false);
      if (result?.address) {
        const shortAddr = `${result.address.substring(0, 6)}...${result.address.substring(result.address.length - 4)}`;
        setToast({
          type: "success",
          message: t("walletConnected"),
          detail: shortAddr,
          time: new Date().toLocaleTimeString()
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  };

  const loadBalances = async (prov, addr) => {
    try {
      const native = await prov.getBalance(addr);
      const wbnbAddr = activeChainCfg?.wrappedNative || WBNB;
      const busdAddr = activeChainCfg?.stable?.address || BUSD;
      const wbnbC = new ethers.Contract(wbnbAddr, ERC20_BAL_ABI, prov);
      const busdC = new ethers.Contract(busdAddr, ERC20_BAL_ABI, prov);
      const wbnb = await wbnbC.balanceOf(addr);
      const busd = await busdC.balanceOf(addr);
      setBalances({
        native: parseFloat(ethers.utils.formatEther(native)).toFixed(4),
        wbnb: parseFloat(ethers.utils.formatEther(wbnb)).toFixed(4),
        busd: parseFloat(ethers.utils.formatEther(busd)).toFixed(4)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
      alert(t("copyFailed"));
    }
  };

  useEffect(() => {
    if (provider && account) loadBalances(provider, account);
  }, [provider, account]);

  const disconnectWallet = () => {
    setProvider(null);
    setAccount(null);
    setChainId(null);
    setBalances({ native: "0.0", wbnb: "0.0", busd: "0.0" });
    setToast({
      type: "info",
      message: t("walletDisconnected"),
      time: new Date().toLocaleTimeString()
    });
  };

  useEffect(() => {
    if (!toast) return;
    const tHandle = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(tHandle);
  }, [toast]);

  useEffect(() => {
    const savedKey = typeof window !== "undefined" ? window.localStorage.getItem("limeone.aiKey") : "";
    if (savedKey) setAiApiKey(savedKey);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (aiApiKey) {
      window.localStorage.setItem("limeone.aiKey", aiApiKey);
    }
  }, [aiApiKey]);

  const sendChatMessage = async (text) => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    if (!aiApiKey) {
      setToast({ type: "info", message: t("aiKeyMissing"), detail: t("aiKeyHint"), time: new Date().toLocaleTimeString() });
      setShowChat(true);
      setChatInput(trimmed);
      return;
    }
    const userMessage = { role: "user", text: trimmed, time: new Date().toLocaleTimeString() };
    const history = [...chatMessages, userMessage];
    setChatMessages(history);
    setChatInput("");
    setChatLoading(true);
    try {
      const messagesPayload = [
        { role: "system", content: baseSystemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.text }))
      ];
      const aiReply = await callChatCompletion({ apiKey: aiApiKey, messages: messagesPayload });
      const assistantMessage = { role: "assistant", text: aiReply, time: new Date().toLocaleTimeString() };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      console.error(e);
      setToast({
        type: "info",
        message: t("chatError"),
        detail: e?.message?.slice(0, 180) || String(e),
        time: new Date().toLocaleTimeString()
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleQuickAsk = (prompt) => {
    if (!prompt) return;
    setShowChat(true);
    sendChatMessage(prompt);
  };

  const walletOptions = [
    {
      key: "metamask",
      label: t("metamask"),
      subtitle: "Browser Extension",
      logo: metamaskLogoDataUrl,
      action: connectViaMetaMask,
      available: true
    },
    {
      key: "trustwallet",
      label: t("trustWallet"),
      subtitle: t("comingSoon"),
      logo: trustWalletLogoDataUrl,
      available: false
    },
    {
      key: "phantom",
      label: t("phantomWallet"),
      subtitle: t("comingSoon"),
      logo: phantomWalletLogoDataUrl,
      available: false
    }
  ];

  const renderNftMarket = () => {
    const nftItems = [
      {
        name: "LIME PASS",
        badge: language === "ko" ? "멤버십" : "Membership",
        supply: 1500,
        minted: 840,
        price: "0.12 BNB",
        perks: language === "ko" ? ["수수료 10% 캐시백", "거버넌스 베타", "얼리 액세스"] : ["10% fee rebate", "Gov beta", "Early access"]
      },
      {
        name: "ORANGE ORIGIN",
        badge: language === "ko" ? "제너시스" : "Genesis",
        supply: 3000,
        minted: 2140,
        price: "0.06 BNB",
        perks: language === "ko" ? ["PFP 에디션", "LP 부스트 스탬프", "에어드랍 우선"] : ["PFP edition", "LP boost stamp", "Airdrop priority"]
      },
      {
        name: "BUILDERS",
        badge: language === "ko" ? "크리에이터" : "Creator",
        supply: 500,
        minted: 260,
        price: "0.18 BNB",
        perks: language === "ko" ? ["테스트넷 권한", "스마트컨트랙트 배포 워크샵", "콜라보 배지"] : ["Testnet access", "SC deploy workshops", "Collab badge"]
      }
    ];
    const totalSupply = nftItems.reduce((sum, n) => sum + n.supply, 0);
    const totalMinted = nftItems.reduce((sum, n) => sum + n.minted, 0);
    return (
      <div style={{ width: "100%", maxWidth: 1100, padding: "8px 16px 32px", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 10px", borderRadius: 12, background: "#f97316", color: "#ffffff", fontWeight: 800, fontSize: 13 }}>
            NFT
          </div>
          <h1 style={{ margin: 0 }}>{t("nftSectionTitle")}</h1>
        </div>
        <p style={{ margin: 0, color: activeTheme.subtext, fontSize: 14 }}>
          {t("nftSectionDesc")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", gap: isMobile ? 10 : 12 }}>
          <div style={{ border: `1px solid ${activeTheme.border}`, borderRadius: 14, padding: 16, background: activeTheme.surface, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: activeTheme.subtext }}>{language === "ko" ? "총 민팅" : "Total minted"}</span>
                <span style={{ fontWeight: 800, fontSize: 22 }}>{totalMinted.toLocaleString()} / {totalSupply.toLocaleString()}</span>
              </div>
              <button
                onClick={() => setShowWalletSelect(true)}
                style={{ ...tabBtn(activeTheme), padding: "10px 14px", fontWeight: 800 }}
              >
                {t("nftCtaMint")}
              </button>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: theme === "light" ? "#e5e7eb" : "#111827", overflow: "hidden" }}>
              <div style={{ width: `${Math.round((totalMinted / totalSupply) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #f97316, #fb923c)" }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: activeTheme.subtext, fontSize: 12 }}>
              <span>{language === "ko" ? "온체인 보상, 한정 발행, 실시간 민팅" : "On-chain perks, limited supply, live mint"}</span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: theme === "light" ? "#f3f4f6" : "#0b1220", color: activeTheme.text, fontWeight: 700 }}>
                BNB Chain
              </span>
            </div>
            <div style={{ fontSize: 12, color: activeTheme.subtext }}>{t("nftConnectHint")}</div>
          </div>
          {nftItems.map((nft) => {
            const progress = Math.min(100, Math.round((nft.minted / nft.supply) * 100));
            return (
              <div
                key={nft.name}
                style={{
                  border: `1px solid ${activeTheme.border}`,
                  borderRadius: 14,
                  padding: 16,
                  background: activeTheme.surface,
                  display: "grid",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>{nft.name}</span>
                    <span style={{ fontSize: 12, color: activeTheme.subtext }}>{nft.badge}</span>
                  </div>
                  <span style={{ padding: "6px 10px", borderRadius: 10, background: "rgba(249,115,22,0.12)", color: "#f97316", fontWeight: 800, fontSize: 12 }}>
                    {language === "ko" ? `${progress}% 민팅` : `${progress}% minted`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: activeTheme.subtext }}>
                  <span>{language === "ko" ? `가격 ${nft.price}` : `Price ${nft.price}`}</span>
                  <span>{nft.minted.toLocaleString()} / {nft.supply.toLocaleString()}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: theme === "light" ? "#e5e7eb" : "#111827", overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #f97316, #fb923c)" }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {nft.perks.map((perk) => (
                    <span key={perk} style={{ padding: "8px 10px", borderRadius: 999, border: `1px solid ${theme === "light" ? "#e5e7eb" : "rgba(255,255,255,0.08)"}`, background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.03)", color: activeTheme.text, fontSize: 12, fontWeight: 700 }}>
                      {perk}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setShowWalletSelect(true)}
                    style={{ ...tabBtn(activeTheme), flex: 1, padding: "10px 14px", fontWeight: 800 }}
                  >
                    {t("nftCtaMint")}
                  </button>
                  <button
                    onClick={() => setTab("assets")}
                    style={{ ...tabBtn(activeTheme), flex: 1, padding: "10px 14px", fontWeight: 700 }}
                  >
                    {t("nftCtaView")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBody = () => {
    const isConnected = !!provider && !!account;

    if (tab === "intro") {
      return renderIntroPage();
    }

    if (tab === "nft") {
      return renderNftMarket();
    }

    if (tab === "docs") {
      return (
        <div style={{ width: "100%", maxWidth: 1100, padding: "32px 20px", display: "grid", gap: 16 }}>
          <h1 style={{ margin: 0 }}>{i18n[language].tabDocs}</h1>
          <p style={{ margin: 0, color: activeTheme.subtext }}>
            {language === "ko"
              ? "LIME ONE 사용법과 프로세스를 간단히 정리했습니다."
              : "Quick docs for using LIME ONE."}
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>{language === "ko" ? "시작하기" : "Get Started"}</h3>
              <ol style={{ paddingLeft: 20, margin: 0, color: activeTheme.subtext }}>
                <li>{language === "ko" ? "지갑을 연결하세요." : "Connect your wallet."}</li>
                <li>{language === "ko" ? "거래 탭에서 스왑/유동성을 선택하세요." : "Choose Swap or Liquidity from Trade."}</li>
                <li>{language === "ko" ? "슬리피지와 금액을 설정한 뒤 거래를 실행하세요." : "Set slippage/amount and execute."}</li>
              </ol>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>{language === "ko" ? "보안" : "Security"}</h3>
              <ul style={{ paddingLeft: 20, margin: 0, color: activeTheme.subtext }}>
                <li>{language === "ko" ? "자산은 항상 지갑에 보관됩니다." : "Assets stay in your wallet."}</li>
                <li>{language === "ko" ? "모든 거래는 온체인으로 투명하게 실행됩니다." : "All transactions execute on-chain."}</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "trade") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 960, alignItems: "center" }}>
          {!isConnected && (
            <div style={{ color: activeTheme.subtext, fontSize: 13 }}>
              {t("tradeNotice")}
            </div>
          )}

          {tradeView === "swap" && (
            <Swap
              provider={provider}
              account={account}
              tokenList={tokenList}
              isConnected={isConnected}
              language={language}
              experienceMode={experienceMode}
              onSwapSuccess={(entry) => setActivityLog((prev) => [entry, ...prev].slice(0, 20))}
              onAskAi={handleQuickAsk}
              onRequestConnect={() => setShowWalletSelect(true)}
              chainKey={chainKey}
              onChainChange={(key) => setChainKey(key)}
              chainOptions={chainOptions}
              dexRouters={activeChainCfg?.dexRouters || defaultDexRouters}
              chainCfg={activeChainCfg}
            />
          )}

          {tradeView === "liquidity" && (
            <Liquidity
              provider={provider}
              account={account}
              tokenList={tokenList}
              language={language}
              onActionSuccess={(entry) => setActivityLog((prev) => [entry, ...prev].slice(0, 20))}
              onRequestConnect={() => setShowWalletSelect(true)}
            />
          )}

        </div>
      );
    }

    if (tab === "market") {
      return (
            <Market
              provider={provider}
              tokenList={tokenList}
              pollMs={POLL_MS}
              language={language}
            />
          );
        }

        if (tab === "assets") {
          return (
            <AssetActivity
              provider={provider}
              account={account}
              tokenList={tokenList}
              language={language}
              activityLog={activityLog}
            />
          );
        }

    return null;
  };

  const introHighlights = {
    ko: ["소개 3", "소개 4", "소개 5", "소개 6"],
    en: ["Intro 3", "Intro 4", "Intro 5", "Intro 6"]
  };

  const introFlow = {
    ko: [
      { title: "소개 7", desc: "소개 문구를 입력하세요." },
      { title: "소개 8", desc: "소개 문구를 입력하세요." },
      { title: "소개 9", desc: "소개 문구를 입력하세요." }
    ],
    en: [
      { title: "Intro 7", desc: "Add your copy here." },
      { title: "Intro 8", desc: "Add your copy here." },
      { title: "Intro 9", desc: "Add your copy here." }
    ]
  };

  const renderIntroPage = () => {
    const gradientBg = theme === "light"
      ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 35%, #e2e8f0 100%)"
      : "linear-gradient(135deg, #0b0f25 0%, #0f172a 40%, #111827 100%)";
    const animStyles = `
      @keyframes floatUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeScale { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(249,115,22,0.28); } 70% { box-shadow: 0 0 0 18px rgba(249,115,22,0); } 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); } }
      @keyframes glow { 0% { filter: drop-shadow(0 0 0 rgba(249,115,22,0)); } 50% { filter: drop-shadow(0 0 12px rgba(249,115,22,0.45)); } 100% { filter: drop-shadow(0 0 0 rgba(249,115,22,0)); } }
    `;
    const featureCards = [
      { title: language === "ko" ? "완전 탈중앙화" : "Fully decentralized" },
      { title: language === "ko" ? "초고속 스왑 엔진" : "Ultra-fast swaps" },
      { title: language === "ko" ? "투명한 온체인 기록" : "Transparent on-chain logs" },
      { title: language === "ko" ? "유동성 공급 보상 " : "LP rewards" }
    ];
    const whyCards = [
      { title: language === "ko" ? "지갑 기반" : "Wallet-based" },
      { title: language === "ko" ? "글로벌 접근성" : "global access" },
      { title: language === "ko" ? "스마트컨트랙트" : "Smart-contract " },
      { title: language === "ko" ? "보안 + 투명성" : "Security + transparency" }
    ];
    const nftCopy = language === "ko"
      ? {
          title: "NFT 스포트라이트",
          subtitle: "LIME ONE 멤버십 NFT로 상위 혜택을 먼저 받아보세요.",
          badge: "한정 발행",
          perksLabel: "주요 혜택",
          mintedLabel: "민팅 완료",
          supplyLabel: "총 발행",
          ctaPrimary: "민팅 참여",
          ctaSecondary: "컬렉션 보기",
          footnote: "스마트컨트랙트 기반 혜택 · 지갑당 최대 2개 민팅"
        }
      : {
          title: "NFT Spotlight",
          subtitle: "Claim membership NFTs to unlock LIME ONE perks early.",
          badge: "Limited drop",
          perksLabel: "Key perks",
          mintedLabel: "Minted",
          supplyLabel: "Total supply",
          ctaPrimary: "Mint now",
          ctaSecondary: "View collection",
          footnote: "On-chain perks · max 2 mints per wallet"
        };
    const nftPerkPills = language === "ko"
      ? ["수수료 절감", "얼리 액세스", "온체인 보상"]
      : ["Lower fees", "Early access", "On-chain rewards"];
    const nftItems = [
      {
        name: "LIME PASS",
        tagline: language === "ko" ? "수수료 리베이트 + 거버넌스 프리패스" : "Fee rebates + governance pre-pass",
        supply: 1500,
        minted: 840,
        perks: language === "ko"
          ? ["스왑 수수료 10% 캐시백", "신규 토큰 선민팅 우선권", "거버넌스 베타 참여"]
          : ["10% swap fee rebate", "Early mint allowlist", "Governance beta access"]
      },
      {
        name: "ORANGE ORIGIN",
        tagline: language === "ko" ? "아트 기반 제너시스 드롭" : "Art-driven genesis drop",
        supply: 3000,
        minted: 2140,
        perks: language === "ko"
          ? ["한정판 PFP", "LP 부스트 스탬프", "에어드랍 우선 순위"]
          : ["Limited PFP", "LP boost stamp", "Priority airdrops"]
      }
    ];
    const totalSupply = nftItems.reduce((sum, item) => sum + item.supply, 0);
    const totalMinted = nftItems.reduce((sum, item) => sum + item.minted, 0);
    return (
      <div style={{ width: "100%", background: gradientBg, color: activeTheme.text, overflowY: "auto" }}>
        <style>{animStyles}</style>
        <section ref={introHeroRef} style={{ maxWidth: 1400, margin: "0 auto", padding: "80px clamp(24px, 5vw, 72px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 40, alignItems: "center", ...revealStyle(introReveal.hero) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(30px, 4.2vw, 46px)", lineHeight: 1.24, animation: "fadeScale 0.6s ease both" }}>
              {language === "ko"
                ? <>지갑 하나로 시작하는 차세대<br />탈중앙화 거래.</>
                : <>Next-gen decentralized<br />trading with just a wallet.</>}
            </h1>
            <p style={{ margin: 0, color: activeTheme.subtext, fontSize: 16, lineHeight: 1.7, animation: "floatUp 0.6s ease both", animationDelay: "80ms" }}>
              {language === "ko" ? "중앙화 없이, 더 빠르고 더 안전한 온체인 스왑." : "On-chain swaps that are faster and safer—without central control."}
            </p>
            <p style={{ margin: 0, color: activeTheme.subtext, fontSize: 14, lineHeight: 1.7, animation: "floatUp 0.6s ease both", animationDelay: "140ms" }}>
              {language === "ko"
                ? "지갑 하나면 즉시 거래. 회원가입·개인정보 없이 AMM 기반 유동성 풀에서 언제든 토큰을 교환하고, 공급자는 수수료 보상을 받습니다."
                : "Trade instantly with one wallet—no signup or personal data. AMM pools let you swap anytime and liquidity providers earn fees."}
            </p>
            <p style={{ margin: 0, color: activeTheme.subtext, fontSize: 14, lineHeight: 1.7, animation: "floatUp 0.6s ease both", animationDelay: "200ms" }}>
              {language === "ko"
                ? "자산은 항상 본인 지갑에 머무르고, 모든 거래는 온체인에서 투명하게 실행됩니다."
                : "Your assets stay in your wallet; every transaction executes transparently on-chain."}
            </p>
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: 220, height: 220, borderRadius: "50%", background: theme === "light" ? "#ffffff" : "#0b0f1a", border: `1px solid ${activeTheme.border}`, boxShadow: "0 14px 40px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseRing 2.8s ease-out infinite" }}>
              <img src={logoSrc || logoFallbackSrc} alt="LIME ONE" style={{ width: "80%", height: "80%", objectFit: "contain", animation: "glow 3s ease-in-out infinite, floatUp 0.8s ease both" }} />
            </div>
            {[{ label: "USDT", src: tetherLogo }, { label: "ETH", src: ethLogo }, { label: "BNB", src: bnbLogoDataUrl || busdLogoDataUrl }, { label: "TRX", src: tronLogo }].map((t, i) => {
              const pos = [
                { top: "10%", left: "12%" },
                { top: "18%", right: "12%" },
                { bottom: "12%", right: "8%" },
                { bottom: "6%", left: "18%" }
              ][i];
              return (
                <div
                  key={t.label}
                  style={{
                    position: "absolute",
                    ...pos,
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: theme === "light" ? "#ffffff" : "#0b0f1a",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
                    animation: "floatUp 0.6s ease both",
                    animationDelay: `${120 + i * 80}ms`,
                    overflow: "hidden",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <img
                    src={resolveImgSrc(t.src)}
                    alt={t.label}
                    style={{ width: "82%", height: "82%", objectFit: "contain", padding: 4, display: "block" }}
                    onError={(e) => {
                      if (e?.target?.src !== tokenLogoFallback) e.target.src = tokenLogoFallback;
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>
        <section
          ref={introNftRef}
          style={{
            background: theme === "light" ? "linear-gradient(135deg, #0b1220 0%, #0f172a 45%, #0b0f25 100%)" : "linear-gradient(135deg, #050814 0%, #0b0f1a 45%, #0f172a 100%)",
            color: "#e5e7eb",
            padding: "48px clamp(24px, 5vw, 72px)",
            ...revealStyle(introReveal.nft)
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "stretch" }}>
            <div
              style={{
                background: theme === "light" ? "#0f172a" : "#050814",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                padding: "20px 22px",
                display: "grid",
                gap: 14,
                boxShadow: "0 16px 36px rgba(0,0,0,0.25)"
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "rgba(249,115,22,0.16)", color: "#fbbf24", fontWeight: 800, fontSize: 12, letterSpacing: 0.2 }}>
                <span style={{ width: 8, height: 8, background: "#f97316", borderRadius: "50%", boxShadow: "0 0 0 6px rgba(249,115,22,0.08)" }} />
                {nftCopy.badge}
              </div>
              <h2 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)" }}>{nftCopy.title}</h2>
              <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6, fontSize: 14 }}>
                {nftCopy.subtitle}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[{ label: nftCopy.mintedLabel, value: totalMinted }, { label: nftCopy.supplyLabel, value: totalSupply }].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: "1 1 140px",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)"
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{stat.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{stat.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {nftPerkPills.map((pill) => (
                  <span key={pill} style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "#f8fafc", fontWeight: 700, fontSize: 12 }}>
                    {pill}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={{ padding: "10px 14px", borderRadius: 12, border: "none", background: "#f97316", color: "#ffffff", fontWeight: 800, cursor: "pointer", flex: "1 1 160px", boxShadow: "0 10px 24px rgba(249,115,22,0.35)" }}
                  onClick={() => setShowWalletSelect(true)}
                >
                  {nftCopy.ctaPrimary}
                </button>
                <button
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e5e7eb", fontWeight: 700, cursor: "pointer", flex: "1 1 160px" }}
                  onClick={() => setTab("assets")}
                >
                  {nftCopy.ctaSecondary}
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{nftCopy.footnote}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {nftItems.map((nft, idx) => {
                const progress = Math.min(100, Math.round((nft.minted / nft.supply) * 100));
                return (
                  <div
                    key={nft.name}
                    style={{
                      borderRadius: 16,
                      padding: "16px 18px",
                      background: theme === "light" ? "#ffffff" : "#0b1220",
                      border: theme === "light" ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.07)",
                      boxShadow: theme === "light" ? "0 14px 30px rgba(15,23,42,0.08)" : "0 14px 30px rgba(0,0,0,0.3)",
                      display: "grid",
                      gap: 10,
                      alignContent: "start"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 16 }}>{nft.name}</span>
                        <span style={{ fontSize: 12, color: activeTheme.subtext }}>{nft.tagline}</span>
                      </div>
                      <span style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(249,115,22,0.12)", color: "#f97316", fontWeight: 800, fontSize: 12 }}>
                        {language === "ko" ? `${progress}% 민팅` : `${progress}% sold`}
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: activeTheme.subtext }}>
                        <span>{nftCopy.mintedLabel} {nft.minted.toLocaleString()}</span>
                        <span>{nftCopy.supplyLabel} {nft.supply.toLocaleString()}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: theme === "light" ? "#e5e7eb" : "#111827", overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #f97316, #fb923c)", borderRadius: 999 }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {nft.perks.map((perk) => (
                        <span key={perk} style={{ padding: "8px 10px", borderRadius: 999, border: `1px solid ${theme === "light" ? "#e5e7eb" : "rgba(255,255,255,0.08)"}`, background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.03)", color: activeTheme.text, fontSize: 12, fontWeight: 700 }}>
                          {perk}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section ref={introFeaturesRef} style={{ background: theme === "light" ? "#0b1220" : "#050814", color: "#e5e7eb", padding: "60px clamp(24px, 5vw, 72px)", ...revealStyle(introReveal.features) }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>⚡</div>
              <h2 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)" }}>{language === "ko" ? "핵심 기능" : "Core features"}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
              {featureCards.map((item, idx) => (
               <div
                 key={idx}
                 style={{
                   padding: "18px 20px",
                   borderRadius: 14,
                   border: "1px solid rgba(255,255,255,0.08)",
                   background: "rgba(255,255,255,0.02)",
                   fontWeight: 700,
                   fontSize: 15,
                   animation: "floatUp 0.5s ease both",
                   animationDelay: `${idx * 80}ms`,
                   transition: "transform 180ms ease, box-shadow 180ms ease"
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                   e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.transform = "translateY(0) scale(1)";
                   e.currentTarget.style.boxShadow = "none";
                 }}
               >
                 {item.title}
               </div>
              ))}
            </div>
          </div>
        </section>

        <section ref={introWhyRef} style={{ background: gradientBg, padding: "60px clamp(24px, 5vw, 72px) 70px", ...revealStyle(introReveal.why) }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>✓</div>
              <h2 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)" }}>{language === "ko" ? "왜 LIME ONE인가?" : "Why LIME ONE?"}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              {whyCards.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${activeTheme.border}`,
                    padding: "16px 18px",
                    background: theme === "light" ? "#ffffff" : "#0b1220",
                    boxShadow: theme === "light" ? "0 12px 30px rgba(15,23,42,0.08)" : "0 12px 30px rgba(0,0,0,0.25)",
                    fontWeight: 700,
                    animation: "floatUp 0.55s ease both",
                    animationDelay: `${idx * 90}ms`,
                    transition: "transform 180ms ease, box-shadow 180ms ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                    e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0) scale(1)";
                    e.currentTarget.style.boxShadow = theme === "light" ? "0 12px 30px rgba(15,23,42,0.08)" : "0 12px 30px rgba(0,0,0,0.25)";
                  }}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section ref={introCtaRef} style={{ background: theme === "light" ? "#0f172a" : "#050814", padding: "60px clamp(24px, 5vw, 72px) 70px", ...revealStyle(introReveal.cta) }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20, color: "#e5e7eb" }}>
            <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)", animation: "floatUp 0.5s ease both" }}>{language === "ko" ? "지금 새로운 거래 방식을 경험하세요." : "Experience a new way to trade."}</h3>
              <h4 style={{ margin: 0, fontSize: "clamp(18px, 2.6vw, 24px)", fontWeight: 800, animation: "floatUp 0.5s ease both", animationDelay: "70ms" }}>{language === "ko" ? "당신의 금융은 당신이 통제합니다." : "Your finance, under your control."}</h4>
              <p style={{ margin: 0, color: "#cbd5e1", animation: "floatUp 0.5s ease both", animationDelay: "140ms" }}>
                {language === "ko"
                  ? "100% 온체인. 스마트컨트랙트 기반. 누구나 검증 가능."
                  : "100% on-chain. Smart contract based. Verifiable by anyone."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={() => setShowWalletSelect(true)}
                style={{ minWidth: 160, padding: "12px 16px", borderRadius: 12, border: "none", background: "#f97316", color: "#ffffff", fontWeight: 800, cursor: "pointer", transition: "transform 160ms ease, box-shadow 160ms ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(249,115,22,0.35)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {language === "ko" ? "Connect Wallet" : "Connect Wallet"}
              </button>
              <button
                onClick={() => setTab("trade")}
                style={{ minWidth: 160, padding: "12px 16px", borderRadius: 12, border: `1px solid ${activeTheme.border}`, background: "transparent", color: "#ffffff", fontWeight: 800, cursor: "pointer", transition: "transform 160ms ease, box-shadow 160ms ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(255,255,255,0.16)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {language === "ko" ? "Launch App" : "Launch App"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", color: "#cbd5e1", fontSize: 13 }}>
              <button
                onClick={() => setTab("docs")}
                style={{ border: "none", background: "transparent", color: "inherit", textDecoration: "underline", cursor: "pointer" }}
              >
                Docs
              </button>
            </div>
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
              {language === "ko" ? "Decentralized. Permissionless. Borderless." : "Decentralized. Permissionless. Borderless."}
            </div>
          </div>
        </section>
      </div>
    );
  };

  
  return (
    // ⭐️ 1. 전체 레이아웃 div (배경색 등)
    <div style={{ background: activeTheme.background, color: activeTheme.text, minHeight: "100vh" }}>
      {/* ⬇️ ⬇️ ⬇️ 2. 상단 네비게이션 바 (Header) ⬇️ ⬇️ ⬇️ */}
      <header style={{ 
        display: "flex", 
        justifyContent: "flex-start", 
        alignItems: isMobile ? "flex-start" : "center", 
        flexDirection: isMobile ? "column" : "row",
        flexWrap: "wrap",
        gap: isMobile ? 10 : 12,
        rowGap: isMobile ? 12 : 14,
        padding: isMobile ? "12px 14px" : "16px clamp(14px, 3vw, 32px)", 
        background: activeTheme.surface,
        width: "100%",
        boxSizing: "border-box"
      }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 0, width: isMobile ? "100%" : "auto" }}>

          <button
            onClick={() => setTab("intro")}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
            title={t("introTitle")}
          >
            <img
              key={theme}
              src={logoSrc || logoFallbackSrc}
              alt="LIME ONE Logo"
              style={{
                display: "block",
                objectFit: "contain",
                height: "auto",
                width: "min(128px, 42vw)", // ~70% size
                maxHeight: 36,
                aspectRatio: "709 / 199",
                flexShrink: 0,
                filter: theme === "light" ? "none" : "drop-shadow(0 1px 4px rgba(0,0,0,0.35))"
              }}
              onError={(e) => {
                if (logoFallbackSrc && e?.target?.src !== logoFallbackSrc) e.target.src = logoFallbackSrc;
              }}
            />
          </button>

          {/* 2-2. 탭 버튼 (Swap, NFT, Market, Assets) */}
          {!isMobile && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["trade", "nft", "market", "assets"].map((tKey) => {
                if (tKey === "trade") {
                  return (
                    <div
                      key={tKey}
                      style={{ position: "relative" }}
                      onMouseEnter={openTradeTabMenu}
                      onMouseLeave={closeTradeTabMenu}
                    >
                      <button
                        onClick={() => { setTab("trade"); toggleTradeTabMenu(); }}
                        style={tab === "trade" ? activeTab(activeTheme) : tabBtn(activeTheme)}
                      >
                        {i18n[language].tabTrade} ▾
                      </button>
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          padding: 6,
                          background: activeTheme.surface,
                          border: "none",
                          borderRadius: 8,
                          boxShadow: "0 8px 18px rgba(0,0,0,0.16)",
                          minWidth: 140,
                          zIndex: 30,
                          opacity: tradeTabMenuOpen ? 1 : 0,
                          transform: tradeTabMenuOpen ? "translateY(0)" : "translateY(-6px)",
                          pointerEvents: tradeTabMenuOpen ? "auto" : "none",
                          transition: "opacity 160ms ease, transform 160ms ease"
                        }}
                      >
                        {["swap", "liquidity"].map((view) => (
                          <button
                            key={view}
                            onMouseEnter={openTradeTabMenu}
                            onMouseLeave={closeTradeTabMenu}
                            onClick={() => {
                              setTab("trade");
                              setTradeView(view);
                              setTradeTabMenuOpen(false);
                            }}
                            style={{
                              ...tradeSwitchBtn(activeTheme),
                              textAlign: "left",
                              borderRadius: 6,
                              background: "transparent",
                              color: tradeView === view && tab === "trade" ? activeTheme.text : activeTheme.subtext,
                              fontWeight: tradeView === view && tab === "trade" ? 700 : 600,
                              border: "none",
                              width: "100%"
                            }}
                          >
                            {view === "swap" ? t("swap") : t("liquidity")}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button key={tKey} onClick={() => setTab(tKey)} style={tab === tKey ? activeTab(activeTheme) : tabBtn(activeTheme)}>
                    {tKey === "market"
                      ? i18n[language].tabMarket
                      : tKey === "assets"
                        ? i18n[language].tabAssets
                        : i18n[language].tabNft}
                  </button>
                );
              })}
            </div>
          )}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <button
                onClick={() => setShowWalletSelect(true)}
                style={{ ...tabBtn(activeTheme), padding: "10px 12px", fontWeight: 800 }}
              >
                {account ? `${account.substring(0, 4)}...${account.substring(account.length - 2)}` : t("connect")}
              </button>
              <button
                onClick={() => setMobileNavOpen(true)}
                style={{ ...tabBtn(activeTheme), padding: "10px 12px", fontWeight: 900 }}
                aria-label="Open navigation"
              >
                ≡
              </button>
            </div>
          )}
        </div>

        {/* 2-3. 지갑 연결 버튼 (우측) */}
          <div style={{ display: isMobile ? "none" : "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end", width: "auto" }}>
            {account ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: activeTheme.surface, border: `1px solid ${activeTheme.border}`, padding: "8px 14px", borderRadius: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: activeTheme.text }}>
                  {account.substring(0, 6)}...{account.substring(account.length - 4)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: activeTheme.subtext, fontSize: 13 }}>
                  <BnbChainLogo size={14} />
                  {chainId === activeChainCfg?.chainId ? activeChainCfg?.name || `${t("chain")} ${chainId}` : `${t("chain")} ${chainId ?? "?"}`}
                </span>
              </div>
            </>
          ) : (
            <button onClick={() => setShowWalletSelect(true)} style={tabBtn(activeTheme)}>
              {connecting ? t("connecting") : t("connect")}
            </button>
          )}
          <button onClick={() => setShowSettings(true)} style={{ ...tabBtn(activeTheme), padding: "8px 14px" }}>
            {t("settings")}
          </button>
        </div>
      </header>
      {/* ⬆️ ⬆️ ⬆️ 2. 상단 네비게이션 바 (Header) ⬆️ ⬆️ ⬆️ */}

      
      {/* 3. 메인 컨텐츠 영역 */}
      <div style={{ display: "flex", justifyContent: "center", padding: isMobile ? "18px 12px 26px" : "32px", width: "100%", boxSizing: "border-box" }}>
        {renderBody()}
      </div>

      {showWalletSelect && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: activeTheme.surface, color: activeTheme.text, padding: 22, borderRadius: 16, minWidth: 320, border: `1px solid ${activeTheme.border}`, width: "90%", maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>{t("walletSelectTitle")}</h3>
              <button onClick={() => setShowWalletSelect(false)} style={{ ...tabBtn(activeTheme), padding: "6px 10px", fontSize: 12 }}>
                {t("close")}
              </button>
            </div>
            <p style={{ marginTop: 0, marginBottom: 14, color: activeTheme.subtext, fontSize: 13 }}>
              {t("walletSelectDesc")}
            </p>
            <div
              style={{
                display: "grid",
                gap: 12
              }}
            >
              {walletOptions.map((wallet) => {
                const isMetamask = wallet.key === "metamask";
                const disabled = !wallet.available || (isMetamask && connecting);
                const rightLabel = wallet.available
                  ? (isMetamask && connecting ? t("connecting") : "BNB Chain Testnet")
                  : t("comingSoon");

                return (
                  <button
                    key={wallet.key}
                    onClick={wallet.available ? wallet.action : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: `1px solid ${activeTheme.border}`,
                      borderRadius: 12,
                      padding: "12px 14px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      color: activeTheme.text,
                      opacity: disabled ? 0.6 : 1,
                      pointerEvents: disabled ? "none" : "auto"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background: theme === "light" ? "#eef2f7" : "#1f2937",
                          border: `1px solid ${theme === "light" ? "#e5e7eb" : "#27334a"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden"
                        }}
                      >
                        <WalletLogo size={22} src={wallet.logo} alt={wallet.label} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 700 }}>{wallet.label}</span>
                        <span style={{ fontSize: 12, color: activeTheme.subtext }}>{wallet.subtitle}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: activeTheme.subtext }}>
                      {rightLabel}
                    </span>
                  </button>
                );
              })}
              {connecting && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: activeTheme.subtext }}>
                  <Spinner />
                  <span>{t("connectingWallet")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: activeTheme.surface, color: activeTheme.text, padding: 24, borderRadius: 16, minWidth: 320, border: `1px solid ${activeTheme.border}` }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>{t("settingsTitle")}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, border: `1px solid ${activeTheme.border}`, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <span style={{ fontSize: 12, color: activeTheme.subtext }}>Wallet</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, wordBreak: "break-all" }}>
                    {account ? `${account.substring(0, 10)}...${account.substring(account.length - 6)}` : t("notConnected")}
                  </span>
                  {account && (
                    <button
                      onClick={() => handleCopy(account)}
                      style={{ ...tabBtn(activeTheme), padding: "4px 10px", fontSize: 12 }}
                    >
                      {copied ? t("copied") : t("copy")}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, color: activeTheme.subtext }}>
                  <BnbChainLogo size={22} />
                  <span style={{ fontWeight: 600, color: activeTheme.text }}>BNB Chain</span>
                  <span style={{ fontSize: 12 }}>
                    {chainId === activeChainCfg?.chainId ? activeChainCfg?.name || `${t("chain")} ${chainId}` : `${t("chain")} ${chainId ?? "?"}`}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 12, border: `1px solid ${activeTheme.border}`, marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: activeTheme.subtext }}>{t("aiKeyLabel")}</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={t("aiKeyPlaceholder")}
                style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${activeTheme.border}`, background: theme === "light" ? "#f8fafc" : "#0f131a", color: activeTheme.text }}
              />
              <span style={{ fontSize: 11, color: activeTheme.subtext }}>{t("aiKeyHint")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: activeTheme.subtext }}>{t("theme")}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setTheme("light")} style={theme === "light" ? settingsActive(activeTheme) : tabBtn(activeTheme)}>Light</button>
                <button onClick={() => setTheme("dark")} style={theme === "dark" ? settingsActive(activeTheme) : tabBtn(activeTheme)}>Dark</button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: activeTheme.subtext }}>{t("language")}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setLanguage("ko")} style={language === "ko" ? settingsActive(activeTheme) : tabBtn(activeTheme)}>한국어</button>
                <button onClick={() => setLanguage("en")} style={language === "en" ? settingsActive(activeTheme) : tabBtn(activeTheme)}>English</button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: activeTheme.subtext }}>{t("mode")}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setExperienceMode("beginner")} style={experienceMode === "beginner" ? settingsActive(activeTheme) : tabBtn(activeTheme)}>{t("beginner")}</button>
                <button onClick={() => setExperienceMode("expert")} style={experienceMode === "expert" ? settingsActive(activeTheme) : tabBtn(activeTheme)}>{t("expert")}</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              {account && (
                <button onClick={disconnectWallet} style={dangerBtn(activeTheme)}>{t("disconnect")}</button>
              )}
              <button onClick={() => setShowSettings(false)} style={tabBtn(activeTheme)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowChat((prev) => !prev)}
        style={{
          position: "fixed",
          left: 18,
          bottom: showChat ? 240 : 18,
          borderRadius: "50%",
          width: 58,
          height: 58,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "#f97316",
          color: "#ffffff",
          cursor: "pointer",
          boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
          zIndex: 9998
        }}
        title={t("chatOpen")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="7" width="14" height="10" rx="3" fill="#ffffff" />
          <rect x="9" y="5" width="6" height="2" rx="1" fill="#ffffff" />
          <circle cx="10" cy="12" r="1.2" fill="#ffffff" />
          <circle cx="14" cy="12" r="1.2" fill="#ffffff" />
          <rect x="9" y="15" width="6" height="1.2" rx="0.6" fill="#ffffff" />
        </svg>
      </button>

      {isMobile && mobileNavOpen && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 9997
            }}
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
              width: "78vw",
              maxWidth: 320,
              background: activeTheme.surface,
              borderLeft: `1px solid ${activeTheme.border}`,
              boxShadow: "-12px 0 30px rgba(0,0,0,0.3)",
              zIndex: 9998,
              display: "grid",
              gridTemplateRows: "auto 1fr",
              animation: "chat-slide-in 180ms ease forwards"
            }}
          >
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${activeTheme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800 }}>{language === "ko" ? "메뉴" : "Menu"}</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                style={{ ...tabBtn(activeTheme), padding: "6px 10px", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              {[
                { key: "trade", label: i18n[language].tabTrade },
                { key: "nft", label: i18n[language].tabNft },
                { key: "market", label: i18n[language].tabMarket },
                { key: "assets", label: i18n[language].tabAssets }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); setMobileNavOpen(false); }}
                  style={{
                    ...tabBtn(activeTheme),
                    justifyContent: "space-between",
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 14px",
                    fontWeight: 800,
                    background: tab === item.key ? activeTheme.text : "transparent",
                    color: tab === item.key ? (theme === "light" ? "#ffffff" : "#0b0f25") : activeTheme.text
                  }}
                >
                  {item.label}
                  <span style={{ color: tab === item.key ? "inherit" : activeTheme.subtext, fontSize: 12 }}>›</span>
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${activeTheme.border}`, paddingTop: 10, display: "grid", gap: 8 }}>
                <span style={{ fontSize: 12, color: activeTheme.subtext }}>{language === "ko" ? "빠른 액션" : "Quick actions"}</span>
                <button
                  onClick={() => { setShowWalletSelect(true); setMobileNavOpen(false); }}
                  style={{ ...tabBtn(activeTheme), padding: "10px 14px", fontWeight: 800 }}
                >
                  {account ? (language === "ko" ? "지갑 연결됨" : "Wallet connected") : t("connect")}
                </button>
                <button
                  onClick={() => { setShowSettings(true); setMobileNavOpen(false); }}
                  style={{ ...tabBtn(activeTheme), padding: "10px 14px", fontWeight: 700 }}
                >
                  {t("settings")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showChat && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              zIndex: 9996
            }}
            onClick={() => setShowChat(false)}
          />
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 90,
              height: "calc(100vh - 110px)",
              width: "min(260px, 82vw)",
              background: activeTheme.surface,
              border: `1px solid ${activeTheme.border}`,
              borderRadius: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 18px 44px rgba(0,0,0,0.28)",
              zIndex: 9998,
              animation: "chat-slide-in 220ms ease forwards"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${activeTheme.border}` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong>{t("chatTitle")}</strong>
              </div>
              <button
                onClick={() => {
                  setChatMessages([]);
                  setChatInput("");
                }}
                style={{ ...tabBtn(activeTheme), padding: "6px 10px", fontSize: 14 }}
              >
                {t("chatClear")}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMessages.length === 0 && (
                <div style={{ fontSize: 13, color: activeTheme.subtext }}>
                  {t("chatPlaceholder")}
                </div>
              )}
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%",
                    background: m.role === "user" ? "#0ea5e9" : (theme === "light" ? "#f3f4f6" : "#111827"),
                    color: m.role === "user" ? "#ffffff" : activeTheme.text,
                    padding: "10px 12px",
                    borderRadius: 12,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.45,
                    fontSize: 14
                  }}
                >
                  <div>{m.text}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, textAlign: m.role === "user" ? "right" : "left" }}>{m.time}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: activeTheme.subtext }}>
                  <Spinner size={14} />
                  <span style={{ fontSize: 12 }}>AI thinking...</span>
                </div>
              )}
            </div>
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${activeTheme.border}`, display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatLoading) sendChatMessage(chatInput);
                  }
                }}
                placeholder={t("chatPlaceholder")}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `1px solid ${activeTheme.border}`, background: theme === "light" ? "#f8fafc" : "#0f131a", color: activeTheme.text }}
              />
              <button onClick={() => sendChatMessage(chatInput)} disabled={chatLoading} style={{ ...tabBtn(activeTheme), padding: "10px 12px", minWidth: 50, background: "#f97316", borderColor: "#f97316", color: "#fff" }}>
                {chatLoading ? "..." : t("chatSend")}
              </button>
            </div>
          </div>
          <div
            onClick={() => setShowChat(false)}
            style={{
              position: "fixed",
              left: "min(260px, 82vw)",
              top: 90,
              height: "calc(100vh - 110px)",
              width: 22,
              background: "rgba(0,0,0,0.28)",
              border: `1px solid ${activeTheme.border}`,
              borderLeft: "none",
              cursor: "pointer",
              zIndex: 9997,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              color: "#fff",
              fontSize: 10,
              letterSpacing: 0.5,
              userSelect: "none",
              animation: "chat-fade-in 180ms ease forwards"
            }}
            title={t("chatClose")}
          >
            <span>&lt;</span>
            <span>&lt;</span>
            <span>&lt;</span>
          </div>
        </>
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
              animation: "toast-pop 240ms ease, toast-hide 200ms ease 2.4s forwards",
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

// ⭐️ 탭 버튼 스타일 (색상 변경)
const tabBtn = (theme) => ({ 
  background: "transparent", 
  border: "none",
  color: theme.subtext,
  padding: "8px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: "500",
  transition: "color 180ms ease, transform 180ms ease, text-shadow 180ms ease"
});
const activeTab = (theme) => ({ 
  ...tabBtn(theme), 
  color: theme.text,
  background: "transparent",
  fontWeight: "700",
  transform: "translateY(-1px)",
  textShadow: `0 0 10px ${theme.text}25`
});
const tradeSwitchBtn = (theme) => ({
  background: "transparent",
  border: `1px solid ${theme.border}`,
  color: theme.subtext,
  padding: "8px 14px",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  transition: "all 180ms ease"
});
const tradeSwitchActive = (theme) => ({
  ...tradeSwitchBtn(theme),
  background: "#d1d5db",
  color: theme.text,
  border: `1px solid ${theme.border}`
});
const settingsActive = (theme) => ({
  ...tabBtn(theme),
  background: theme.accent,
  color: "#ffffff",
  borderRadius: 10
});
const dangerBtn = (theme) => ({
  ...tabBtn(theme),
  background: "#ef4444",
  border: "1px solid #ef4444",
  color: "#ffffff"
});

const BnbChainLogo = ({ size = 24 }) => (
  <img
    src={bnbLogoDataUrl}
    alt="BNB Chain"
    width={size}
    height={size}
    style={{ display: "block", objectFit: "contain" }}
  />
);

const walletLogoFallback =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231f2937'/%3E%3Ctext x='16' y='21' text-anchor='middle' fill='%23ffffff' font-family='Arial' font-size='12' font-weight='700'%3EW%3C/text%3E%3C/svg%3E";

const WalletLogo = ({ src, alt, size = 26 }) => {
  const resolvedSrc = typeof src === "string" ? src : src?.default || walletLogoFallback;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "block", objectFit: "contain" }}
      onError={(e) => {
        if (e?.target?.src !== walletLogoFallback) e.target.src = walletLogoFallback;
      }}
    />
  );
};

const Spinner = ({ size = 16 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: "2px solid currentColor",
      borderTopColor: "transparent",
      animation: "spin 0.9s linear infinite"
    }}
  />
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
