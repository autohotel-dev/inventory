import { useState, useEffect } from 'react';

export function useLowPowerMode() {
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount
    const saved = localStorage.getItem('pos_low_power_mode');
    if (saved) {
      setIsLowPowerMode(saved === 'true');
    }
  }, []);

  const toggleLowPowerMode = () => {
    setIsLowPowerMode(prev => {
      const next = !prev;
      localStorage.setItem('pos_low_power_mode', String(next));
      return next;
    });
  };

  return { isLowPowerMode, toggleLowPowerMode };
}
