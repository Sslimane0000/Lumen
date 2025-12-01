import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(null);
    const [googleUser, setGoogleUser] = useState(null);
    const { user } = useAuth(); // Keep existing auth for now if needed, but we rely on Google

    // Restore session on mount
    useEffect(() => {
        console.log('[SyncContext] Initializing...');
        const init = async () => {
            try {
                console.log('[SyncContext] Importing googleDrive...');
                const { restoreSession } = await import('../services/googleDrive');
                console.log('[SyncContext] Calling restoreSession...');
                const restored = await restoreSession();
                console.log('[SyncContext] Restore result:', restored);
                if (restored) setGoogleUser(true);
            } catch (e) {
                console.error("[SyncContext] Auth restore failed", e);
            }
        };
        init();
    }, []);

    const login = async () => {
        try {
            // Import Firebase auth services
            const { auth, googleProvider } = await import('../services/firebase');
            const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');

            // 1. Sign in with Firebase (enables Leaderboard, Chat, Online Users)
            googleProvider.addScope('https://www.googleapis.com/auth/drive');
            googleProvider.setCustomParameters({
                prompt: 'select_account consent'
            });
            const result = await signInWithPopup(auth, googleProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const accessToken = credential?.accessToken;

            if (accessToken) {
                // 2. Initialize Google Drive session with the same token
                const { setSessionToken } = await import('../services/googleDrive');
                await setSessionToken(accessToken);
                setGoogleUser(true);
                triggerSync();
            }
            return result;
        } catch (e) {
            console.error("Login failed", e);
            // Fallback: try direct Drive login if Firebase fails (e.g. if config is wrong but Drive is fine)
            // But usually we want them linked.
        }
    };

    const triggerSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncError(null);
        console.log("Starting Global Sync...");

        try {
            const { syncService } = await import('../services/syncService');
            // Run all syncs
            await Promise.all([
                syncService.syncVocabulary(),
                syncService.syncSessions(),
                syncService.syncBooks(),
                syncService.syncSettings()
            ]);
            console.log("Global Sync Complete");
        } catch (error) {
            console.error("Global Sync Failed", error);
            setSyncError(error.message);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    // Auto-sync helper (debounced or immediate)
    const autoSync = () => {
        if (googleUser && !isSyncing) {
            triggerSync();
        }
    };

    const resetRemoteStatsAndVocab = async () => {
        try {
            const { syncService } = await import('../services/syncService');
            await syncService.resetRemoteStatsAndVocab();
        } catch (e) {
            console.error("Failed to reset remote data", e);
        }
    };

    return (
        <SyncContext.Provider value={{
            isSyncing,
            syncError,
            triggerSync,
            autoSync,
            googleUser,
            login,
            resetRemoteStatsAndVocab
        }}>
            {children}
        </SyncContext.Provider>
    );
};
