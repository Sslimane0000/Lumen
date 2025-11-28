import { useEffect, useRef } from 'react';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Custom hook to track reading time and update Firestore
 * @param {string} userId - The authenticated user's ID
 * @param {boolean} isActive - Whether the user is actively reading (default: true)
 */
export function useReadingTime(userId, isActive = true) {
    const intervalRef = useRef(null);
    const lastUpdateRef = useRef(Date.now());

    useEffect(() => {
        // Don't track if no userId or not active
        if (!userId || !isActive) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Start tracking
        lastUpdateRef.current = Date.now();

        // Update Firestore every 60 seconds
        intervalRef.current = setInterval(async () => {
            try {
                const userRef = doc(db, 'users', userId);

                // Increment minutesRead by 1
                await setDoc(userRef, {
                    minutesRead: increment(1),
                    lastActive: new Date().toISOString()
                }, { merge: true });

                console.log('✓ Reading time tracked: +1 minute');
            } catch (error) {
                console.error('Error tracking reading time:', error);
            }
        }, 60000); // 60 seconds = 1 minute

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [userId, isActive]);
}
