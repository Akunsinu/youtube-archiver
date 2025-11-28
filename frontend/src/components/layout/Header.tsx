'use client';

import { useState } from 'react';
import { Search, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRouter } from 'next/navigation';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const { isConnected, syncProgress } = useWebSocket();
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 bg-youtube-gray border-b border-gray-800 flex items-center justify-between px-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos..."
            className="w-full bg-youtube-dark border border-gray-700 rounded-full py-2 px-4 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        </div>
      </form>

      {/* Status Indicators */}
      <div className="flex items-center gap-4">
        {/* Sync Progress */}
        {syncProgress && (
          <div className="flex items-center gap-2 bg-youtube-lightgray px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm">
              Syncing: {syncProgress.processed}/{syncProgress.total}
            </span>
          </div>
        )}

        {/* Connection Status */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded ${
            isConnected ? 'text-green-500' : 'text-red-500'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        >
          {isConnected ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
        </div>
      </div>
    </header>
  );
}
