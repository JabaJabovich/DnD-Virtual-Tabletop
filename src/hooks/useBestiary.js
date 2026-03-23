// hooks/useBestiary.js
import { useState, useEffect } from 'react';

export function useBestiary() {
  const [bestiary, setBestiary] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vtt-bestiary')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vtt-bestiary', JSON.stringify(bestiary));
    } catch (err) {
      console.warn('localStorage недоступен', err);
    }
  }, [bestiary]);

  return { bestiary, setBestiary };
}
