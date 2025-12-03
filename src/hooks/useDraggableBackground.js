import { useEffect, useRef } from 'react';

/**
 * Hook to enable drag-to-scroll behavior on a container, but only when clicking
 * on the background (not on specific content elements).
 * 
 * @param {React.RefObject} containerRef - Ref to the scrollable container
 * @param {string} contentSelector - CSS selector for the content element (clicking inside this won't trigger drag)
 */
export const useDraggableBackground = (containerRef, contentSelector) => {
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const scrollLeft = useRef(0);
    const scrollTop = useRef(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e) => {
            // Check if click is inside the content selector
            if (contentSelector && e.target.closest(contentSelector)) {
                return;
            }

            isDragging.current = true;
            startX.current = e.pageX - container.offsetLeft;
            startY.current = e.pageY - container.offsetTop;
            scrollLeft.current = container.scrollLeft;
            scrollTop.current = container.scrollTop;

            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none'; // Prevent text selection while dragging
        };

        const handleMouseLeave = () => {
            isDragging.current = false;
            container.style.cursor = 'default'; // Or whatever the default was
            container.style.removeProperty('user-select');
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            container.style.cursor = 'default'; // Or whatever the default was
            container.style.removeProperty('user-select');
        };

        const handleMouseMove = (e) => {
            if (!isDragging.current) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;
            const walkX = (x - startX.current) * 1.5; // Scroll-fast multiplier
            const walkY = (y - startY.current) * 1.5;
            container.scrollLeft = scrollLeft.current - walkX;
            container.scrollTop = scrollTop.current - walkY;
        };

        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('mousemove', handleMouseMove);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('mousemove', handleMouseMove);
        };
    }, [containerRef, contentSelector]);
};
