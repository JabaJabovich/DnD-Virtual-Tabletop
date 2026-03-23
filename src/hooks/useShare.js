// hooks/useShare.js
import { useState, useCallback } from 'react';

export function useShare(updateSession) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareType,        setShareType]        = useState('image');
  const [shareContent,     setShareContent]     = useState('');
  const [shareTargets,     setShareTargets]     = useState('all');
  const [dismissedMediaId, setDismissedMediaId] = useState(null);

  const handleShare = useCallback(() => {
    updateSession({
      sharedMedia: {
        id: Date.now(),
        type: shareType,
        content: shareContent,
        visibleTo: shareTargets.includes('all') ? 'all' : shareTargets,
      },
    });
    setIsShareModalOpen(false);
    setShareContent('');
  }, [updateSession, shareType, shareContent, shareTargets]);

  return {
    isShareModalOpen, setIsShareModalOpen,
    shareType,        setShareType,
    shareContent,     setShareContent,
    shareTargets,     setShareTargets,
    dismissedMediaId, setDismissedMediaId,
    handleShare,
  };
}
