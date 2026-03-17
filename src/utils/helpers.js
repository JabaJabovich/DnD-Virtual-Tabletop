export const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID(); 
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export const PING_COLORS = [
   { bg: 'bg-red-500', shadow: 'rgba(239,68,68,1)' },
   { bg: 'bg-blue-500', shadow: 'rgba(59,130,246,1)' },
   { bg: 'bg-green-500', shadow: 'rgba(34,197,94,1)' },
   { bg: 'bg-purple-500', shadow: 'rgba(168,85,247,1)' },
   { bg: 'bg-amber-500', shadow: 'rgba(245,158,11,1)' },
   { bg: 'bg-pink-500', shadow: 'rgba(236,72,153,1)' },
   { bg: 'bg-cyan-500', shadow: 'rgba(6,182,212,1)' },
];

export const getUserColor = (accountId) => {
   if (!accountId) return PING_COLORS[0];
   let hash = 0;
   for (let i = 0; i < accountId.length; i++) {
       hash = accountId.charCodeAt(i) + ((hash << 5) - hash);
   }
   return PING_COLORS[Math.abs(hash) % PING_COLORS.length];
};

export const DELETE_FIELD = '__DELETE_FIELD__';

export const rollSound = typeof Audio !== 'undefined' ? new Audio('/sounds/dice-roll.mp3') : null;