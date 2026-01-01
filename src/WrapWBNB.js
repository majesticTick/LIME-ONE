import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getContract } from "./utils/getContract";
import { WBNB } from "./config";

const IWBNB_ABI = [
  { "inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"wad","type":"uint256"}], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

export default function WrapWBNB({ provider, isConnected, language = "ko", onWrapSuccess, onRequestConnect }) {
  const [amount, setAmount] = useState("0.02");
  const [wrapping, setWrapping] = useState(false);
  const [toast, setToast] = useState(null);
  const txt = {
    ko: {
      title: "BNB → WBNB 랩핑",
      placeholder: "BNB 수량 (예: 0.02)",
      button: "랩핑",
      fee: "가스비: tBNB 필요",
      connectBtn: "지갑 연결",
      needConnect: "지갑을 연결해주세요.",
      success: "BNB → WBNB 랩핑 완료",
      failPrefix: "랩핑 실패: ",
      inProgress: "진행중...",
      connectTooltip: "지갑 연결 필요"
    },
    en: {
      title: "BNB → WBNB Wrap",
      placeholder: "BNB amount (e.g., 0.02)",
      button: "Wrap",
      fee: "Gas: tBNB required",
      connectBtn: "Connect Wallet",
      needConnect: "Please connect your wallet.",
      success: "BNB → WBNB wrap completed",
      failPrefix: "Wrap failed: ",
      inProgress: "Processing...",
      connectTooltip: "Wallet connection required"
    }
  }[language] || {};

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const wrap = async () => {
    if (!isConnected) {
      onRequestConnect?.();
      return;
    }
    try {
      setWrapping(true);
      const signer = provider.getSigner();
      const wbnb = getContract(WBNB, IWBNB_ABI, signer);
      const tx = await wbnb.deposit({ value: ethers.utils.parseEther(amount) });
      await tx.wait();
      const time = new Date().toLocaleString();
      setToast({
        type: "success",
        message: txt.success,
        detail: `${amount} BNB → WBNB`,
        time
      });
      if (onWrapSuccess) {
        onWrapSuccess({
          id: `${Date.now()}-wrap`,
          type: "wrap",
          detail: `${amount} BNB → WBNB`,
          time,
          txHash: tx.hash,
          from: await signer.getAddress(),
          to: WBNB,
          changes: [
            { token: "BNB", change: `-${amount}` },
            { token: "WBNB", change: `+${amount}` }
          ]
        });
      }
    } catch (e) {
      console.error(e);
      alert(txt.failPrefix + (e?.message || e));
    } finally {
      setWrapping(false);
    }
  };

  return (
    <>
      <div className="card">
        <h3>{txt.title}</h3>
        <div className="row" style={{marginTop:8}}>
          <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder={txt.placeholder} />
          <button onClick={wrap} disabled={wrapping} title={isConnected ? "" : txt.connectTooltip}>
            {wrapping ? txt.inProgress : (isConnected ? txt.button : txt.connectBtn)}
          </button>
        </div>
        <div className="muted" style={{marginTop:8}}>{txt.fee}</div>
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
