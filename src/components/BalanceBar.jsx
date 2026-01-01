import React from "react";
export default function BalanceBar({ balances }) {
  return (
    <div className="card" style={{marginTop:12}}>
      <div style={{fontWeight:700, marginBottom:6}}>내 지갑 잔액</div>
      <div className="row">
        <span className="pill">BNB: {balances.native}</span>
        <span className="pill">WBNB: {balances.wbnb}</span>
        <span className="pill">BUSD: {balances.busd}</span>
      </div>
    </div>
  );
}
