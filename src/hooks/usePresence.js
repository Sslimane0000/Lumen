import { useEffect, useState } from 'react';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { useAuth } from './useAuth';

export function usePresence() {
    const { user } = useAuth();
    const [onlineCount, setOnlineCount] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState({});

    useEffect(() => {
        if (!user) return;

        const userStatusDatabaseRef = ref(rtdb, '/status/' + user.uid);
        const connectedRef = ref(rtdb, '.info/connected');

        const unsubscribe = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === false) {
                return;
            }

            onDisconnect(userStatusDatabaseRef).set({
                state: 'offline',
                last_changed: serverTimestamp(),
            }).then(() => {
                set(userStatusDatabaseRef, {
                    state: 'online',
                    last_changed: serverTimestamp(),
                    displayName: user.displayName || 'Anonymous',
                    photoURL: user.photoURL || null,
                });
            });
        });

        return () => {
            unsubscribe();
            // Optional: Set offline on unmount if desired, but onDisconnect handles tab close
            set(userStatusDatabaseRef, {
                state: 'offline',
                last_changed: serverTimestamp(),
            });
        };
    }, [user]);

    // Listen for all online users
    useEffect(() => {
        const allStatusRef = ref(rtdb, '/status');
        const unsubscribe = onValue(allStatusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const online = {};
                let count = 0;
                Object.entries(data).forEach(([uid, info]) => {
                    if (info.state === 'online') {
                        online[uid] = info;
                        count++;
                    }
                });
                setOnlineUsers(online);
                setOnlineCount(count);
            } else {
                setOnlineUsers({});
                setOnlineCount(0);
            }
        });

        return () => unsubscribe();
    }, []);

    return { onlineCount, onlineUsers };
}
