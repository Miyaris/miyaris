"use client";

import { useEffect, useRef, useState } from "react";

import type { AuctionStatus, BidPublic } from "@/lib/types";

export interface AuctionLiveState {
  currentPrice: string;
  endsAt: string;
  extendedUntil: string | null;
  status: AuctionStatus;
  bidCount: number;
}

interface ServerSnapshot {
  type: "snapshot";
  data: {
    current_price: string;
    ends_at: string;
    extended_until: string | null;
    status: AuctionStatus;
    bid_count: number;
    recent_bids: BidPublic[];
  };
}

interface ServerBidPlaced {
  type: "bid.placed";
  data: {
    bid: BidPublic;
    auction: {
      current_price: string;
      extended_until: string | null;
      bid_count: number;
      status: AuctionStatus;
    };
  };
}

interface ServerAuctionEnded {
  type: "auction.ended";
  data: {
    sold: boolean;
    final_price: string | null;
    winning_bid_id: string | null;
  };
}

interface ServerAuctionStarted {
  type: "auction.started";
  data: { status: AuctionStatus };
}

interface ServerError {
  type: "error";
  data: { detail: string };
}

type ServerMessage =
  | ServerSnapshot
  | ServerBidPlaced
  | ServerAuctionEnded
  | ServerAuctionStarted
  | ServerError;

interface UseStreamOpts {
  initial: AuctionLiveState;
  initialBids: BidPublic[];
}

/**
 * Açık artırma WebSocket akışını dinler. Sayfa SSR ile dolu render olduğu için
 * initial state prop'tan gelir; WS bağlanıp snapshot'ı alana kadar UI doğru.
 */
export function useAuctionStream(
  auctionId: string,
  { initial, initialBids }: UseStreamOpts,
) {
  const [state, setState] = useState<AuctionLiveState>(initial);
  const [bids, setBids] = useState<BidPublic[]>(initialBids);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // WebSocket URL: NEXT_PUBLIC_WS_URL set'li ise onu kullan; yoksa
    // NEXT_PUBLIC_API_URL'in http(s) → ws(s) versiyonuna düş (Vercel env'i
    // tek bir alana yazmak yeterli olsun); o da yoksa localhost fallback.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ??
      apiUrl.replace(/^http/, "ws");
    let isUnmounted = false;
    let attempts = 0;

    function connect() {
      if (isUnmounted) return;
      const ws = new WebSocket(`${wsUrl}/ws/auctions/${auctionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempts = 0;
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data) as ServerMessage;
        } catch {
          return;
        }

        switch (msg.type) {
          case "snapshot":
            setState({
              currentPrice: msg.data.current_price,
              endsAt: msg.data.ends_at,
              extendedUntil: msg.data.extended_until,
              status: msg.data.status,
              bidCount: msg.data.bid_count,
            });
            setBids(msg.data.recent_bids);
            break;

          case "bid.placed":
            setState((prev) => ({
              ...prev,
              currentPrice: msg.data.auction.current_price,
              extendedUntil: msg.data.auction.extended_until,
              bidCount: msg.data.auction.bid_count,
              status: msg.data.auction.status,
            }));
            setBids((prev) => {
              if (prev.some((b) => b.id === msg.data.bid.id)) return prev;
              return [msg.data.bid, ...prev].slice(0, 50);
            });
            break;

          case "auction.started":
            setState((prev) => ({ ...prev, status: msg.data.status }));
            break;

          case "auction.ended":
            setState((prev) => ({ ...prev, status: "ended" }));
            break;

          case "error":
            console.warn("Auction WS error:", msg.data.detail);
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (isUnmounted) return;
        // Exponential backoff reconnect: 1s, 2s, 4s, ... max 30s
        attempts += 1;
        const delay = Math.min(30_000, 2 ** attempts * 500);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose otomatik tetiklenecek; reconnect orada
      };
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [auctionId]);

  return { state, bids, connected };
}
