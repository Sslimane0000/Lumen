import { useEffect, useState } from 'react';
import { ref, onChildAdded, push, serverTimestamp, query, limitToLast, orderByChild } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { useAuth } from './useAuth';

export function useChat() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const messagesRef = ref(rtdb, 'messages');
        const recentMessagesQuery = query(messagesRef, limitToLast(50));

        const unsubscribe = onChildAdded(recentMessagesQuery, (snapshot) => {
            const message = snapshot.val();
            setMessages((prev) => [...prev, { id: snapshot.key, ...message }]);
        });

        return () => {
            // onChildAdded returns an unsubscribe function in newer SDKs? 
            // Actually onChildAdded returns the Unsubscribe function directly in modular SDK.
            unsubscribe();
        };
    }, []);

    const sendMessage = async (text) => {
        if (!user || !text.trim()) return;

        const messagesRef = ref(rtdb, 'messages');
        await push(messagesRef, {
            text: text.trim(),
            uid: user.uid,
            displayName: user.displayName || 'Anonymous',
            photoURL: user.photoURL || null,
            timestamp: serverTimestamp(),
        });
    };

    return { messages, sendMessage };
}
