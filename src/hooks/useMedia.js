// hooks/useMedia.js
import { useState, useRef, useCallback } from 'react';

export function useMedia() {
  const [localVideoUrl, setLocalVideoUrl] = useState('');
  const [localVolume, setLocalVolume] = useState(20);
  const [hideLocalGrid, setHideLocalGrid] = useState(false);
  const [isChatMuted, setIsChatMuted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isPotatoMode, setIsPotatoMode] = useState(false);

  const ytPlayerRef = useRef(null);

  const extractYTId = useCallback((url) => {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const vol = e.target.value;
    setLocalVolume(vol);
    if (ytPlayerRef.current?.contentWindow) {
      ytPlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }),
        '*'
      );
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (ytPlayerRef.current?.contentWindow) {
      ytPlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [localVolume] }),
        '*'
      );
    }
  }, [localVolume]);

  return {
    localVideoUrl, setLocalVideoUrl,
    localVolume, setLocalVolume,
    hideLocalGrid, setHideLocalGrid,
    isChatMuted, setIsChatMuted,
    isDarkMode, setIsDarkMode,
    isPotatoMode, setIsPotatoMode,
    ytPlayerRef,
    extractYTId,
    handleVolumeChange,
    handleIframeLoad,
  };
}
