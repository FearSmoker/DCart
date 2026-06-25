// * userealtime — central react hook...
"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type EventMap = {
  "order:created"?: (data: Record<string, unknown>) => void;
  "order:cancelled"?: (data: Record<string, unknown>) => void;
  "order:dispatched"?: (data: Record<string, unknown>) => void;
  "order:delivered"?: (data: Record<string, unknown>) => void;
  "order:returned"?: (data: Record<string, unknown>) => void;
  "order:updated"?: (data: Record<string, unknown>) => void;
  "order:return_requested"?: (data: Record<string, unknown>) => void;
  "order:return_dispatched"?: (data: Record<string, unknown>) => void;
  "order:return_seller_rejected"?: (data: Record<string, unknown>) => void;
  "order:return_admin_declined"?: (data: Record<string, unknown>) => void;
  "review:added"?: (data: Record<string, unknown>) => void;
  "product:created"?: (data: Record<string, unknown>) => void;
  "inventory:updated"?: (data: Record<string, unknown>) => void;
  "analytics:updated"?: (data: Record<string, unknown>) => void;
  "payout:approved"?: (data: Record<string, unknown>) => void;
  "payout:rejected"?: (data: Record<string, unknown>) => void;
  "log:entry"?: (data: Record<string, unknown>) => void;
  // legacy channels
  inventory_update?: (data: Record<string, unknown>) => void;
  new_notification?: (data: Record<string, unknown>) => void;
};

// singleton socket shared across all hook...
let globalSocket: Socket | null = null;
let socketInitPromise: Promise<void> | null = null;

async function initSocket(): Promise<void> {
  if (globalSocket?.connected) return;
  // boot the socket.io server (idempotent —...
  await fetch("/api/socket").catch(() => {});
  globalSocket = io({ path: "/api/socket", addTrailingSlash: false });
}

export function useRealtime(handlers: EventMap): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // initialize socket singleton once
    if (!socketInitPromise) {
      socketInitPromise = initSocket();
    }
    socketInitPromise.then(() => {
      if (!globalSocket) return;

      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);

      globalSocket.on("connect", onConnect);
      globalSocket.on("disconnect", onDisconnect);
      if (globalSocket.connected) setConnected(true);

      // register typed event handlers
      const registeredEvents = Object.keys(handlersRef.current) as (keyof EventMap)[];
      const wrappedHandlers: Map<string, (data: Record<string, unknown>) => void> = new Map();

      registeredEvents.forEach((eventName) => {
        const handler = (data: Record<string, unknown>) => {
          handlersRef.current[eventName]?.(data);
        };
        wrappedHandlers.set(eventName as string, handler);
        globalSocket?.on(eventName as string, handler);
      });

      return () => {
        globalSocket?.off("connect", onConnect);
        globalSocket?.off("disconnect", onDisconnect);
        wrappedHandlers.forEach((handler, eventName) => {
          globalSocket?.off(eventName, handler);
        });
      };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { connected };
}
