import React, { useState, useEffect } from 'react';
import { X, RotateCw, Check, ThumbsUp, ThumbsDown, AlertCircle, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rating } from '../../utils/fsrs';
import { playWordAudio } from '../../utils/audio';

export default function FlashcardModal({ words, onReview, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [complete, setComplete] = useState(false);

    const currentWord = words[currentIndex];

    const handleRating = (rating) => {
        onReview(currentWord, rating);

        if (currentIndex < words.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
        } else {
            setComplete(true);
        }
    };

    if (complete) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
                    <p className="text-gray-400 mb-8">You've reviewed all your due cards.</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors w-full"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    if (!currentWord) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl relative">
                {/* Header */}
                <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-gray-400">
                    <span className="font-medium">Card {currentIndex + 1} of {words.length}</span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Card */}
                <div
                    className="relative h-96 perspective-1000 cursor-pointer group"
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    <motion.div
                        initial={false}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                        className="w-full h-full relative preserve-3d"
                    >
                        {/* Front */}
                        <div className="absolute inset-0 backface-hidden bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8">
                            <span className="text-sm text-indigo-400 font-medium tracking-wider uppercase mb-4">Word</span>
                            <div className="flex items-center gap-3">
                                <h2 className="text-5xl font-bold text-white text-center">{currentWord.word}</h2>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playWordAudio(currentWord.word, currentWord.audio);
                                    }}
                                    className="p-3 bg-gray-700/50 hover:bg-indigo-500/20 rounded-full text-indigo-400 hover:text-indigo-300 transition-all"
                                    title="Play Audio"
                                >
                                    <Volume2 className="w-8 h-8" />
                                </button>
                            </div>
                            <p className="text-gray-500 mt-8 text-sm">Click to flip</p>
                        </div>

                        {/* Back */}
                        <div
                            className="absolute inset-0 backface-hidden bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 rotate-y-180"
                        >
                            <div className="w-full h-full overflow-y-auto custom-scrollbar flex flex-col p-4">
                                <div className="flex items-center justify-center gap-2 mb-4 sticky top-0 bg-gray-800 py-2 z-10">
                                    <span className="text-sm text-indigo-400 font-medium tracking-wider uppercase">Definition</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            playWordAudio(currentWord.word, currentWord.audio);
                                        }}
                                        className="p-1 hover:bg-gray-700 rounded-full text-indigo-400"
                                        title="Play Audio"
                                    >
                                        <Volume2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-6 text-left w-full">
                                    {currentWord.meanings && currentWord.meanings.length > 0 ? (
                                        currentWord.meanings.map((m, i) => (
                                            <div key={i}>
                                                <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider block mb-2 border-b border-gray-700 pb-1">
                                                    {m.partOfSpeech}
                                                </span>
                                                <ul className="list-disc list-outside ml-4 space-y-2">
                                                    {m.definitions.map((def, dIdx) => (
                                                        <li key={dIdx} className="text-gray-200 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: def.replace(/<a[^>]*>(.*?)<\/a>/g, '$1') }} />
                                                    ))}
                                                </ul>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center mt-8">
                                            <span className="text-xs text-gray-500 uppercase block mb-1">{currentWord.partOfSpeech}</span>
                                            <p className="text-gray-200 text-lg leading-relaxed">{currentWord.definition}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Controls */}
                <div className={`mt-8 grid grid-cols-4 gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100 pointer-events-auto' : 'opacity-50 pointer-events-none'}`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRating(Rating.Again); }}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-800 border border-red-500/30 rounded-xl hover:bg-red-500/10 hover:border-red-500 transition-all group"
                    >
                        <RotateCw className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium text-red-400">Again</span>
                        <span className="text-xs text-gray-500">1 min</span>
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleRating(Rating.Hard); }}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-800 border border-orange-500/30 rounded-xl hover:bg-orange-500/10 hover:border-orange-500 transition-all group"
                    >
                        <AlertCircle className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium text-orange-400">Hard</span>
                        <span className="text-xs text-gray-500">2 days</span>
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleRating(Rating.Good); }}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-800 border border-blue-500/30 rounded-xl hover:bg-blue-500/10 hover:border-blue-500 transition-all group"
                    >
                        <ThumbsUp className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium text-blue-400">Good</span>
                        <span className="text-xs text-gray-500">4 days</span>
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleRating(Rating.Easy); }}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-800 border border-green-500/30 rounded-xl hover:bg-green-500/10 hover:border-green-500 transition-all group"
                    >
                        <Check className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium text-green-400">Easy</span>
                        <span className="text-xs text-gray-500">7 days</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
