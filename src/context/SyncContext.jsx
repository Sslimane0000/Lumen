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
        const init = async () => {
            try {
                const { restoreSession } = await import('../services/googleDrive');
                const restored = await restoreSession();
                if (restored) setGoogleUser(true);
            } catch (e) {
                console.error("Auth restore failed", e);
            }
        };
        init();
    }, []);

    const login = async () => {
        try {
            const { signIn } = await import('../services/googleDrive');
            await signIn();
            setGoogleUser(true);
            triggerSync();
        } catch (e) {
            console.error("Login failed", e);
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
