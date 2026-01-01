// 체인/DEX 설정을 한 곳에 모아 멀티체인 확장에 대비합니다.
export const CHAINS = {
  bscMainnet: {
    key: "bscMainnet",
    name: "BSC Mainnet",
    chainId: 56,
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
    factory: "0xCA143CE32Fe78f1f7019d7d551a6402fC5350c73",
    nativeSymbol: "BNB",
    wrappedSymbol: "WBNB",
    nativeAlias: "bnb-native",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    stable: { symbol: "BUSD", address: "0xe9e7cea3dedca5984780bafc599bd69add087d56" },
    explorerTx: "https://bscscan.com/tx/",
    rpcUrls: ["https://bsc-dataseed.binance.org/"],
    pollMs: 5000,
    tokens: [
      { symbol: "BNB", address: "bnb-native", decimals: 18 },
      { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 },
      { symbol: "BUSD", address: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      { symbol: "USDC", address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
      { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
      { symbol: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
      { symbol: "ETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
      { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
      { symbol: "XRP", address: "0x1D2F0da169ceB9fC7CE6eB8eC2dFd5beEa3b3B45", decimals: 18 },
      { symbol: "ADA", address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47", decimals: 18 },
      { symbol: "DOT", address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402", decimals: 18 },
      { symbol: "DOGE", address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", decimals: 8 },
      { symbol: "LTC", address: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94", decimals: 18 },
      { symbol: "LINK", address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", decimals: 18 },
      { symbol: "MATIC", address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD", decimals: 18 },
      { symbol: "AVAX", address: "0x1CE0cE62d0F2A260d025BEcC7E671cE1f6bB89d5", decimals: 18 },
      { symbol: "SHIB", address: "0x28590a1aF67B31D943ea25bffDEc9c046E1A72F4", decimals: 18 },
      { symbol: "TUSD", address: "0x14016E85a25aeb13065688cafB43044C2ef86784", decimals: 18 },
      { symbol: "BTT", address: "0x8595f9dA7b868b1822194FaED312235E43007b49", decimals: 18 }
    ],
    dexRouters: {
      pancake: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      apeswap: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
      biswap: "0xc7aBc9dabf3B3ab19e910C03e51d2f131eDA6Fd2",
      // 필요 시 메인넷 Uniswap V3, Hyperliquid 라우터 주소를 환경변수로 채워 사용하세요.
      uniswap: process.env.UNISWAP_ROUTER || "",
      hyperliquid: process.env.HYPERLIQUID_ROUTER || ""
    }
  },
  bscTestnet: {
    key: "bscTestnet",
    name: "BSC Testnet",
    chainId: 97,
    router: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
    factory: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
    nativeSymbol: "BNB",
    wrappedSymbol: "WBNB",
    nativeAlias: "bnb-native",
    wrappedNative: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
    stable: { symbol: "BUSD", address: "0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee" },
    explorerTx: "https://testnet.bscscan.com/tx/",
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
    pollMs: 5000,
    tokens: [
      { symbol: "BNB", address: "bnb-native", decimals: 18 },
      { symbol: "WBNB", address: "0xae13d989dac2f0debff460ac112a837c89baa7cd", decimals: 18 },
      { symbol: "BUSD", address: "0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee", decimals: 18 }
    ],
    dexRouters: {
      pancake: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
      apeswap: "",
      biswap: "",
      uniswap: "",
      hyperliquid: ""
    }
  }
};

// 환경 변수로 체인 전환 (REACT_APP_CHAIN 또는 CHAIN_KEY), 기본은 메인넷
export const DEFAULT_CHAIN_KEY = (process.env.REACT_APP_CHAIN || process.env.CHAIN_KEY || "bscMainnet").trim();
export const ACTIVE_CHAIN = CHAINS[DEFAULT_CHAIN_KEY] || CHAINS.bscTestnet;

export const NETWORK_NAME = ACTIVE_CHAIN.name;
export const CHAIN_ID = ACTIVE_CHAIN.chainId;
export const ROUTER_ADDRESS = ACTIVE_CHAIN.router;
export const FACTORY_ADDRESS = ACTIVE_CHAIN.factory;
export const NATIVE_ALIAS = ACTIVE_CHAIN.nativeAlias;
export const NATIVE_SYMBOL = ACTIVE_CHAIN.nativeSymbol;
export const WRAPPED_SYMBOL = ACTIVE_CHAIN.wrappedSymbol;
export const WBNB = ACTIVE_CHAIN.wrappedNative;
export const BUSD = ACTIVE_CHAIN.stable?.address;
export const POLL_MS = ACTIVE_CHAIN.pollMs;
export const EXPLORER_TX_BASE = ACTIVE_CHAIN.explorerTx;
export const DEFAULT_TOKENS = ACTIVE_CHAIN.tokens;
// 실행 가능한 DEX 라우터(활성 체인 기준)
export const DEX_ROUTERS = { ...(ACTIVE_CHAIN.dexRouters || {}) };
export const CHAIN_OPTIONS = Object.values(CHAINS).map((c) => ({ key: c.key, name: c.name }));
