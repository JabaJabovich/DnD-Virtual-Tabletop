// hooks/useDiceEngine.js
import { useEffect, useRef, useState, useCallback } from 'react';
import DiceBox from '@3d-dice/dice-box';
import { generateId, rollSound } from '../utils/helpers';
import { socket } from '../services/socket';

function simulateFallbackRoll(notation) {
  let total = 0;
  let rawRolls = [];
  let parsedNotation = notation.toLowerCase().replace(/\s/g, '');

  if (parsedNotation.includes('2d20kh1')) {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    total += Math.max(r1, r2);
    rawRolls = [r1, r2];
    parsedNotation = parsedNotation.replace('2d20kh1', '');
  } else if (parsedNotation.includes('2d20kl1')) {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    total += Math.min(r1, r2);
    rawRolls = [r1, r2];
    parsedNotation = parsedNotation.replace('2d20kl1', '');
  } else {
    const diceRegex = /(\d+)d(\d+)/g;
    let match;
    while ((match = diceRegex.exec(parsedNotation)) !== null) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        total += roll;
        rawRolls.push(roll);
      }
    }
    parsedNotation = parsedNotation.replace(/\d+d\d+/g, '');
  }

  const modRegex = /([+-]\d+)/g;
  let matchMod;
  while ((matchMod = modRegex.exec(parsedNotation)) !== null) {
    total += parseInt(matchMod[1], 10);
  }

  return { total, rawRolls };
}

export function useDiceEngine(activeSessionId, currentUser, setSessionData) {
  const diceBoxRef = useRef(null);
  const diceClearTimeoutRef = useRef(null);

  const [enable3DDice, setEnable3DDice] = useState(
    () => localStorage.getItem('disable3D') !== 'true'
  );
  const enable3DDiceRef = useRef(enable3DDice);

  useEffect(() => {
    enable3DDiceRef.current = enable3DDice;
    try {
      localStorage.setItem('disable3D', enable3DDice ? 'false' : 'true');
    } catch {}
  }, [enable3DDice]);

  useEffect(() => {
    const initDice = async () => {
      try {
        const diceBox = new DiceBox({
          container: '#dice-box-container',
          assetPath: '/assets/dice-box/',
          theme: 'default',
          themeColor: '#da1147',
          scale: 8,
          spinForce: 8,
          tossForce: 10,
          gravity: 2,
          startingHeight: 15,
          shadows: true,
        });
        await diceBox.init();
        diceBoxRef.current = diceBox;
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 500);
      } catch (e) {
        console.error('DiceBox init error', e);
      }
    };
    initDice();
  }, []);

  const rollDice = useCallback(
    async (notation, reason = '', returnObj = false) => {
      if (diceClearTimeoutRef.current) {
        clearTimeout(diceClearTimeoutRef.current);
      }

      if (rollSound) {
        try {
          rollSound.currentTime = 0;
          rollSound.volume = 0.5;
          rollSound.playbackRate = 0.9 + Math.random() * 0.2;
          rollSound.play().catch(() => {});
        } catch {}
      }

      let total = 0;
      let rawRolls = [];

      if (enable3DDiceRef.current && diceBoxRef.current) {
        try {
          const results = await diceBoxRef.current.roll(notation);

          if (results && results.length > 0) {
            total = results.reduce((acc, group) => acc + group.value, 0);
            results.forEach(group => {
              if (group.rolls) {
                group.rolls.forEach(die => rawRolls.push(die.value));
              }
            });
          } else if (Array.isArray(results)) {
            total = results.reduce((acc, die) => acc + die.value, 0);
            rawRolls = results.map(die => die.value);
          }

          diceClearTimeoutRef.current = setTimeout(() => {
            if (diceBoxRef.current) diceBoxRef.current.clear();
          }, 1500);
        } catch (err) {
          console.error('3D dice error, fallback to 2D:', err);
          const sim = simulateFallbackRoll(notation);
          total = sim.total;
          rawRolls = sim.rawRolls;
        }
      } else {
        const sim = simulateFallbackRoll(notation);
        total = sim.total;
        rawRolls = sim.rawRolls;
      }

      const logEntry = {
        id: generateId(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        roller: currentUser?.username || 'Игрок',
        notation: reason || 'Бросок кубиков',
        rolls: notation,
        total,
      };

      setSessionData(prev => {
        const updatedLog = [logEntry, ...(prev.diceLog || [])].slice(0, 50);
        if (activeSessionId) {
          socket.emit('update_session', {
            sessionId: activeSessionId,
            updates: { diceLog: updatedLog },
          });
        }
        return { ...prev, diceLog: updatedLog };
      });

      if (returnObj) {
        return { total, rawRolls };
      }
      return total;
    },
    [activeSessionId, currentUser, setSessionData]
  );

  return {
    rollDice,
    enable3DDice,
    setEnable3DDice,
  };
}
