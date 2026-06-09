import { useEffect } from 'react';

export const usePreventZoom = () => {
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        };

        const handleGesture = (e: Event) => {
            e.preventDefault();
        };

        document.addEventListener('wheel', handleWheel, { passive: false });
        document.addEventListener('gesturestart', handleGesture);
        document.addEventListener('gesturechange', handleGesture);

        return () => {
            document.removeEventListener('wheel', handleWheel);
            document.removeEventListener('gesturestart', handleGesture);
            document.removeEventListener('gesturechange', handleGesture);
        };
    }, []);
};
