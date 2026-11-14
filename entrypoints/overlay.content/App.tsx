import { useEffect, useState } from 'react';

export default function App() {
  const [seconds, setSeconds] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [verdict, setVerdict] = useState<{ onTask: boolean; nudge: string } | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="pill">
      {minimized ?
        <>
          <button className="pill small" onClick={() => setMinimized(false)}>🎯</button>
        </> :
        <>
          <span className="dot" />
          <span className="task">Read chapter 4</span>
          <span className="timer">{mm}:{ss}</span>
          <button onClick={() => setMinimized(true)}>–</button>
          {/* <button onClick={takeShot}>📸</button> */}
          {verdict && <span>{verdict.onTask ? '✅ on task' : `❌ ${verdict.nudge}`}</span>}
        </>
      }
    </div>
  );
}