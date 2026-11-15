import { useEffect, useState } from 'react';

export function useStoredState(key, initial) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    // load the saved value when the pill appears
    browser.storage.local.get(key).then((res) => {
      if (res[key] !== undefined) setValue(res[key]);
    });
    // stay in sync when another tab changes it
    const listener = (changes, area) => {
      if (area === 'local' && key in changes) setValue(changes[key].newValue);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, [key]);

  function update(next) {
    setValue((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      browser.storage.local.set({ [key]: v });
      return v;
    });
  }

  return [value, update];
}