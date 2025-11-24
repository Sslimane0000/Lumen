import { useEffect, useRef } from 'react';
import { saveSession } from '../utils/db';

export const useReadingTimer = (bookId, pageNumber, trackingStarted, pagesReadRef) => {
    const startTimeRef = useRef(null);
    const prevPageRef = useRef(pageNumber);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab hidden: Save current session and stop timer
                if (trackingStarted && startTimeRef.current) {
                    const endTime = new Date();
                    const duration = Math.round((endTime - startTimeRef.current) / 1000);
                    if (duration > 0) {
                        const pagesRead = pagesReadRef ? pagesReadRef.current : 0;
                        // Use current pageNumber because we haven't changed page, just visibility
                        saveSession({
                            bookId,
                            startTime: startTimeRef.current,
                            endTime,
                            duration,
                            page: pageNumber,
                            pagesRead
                        });
                        if (pagesReadRef) pagesReadRef.current = 0;
                    }
                    startTimeRef.current = null;
                }
            } else {
                // Tab visible: Resume timer if tracking was active
                if (trackingStarted) {
                    startTimeRef.current = new Date();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (trackingStarted && !document.hidden) {
            startTimeRef.current = new Date();
        } else {
            startTimeRef.current = null;
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Save on unmount if tracking was active
            if (trackingStarted && startTimeRef.current) {
                const endTime = new Date();
                const duration = Math.round((endTime - startTimeRef.current) / 1000);
                if (duration > 1) {
                    console.log('Saving session on unmount:', { duration, page: prevPageRef.current });
                    const pagesRead = pagesReadRef ? pagesReadRef.current : 0;
                    saveSession({
                        bookId,
                        startTime: startTimeRef.current,
                        endTime,
                        duration,
                        page: prevPageRef.current, // Use PREVIOUS page (the page being read)
                        pagesRead
                    });
                    if (pagesReadRef) pagesReadRef.current = 0;
                }
            }
        };
    }, [trackingStarted, bookId]);

    // Save session when page changes
    useEffect(() => {
        const saveAndReset = async () => {
            // If page changed, we want to save time for the PREVIOUS page
            if (trackingStarted && startTimeRef.current) {
                const endTime = new Date();
                const duration = Math.round((endTime - startTimeRef.current) / 1000);

                // Only save if duration is significant (e.g., > 1 seconds)
                if (duration > 1) {
                    console.log('Saving session:', { duration, page: prevPageRef.current });
                    await saveSession({
                        bookId,
                        startTime: startTimeRef.current,
                        endTime,
                        duration,
                        page: prevPageRef.current, // Use PREVIOUS page
                        pagesRead: pagesReadRef ? pagesReadRef.current : 0
                    });
                    if (pagesReadRef) pagesReadRef.current = 0;
                }
            }

            // Reset timer for new page
            if (trackingStarted) {
                startTimeRef.current = new Date();
            } else {
                startTimeRef.current = null;
            }

            // Update previous page ref
            prevPageRef.current = pageNumber;
        };

        saveAndReset();
    }, [pageNumber, trackingStarted, bookId, pagesReadRef]);
};
