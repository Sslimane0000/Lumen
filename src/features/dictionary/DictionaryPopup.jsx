import React, { useEffect, useRef } from 'react';
import { X, Save, Volume2 } from 'lucide-react';
import { playWordAudio } from '../../utils/audio';

export default function DictionaryPopup({ word, definition, position, onClose, onSave, suggestions, onSelectSuggestion, onWordSelect }) {
    const popupRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Add word selection listener to popup content
    useEffect(() => {
        if (!onWordSelect || !popupRef.current) return;

        const handleClick = (e) => {
            if (e.altKey && e.detail === 2) { // Alt + double-click
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                if (selectedText && selectedText.length > 1) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    onWordSelect(selectedText, {
                        x: rect.left,
                        y: rect.bottom
                    });
                }
            }
        };

        const contentArea = popupRef.current.querySelector('.popup-content');
        if (contentArea) {
            contentArea.addEventListener('click', handleClick);
            return () => contentArea.removeEventListener('click', handleClick);
        }
    }, [onWordSelect, definition]);

    // Calculate position to keep it on screen (basic logic)
    const style = {
        top: Math.min(position.y + 10, window.innerHeight - 300),
        left: Math.min(position.x, window.innerWidth - 320),
    };

    const isArabic = definition?.language === 'ar';

    return (
        <div
            ref={popupRef}
            style={style}
            className="fixed z-50 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl text-gray-100 flex flex-col max-h-96"
            dir={isArabic ? 'rtl' : 'ltr'}
        >
            <div className="flex items-center justify-between p-3 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg capitalize">{word}</h3>
                    <button
                        onClick={() => playWordAudio(word, definition?.audio)}
                        className="p-1 hover:bg-gray-700 rounded-full text-indigo-400 transition-colors"
                        title="Play Audio"
                    >
                        <Volume2 className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex gap-2">
                    {definition && (
                        <button onClick={() => onSave(definition)} className="p-1 hover:bg-gray-700 rounded text-indigo-400" title="Save to Vocabulary">
                            <Save className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar popup-content">
                {definition ? (
                    <div className="space-y-4">
                        {definition.meanings.map((meaning, idx) => (
                            <div key={idx}>
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                                    {meaning.partOfSpeech}
                                </span>
                                <ul className={`list-disc list-inside space-y-1 ${isArabic ? 'text-right' : 'text-left'}`}>
                                    {meaning.definitions.slice(0, 3).map((def, dIdx) => (
                                        <li key={dIdx} className="text-sm text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: def }} />
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : suggestions && suggestions.length > 0 ? (
                    <div className="space-y-3" dir="rtl">
                        <p className="text-sm text-gray-400">لم أجد تعريفا. هل تقصد:</p>
                        <div className="flex flex-col gap-2">
                            {suggestions.map((suggestion, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onSelectSuggestion(suggestion)}
                                    className="px-3 py-2 bg-gray-700 hover:bg-indigo-600 rounded text-right text-sm transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-400 text-sm italic">Loading definition...</div>
                )}
            </div>
        </div>
    );
}
