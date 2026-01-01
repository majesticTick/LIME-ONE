import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import RouterABI from "../abi/Router.json";
import { ROUTER_ADDRESS, BUSD } from "../config";

export default function TokenPrices({ provider, tokenList, pollMs=5000 }) {
  const [rows, setRows] = useState([]);
  const router = useMemo(() => {
    if (!provider) return null;
    return new ethers.Contract(ROUTER_ADDRESS, RouterABI, provider);
  }, [provider]);

  useEffect(() => {
    if (!router || tokenList.length === 0) return;
    let timer;
    const refresh = async () => {
      try {
        const result = [];
        for (const t of tokenList) {
          if (t.address.toLowerCase() === BUSD.toLowerCase()) {
            result.push({ symbol: t.symbol, price: 1.0 });
            continue;
          }
          const one = ethers.utils.parseUnits("1", t.decimals || 18);
          try {
            const amounts = await router.getAmountsOut(one, [t.address, BUSD]);
            const price = Number(ethers.utils.formatUnits(amounts[1], 18));
            result.push({ symbol: t.symbol, price });
          } catch (e) {
            result.push({ symbol: t.symbol, price: null });
          }
        }
        setRows(result);
      } catch {}
    };
    refresh();
    timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [router, tokenList, pollMs]);

  return (
    <div className="card">
      <h3>실시간 토큰 가격 (vs BUSD)</h3>
      <table>
        <thead><tr><th>토큰</th><th>가격</th></tr></thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i}>
              <td>{r.symbol}</td>
              <td>{r.price === null ? "유동성 부족/오류" : r.price.toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted">※ Router.getAmountsOut 기반 온체인 견적</div>
    </div>
  );
}
