'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  PlaySquare,
  RefreshCw,
  Activity,
  User,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/channel', label: 'Channel', icon: User },
  { href: '/sync', label: 'Sync', icon: RefreshCw },
  { href: '/status', label: 'Status', icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-youtube-gray border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-2">
          <PlaySquare className="w-8 h-8 text-red-600" />
          <span className="text-xl font-bold">YT Archive</span>
        </Link>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-youtube-lightgray text-white'
                      : 'text-gray-400 hover:bg-youtube-lightgray hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 text-center">
          YouTube Channel Archiver v1.0
        </p>
      </div>
    </aside>
  );
}
