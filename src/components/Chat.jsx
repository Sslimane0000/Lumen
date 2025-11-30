import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { MessageSquare, Send, X, Minimize2, Maximize2 } from 'lucide-react';

export default function Chat() {
    const { user } = useAuth();
    const { messages, sendMessage } = useChat();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
        }
    }, [messages, isOpen, isMinimized]);

    const handleSend = (e) => {
        e.preventDefault();
        if (inputText.trim()) {
            sendMessage(inputText);
            setInputText('');
        }
    };

    if (!user) return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-transform hover:scale-105"
            >
                <MessageSquare className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className={`fixed bottom-4 right-4 z-50 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col transition-all duration-300 ${isMinimized ? 'h-14' : 'h-96'}`}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800/50 rounded-t-xl cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-sm text-gray-200">Global Chat</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400"
                    >
                        {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        className="p-1 hover:bg-red-900/30 hover:text-red-400 rounded text-gray-400"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-900/50">
                        {messages.map((msg) => {
                            const isMe = msg.uid === user.uid;
                            return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-1 mb-1">
                                        {!isMe && (
                                            <span className="text-[10px] text-gray-500">{msg.displayName}</span>
                                        )}
                                    </div>
                                    <div
                                        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${isMe
                                                ? 'bg-indigo-600 text-white rounded-br-none'
                                                : 'bg-gray-800 text-gray-200 rounded-bl-none'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 border-t border-gray-700 bg-gray-800/30 rounded-b-xl">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim()}
                                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}
