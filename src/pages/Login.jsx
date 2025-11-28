import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowLeft, Chrome } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                alert('Account created! You are now signed in.');
                navigate('/');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 relative overflow-hidden">

                {/* Decorative gradient */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                <button
                    onClick={() => navigate('/')}
                    className="absolute top-4 left-4 p-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="text-center mb-8 mt-4">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-gray-400">
                        {isSignUp ? 'Sign up to sync your library' : 'Sign in to access your books'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                <span>Sign in with Google</span>
                            </>
                        )}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-800 text-gray-400">Or continue with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isSignUp ? 'Sign Up' : 'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
                    >
                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    );
}
