import { useEffect, useState } from 'react';

type Tab = { id: number; title: string; domain: string; url: string };
type State = {
  view: string; status: string; mission: string; target: string; duration: number; studyTab: number | null;
  studyUrl: string; tabs: Tab[]; currentTab: Tab | null; pageDecision: string; decisionReason: string;
  studySeconds: number; currentOffTaskSeconds: number; recoverySeconds: number; graceDeadline: number | null;
  lastNudgeAt: number | null; snoozedUntil: number; pauseDismissed: boolean; pauseDelivery: string;
  successfulReturns: number; distractionEpisodes: number; completedTaskCount: number; checkpointCount: number;
  xp: number; browserFocused: boolean; demoMode: boolean; aiEnabled: boolean; aiUnavailable: boolean;
  alwaysAllow: string[]; alwaysPause: string[]; studyTabClosed: boolean; error?: string;
};

const format = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const names: Record<string, string> = { study: 'Study page', distracting: 'Unrelated page', unknown: 'Unknown page', analyzing: 'Checking page' };
const domains = (value: string) => [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean))];

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(type: string, patch?: Record<string, unknown>) {
    if (type !== 'GET_STATE') setBusy(true);
    try {
      const next = await browser.runtime.sendMessage({ type, patch }) as State;
      if (next?.error) setError(next.error);
      else { setError(''); setState(next); }
    } catch (cause) { setError(String(cause)); }
    finally { if (type !== 'GET_STATE') setBusy(false); }
  }

  useEffect(() => {
    void send('GET_STATE');
    const timer = setInterval(() => { void send('GET_STATE'); }, 1000);
    const changed = (changes: Record<string, { newValue?: unknown }>) => {
      const value = changes.studyBuddyState?.newValue as Partial<State> | undefined;
      if (value) setState(current => ({ ...current, ...value } as State));
    };
    browser.storage.onChanged.addListener(changed);
    return () => { clearInterval(timer); browser.storage.onChanged.removeListener(changed); };
  }, []);

  if (!state) return <main className="shell"><p>Opening Study Buddy…</p>{error && <p role="alert">{error}</p>}</main>;
  const active = state.view === 'active';
  const distracting = state.pageDecision === 'distracting';
  const checkpointLeft = Math.max(0, (state.demoMode ? 10 : 120) - state.recoverySeconds);
  const graceAt = Math.max(state.graceDeadline || 0, (state.lastNudgeAt || 0) + (state.demoMode ? 10_000 : 120_000));
  const graceLeft = Math.max(0, Math.ceil((graceAt - Date.now()) / 1000));
  const patch = (value: Record<string, unknown>) => {
    setState(current => current ? { ...current, ...value } as State : current);
    void send('UPDATE_SETUP', value);
  };

  return <main className="shell">
    <header><span className="logo">▣</span><strong>study<span>buddy.</span></strong><small>{state.status === 'BREAK' ? 'BREAK' : active ? 'SESSION ON' : 'READY'}</small></header>
    {state.view === 'setup' && <div className="stack">
      <h1>Set your study goal.</h1><p>Pick a page to return to when you drift.</p>
      <label>Mission<input value={state.mission} maxLength={100} placeholder="Finish 3 calculus problems" onChange={event => patch({ mission: event.target.value })} /></label>
      <label>Study tab<select value={state.studyTab ?? ''} onChange={event => patch({ studyTab: Number(event.target.value) })}>
        <option value="">Choose an open tab</option>{state.tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.title} · {tab.domain}</option>)}
      </select></label>
      <div className="row"><label>Minutes<input type="number" min="1" max="240" value={state.duration} onChange={event => patch({ duration: Number(event.target.value) })} /></label><label>Tasks<input type="number" min="1" max="99" value={state.target ?? ''} placeholder="Optional" onChange={event => patch({ target: event.target.value })} /></label></div>
      <details><summary>Site rules</summary><label>Study sites<input defaultValue={state.alwaysAllow.join(', ')} onBlur={event => patch({ alwaysAllow: domains(event.target.value) })} placeholder="khanacademy.org" /></label><label>Pause sites<input defaultValue={state.alwaysPause.join(', ')} onBlur={event => patch({ alwaysPause: domains(event.target.value) })} placeholder="reddit.com" /></label><p>Separate domains with commas.</p></details>
      <label className="check"><input type="checkbox" checked={state.demoMode} onChange={event => patch({ demoMode: event.target.checked })} /> Demo mode · 5s pause</label>
      <label className="check"><input type="checkbox" checked={state.aiEnabled} onChange={event => patch({ aiEnabled: event.target.checked })} /> Check pages with AI (optional)</label>
      <button className="primary" disabled={busy || !state.mission.trim() || !state.studyTab} onClick={() => void send('START_SESSION')}>Start studying →</button>
    </div>}

    {active && <div className="stack">
      {state.demoMode && <div className="banner">DEMO MODE · SHORT TIMERS</div>}
      <section className="card"><small>YOUR MISSION</small><h1>{state.mission}</h1><div className="row stats"><div><strong>{format(state.studySeconds)}</strong><span>Study-tab time</span></div><div><strong>{state.xp}</strong><span>XP earned</span></div></div></section>
      {state.status === 'BREAK' ? <section className="card yellow"><h2>Break time.</h2><p>No stress. We’ll be here.</p><button onClick={() => void send('BREAK_RESUME')}>Resume study</button></section> : <>
        <section className="card"><small>ACTIVE CHROME TAB</small><h2>{state.currentTab?.title || 'No webpage open'}</h2><p className="pill">{names[state.pageDecision] || 'Unknown page'}</p><p>{state.decisionReason}</p>{distracting && <p>Time here: {format(state.currentOffTaskSeconds)}</p>}
          {state.pauseDelivery === 'failed' && <p role="alert">Couldn’t pause this tab. Reload its page.</p>}
          {state.pageDecision === 'unknown' && state.currentTab?.url && <div className="row"><button onClick={() => void send('ALLOW_CURRENT')}>This is for studying</button><button onClick={() => void send('PAUSE_CURRENT')}>Pause this page</button></div>}
          {state.pageDecision === 'study' && state.currentTab?.url && state.currentTab.url !== state.studyUrl && <button onClick={() => void send('PAUSE_CURRENT')}>Pause this page</button>}
        </section>
        {distracting && !state.pauseDismissed && <section className="card yellow"><small>BACK TO YOUR MISSION</small><h2>{state.status === 'GRACE_PERIOD' && graceLeft > 0 ? `A moment to choose · ${format(graceLeft)}` : 'Ready to pick up where you left off?'}</h2><button className="primary recovery" onClick={() => void send('RETURN_TO_STUDY')}>{state.studyTabClosed ? 'Reopen study page' : 'Return to Study →'}</button><div className="row"><button onClick={() => void send('BREAK_START')}>Take a break</button><button onClick={() => void send('SNOOZE_PAUSE')}>Snooze 5 min</button><button onClick={() => void send('DISMISS_PAUSE')}>Dismiss</button></div><button className="link" onClick={() => void send('ALLOW_CURRENT')}>This is for studying</button></section>}
        {distracting && state.pauseDismissed && <section className="card"><p>Pause dismissed for this page.</p><button onClick={() => void send('RETURN_TO_STUDY')}>Return to Study →</button></section>}
        {state.status === 'RECOVERING' && <section className="card yellow"><small>TINY NEXT STEP</small><h2>Work on one problem.</h2><p>{format(checkpointLeft)} left on a study tab</p><button disabled={checkpointLeft > 0 || !state.browserFocused || state.pageDecision !== 'study'} onClick={() => void send('CHECKPOINT_CONFIRMED')}>Mark checkpoint done · +25 XP</button></section>}
        <div className="row"><button onClick={() => void send('BREAK_START')}>Take a break</button><button onClick={() => void send('TASK_CONFIRMED')}>Task done · +10 XP</button></div>
      </>}
      <p>{state.completedTaskCount} tasks · {state.successfulReturns} returns · {state.distractionEpisodes} unrelated visits</p>
      <button className="link" onClick={() => void send('END_SESSION')}>End session</button>
      {state.aiEnabled && state.aiUnavailable && <p>AI unavailable · local rules active</p>}
    </div>}

    {state.view === 'summary' && <div className="stack"><h1>You showed up.</h1><p>Every return counts.</p><section className="card"><h2>{state.mission}</h2><div className="row stats"><div><strong>{format(state.studySeconds)}</strong><span>Study-tab time</span></div><div><strong>{state.successfulReturns}</strong><span>Returns</span></div><div><strong>{state.checkpointCount}</strong><span>Checkpoints</span></div><div><strong>{state.xp}</strong><span>XP</span></div></div><p>{state.distractionEpisodes} unrelated-page visits · {state.completedTaskCount} tasks confirmed</p></section><button className="primary" onClick={() => void send('NEW_SESSION')}>Start another session</button>{state.studyUrl && <button className="link" onClick={() => void send('CLEAR_STUDY_PAGE')}>Clear saved study page</button>}</div>}
    {error && <p role="alert" className="error">{error}</p>}
  </main>;
}
