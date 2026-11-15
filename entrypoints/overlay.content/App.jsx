import Pill from './Pill';
import { useEffect, useState } from 'react';

export default function App() {
  const [seconds, setSeconds] = useState(0);
  const [minimized, setMinimized] = useState(true);
  const [task, setTask] = useState(true);
  const [verdict, setVerdict] = useState(null);

  async function takeShot() {
    const res = await browser.runtime.sendMessage({ type: 'SCREENSHOT', task: 'Study calculus' });
    if (res.error) console.error(res.error);
    else setVerdict(res.result);
  }

  useEffect(() => {
    const timerId = setInterval(() => setSeconds((s) => s + 1), 1000);
    const checkId = setInterval(() => takeShot(), 15000);
    return () => {
      clearInterval(timerId);
      clearInterval(checkId);
    }
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <Pill seconds={seconds} minimized={minimized} setMinimized={setMinimized} verdict={verdict} />
  );
}