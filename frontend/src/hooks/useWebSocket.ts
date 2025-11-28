'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessage, WSSyncProgress, WSDownloadProgress } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface UseWebSocketReturn {
  isConnected: boolean;
  syncProgress: WSSyncProgress | null;
  downloadProgress: Record<number, WSDownloadProgress>;
  lastMessage: WSMessage | null;
  sendMessage: (message: string) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [syncProgress, setSyncProgress] = useState<WSSyncProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<number, WSDownloadProgress>>({});
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${WS_URL}/api/v1/ws`);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);

          switch (message.type) {
            case 'sync_progress':
              setSyncProgress(message.data as WSSyncProgress);
              break;

            case 'download_progress':
              const downloadData = message.data as WSDownloadProgress;
              setDownloadProgress((prev) => ({
                ...prev,
                [downloadData.video_id]: downloadData,
              }));
              break;

            case 'sync_completed':
            case 'sync_cancelled':
            case 'sync_error':
              setSyncProgress(null);
              setDownloadProgress({});
              break;

            case 'connected':
              // Initial status from server
              if (message.data?.status === 'syncing' || message.data?.status === 'downloading') {
                setSyncProgress({
                  job_id: message.data.job_id,
                  total: message.data.total_items,
                  processed: message.data.processed_items,
                  current_video: message.data.current_item,
                  percent_complete: message.data.percent_complete,
                });
              }
              break;
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    }
  }, []);

  useEffect(() => {
    connect();

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    syncProgress,
    downloadProgress,
    lastMessage,
    sendMessage,
  };
}
