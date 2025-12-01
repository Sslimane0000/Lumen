import React from 'react';
import { usePresence } from '../hooks/usePresence';
import { Users } from 'lucide-react';

export default function OnlineUsers() {
    const { onlineCount, onlineUsers } = usePresence();

    console.log('OnlineUsers component - count:', onlineCount, 'users:', onlineUsers);

    if (onlineCount === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50">
            <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-full px-4 py-2 shadow-lg flex items-center gap-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors cursor-default group">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Users className="w-4 h-4 text-green-400" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    </div>
                    <span className="font-medium">{onlineCount} Online</span>
                </div>

                {/* Tooltip-like list on hover */}
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 hidden group-hover:block">
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider px-2">Active Readers</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {Object.values(onlineUsers).map((u, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded">
                                <img
                                    src={u.photoURL || 'https://via.placeholder.com/20'}
                                    alt={u.displayName}
                                    className="w-5 h-5 rounded-full border border-gray-600"
                                />
                                <span className="truncate text-xs">{u.displayName}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
