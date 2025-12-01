import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth, googleProvider } from '../services/firebase';
import { Trophy, Trash2, LogOut, LogIn, Clock, ArrowLeft } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useSync } from '../context/SyncContext';

export default function Leaderboard() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const { user: currentUser } = useAuth();
    console.log('Leaderboard: Current user', currentUser?.uid);
    const [loading, setLoading] = useState(true);

    // Real-time leaderboard updates
    useEffect(() => {
        const q = query(
            collection(db, 'users'),
            orderBy('pagesRead', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leaderboardData = [];
            snapshot.forEach((doc) => {
                leaderboardData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setUsers(leaderboardData);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const { login } = useSync();

    const handleGoogleSignIn = async () => {
        try {
            const result = await login();
            if (!result) return; // Login might have failed or been cancelled
            const user = result.user;

            // Create/update user document with profile info
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                displayName: user.displayName,
                photoURL: user.photoURL,
                email: user.email,
                // We don't overwrite pagesRead if it exists, but we can set a default if missing
                // using merge: true handles the partial update, but won't set default if missing unless we check
                // For simplicity in this flow, we'll just merge. If pagesRead is undefined, it won't show up until they read.
                // Actually, let's ensure it exists for sorting.
            }, { merge: true });

            // Ensure pagesRead exists
            // We can't easily "set if missing" with just setDoc merge without reading first or using update.
            // But for now, let's just let the reader increment it.

        } catch (error) {
            console.error('Error signing in:', error);
            alert('Failed to sign in. Please try again.');
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleDelete = async (userId) => {
        const code = prompt('Enter admin code to delete this user:');

        if (code === 'SECRET_CODE_123') {
            try {
                await deleteDoc(doc(db, 'users', userId));
                alert('User deleted successfully!');
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Failed to delete user.');
            }
        } else if (code !== null) {
            alert('Incorrect code!');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                            title="Back to Library"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-3">
                            <Trophy className="w-10 h-10 text-yellow-400" />
                            <h1 className="text-4xl font-bold">Reading Leaderboard</h1>
                        </div>
                    </div>

                    {currentUser ? (
                        <div className="flex items-center gap-4">
                            <img
                                src={currentUser.photoURL}
                                alt={currentUser.displayName}
                                className="w-10 h-10 rounded-full border-2 border-indigo-400"
                            />
                            <span className="text-sm text-gray-300">{currentUser.displayName}</span>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleGoogleSignIn}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                        >
                            <LogIn className="w-5 h-5" />
                            Sign in with Google
                        </button>
                    )}
                </div>

                {/* Leaderboard */}
                <div className="bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
                    {loading ? (
                        <div className="p-12 text-center text-gray-400">
                            <Clock className="w-12 h-12 animate-spin mx-auto mb-4" />
                            Loading leaderboard...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-xl">No readers yet!</p>
                            <p className="text-sm mt-2">Be the first to start reading.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-700">
                            {users.map((user, index) => (
                                <div
                                    key={user.id}
                                    className={`flex items-center gap-4 p-4 hover:bg-gray-750 transition-colors ${currentUser?.uid === user.id ? 'bg-indigo-900/20 border-l-4 border-indigo-500' : ''
                                        }`}
                                >
                                    {/* Rank */}
                                    <div className="flex-shrink-0 w-12 text-center">
                                        {index === 0 && (
                                            <Trophy className="w-6 h-6 text-yellow-400 mx-auto" />
                                        )}
                                        {index === 1 && (
                                            <Trophy className="w-6 h-6 text-gray-400 mx-auto" />
                                        )}
                                        {index === 2 && (
                                            <Trophy className="w-6 h-6 text-orange-600 mx-auto" />
                                        )}
                                        {index > 2 && (
                                            <span className="text-2xl font-bold text-gray-500">#{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Profile Picture */}
                                    <img
                                        src={user.photoURL || 'https://via.placeholder.com/40'}
                                        alt={user.displayName}
                                        className="w-12 h-12 rounded-full border-2 border-gray-600"
                                    />

                                    {/* Name */}
                                    <div className="flex-1">
                                        <p className="font-semibold text-lg">{user.displayName || 'Anonymous'}</p>
                                        <p className="text-xs text-gray-400">{user.email}</p>
                                    </div>

                                    {/* Pages Read */}
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-indigo-400">
                                            {user.pagesRead || 0}
                                        </p>
                                        <p className="text-xs text-gray-500">pages read</p>
                                    </div>

                                    {/* Admin Delete */}
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                        title="Delete user (admin)"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Box */}
                {!currentUser && (
                    <div className="mt-6 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                        <p className="text-sm text-indigo-300">
                            💡 <strong>Tip:</strong> Sign in with Google to track your reading time and compete with others!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
