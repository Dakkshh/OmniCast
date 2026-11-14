import { useEffect, useState } from 'react';

type Session = { status: string; mission: string; studySeconds: number; pageDecision: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const next = await browser.runtime.sendMessage({ type: 'GET_WIDGET_STATE' }) as Session;
        if (active) setSession(next);
      } catch { if (active) setSession(null); }
    }
    if (document.visibilityState === 'visible') void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 2000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);

  if (!session || session.status === 'IDLE') return null;
  const time = `${String(Math.floor(session.studySeconds / 60)).padStart(2, '0')}:${String(session.studySeconds % 60).padStart(2, '0')}`;
  const label = session.status === 'BREAK' ? 'Break' : session.pageDecision === 'distracting' ? 'Ready to return?' : session.pageDecision === 'study' ? 'Study page' : 'Unknown page';

  return <div className="pill" role="status">
    {minimized ? <button aria-label="Expand Study Buddy" onClick={() => setMinimized(false)}>▣</button> : <>
      <span className="dot" />
      <span className="task" title={session.mission}>{session.mission}</span>
      <span className="timer">{time}</span>
      <span>{label}</span>
      <button aria-label="Minimize Study Buddy" onClick={() => setMinimized(true)}>–</button>
    </>}
  </div>;
}
