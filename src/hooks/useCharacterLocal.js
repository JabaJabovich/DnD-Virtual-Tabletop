// hooks/useCharacterLocal.js
import { useState, useEffect } from 'react';

export function useCharacterLocal(activeWidgetCharacter) {
  const [localInv,   setLocalInv]   = useState([]);
  const [localAbil,  setLocalAbil]  = useState([]);
  const [localNotes, setLocalNotes] = useState('');

  useEffect(() => {
    setLocalInv(activeWidgetCharacter?.inventory ?? []);
  }, [activeWidgetCharacter?.inventory, activeWidgetCharacter?.id]);

  useEffect(() => {
    setLocalAbil(activeWidgetCharacter?.abilities ?? []);
  }, [activeWidgetCharacter?.abilities, activeWidgetCharacter?.id]);

  useEffect(() => {
    setLocalNotes(activeWidgetCharacter?.notes ?? '');
  }, [activeWidgetCharacter?.notes, activeWidgetCharacter?.id]);

  return {
    localInv,   setLocalInv,
    localAbil,  setLocalAbil,
    localNotes, setLocalNotes,
  };
}
