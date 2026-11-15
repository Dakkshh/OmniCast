import ExpandIcon from '../../assets/expand.png'
import OkayIcon from '../../assets/okay.webp'
import AlertIcon from '../../assets/alert.png'
import './Pill.css'
import TaskEditor from './TaskEditor'
import TaskList from './TaskList'
import { useEffect, useState } from 'react';
import { useStoredState } from './useStoredState';

export default function Pill() {
  // per-tab UI state
  const [minimized, setMinimized] = useState(true);
  const [verdict, setVerdict] = useState(null);
  const [settingUp, setSettingUp] = useState(false);

  // shared session state (synced across all tabs via browser.storage)
  const [tasks, setTasks] = useStoredState('tasks', []);
  const [currentIndex, setCurrentIndex] = useStoredState('currentIndex', -1); // -1 = not started
  const [finished, setFinished] = useStoredState('finished', false);
  const [paused, setPaused] = useStoredState('paused', false);
  const [endsAt, setEndsAt] = useStoredState('endsAt', 0);          // timestamp when current task ends
  const [pausedLeft, setPausedLeft] = useStoredState('pausedLeft', 0); // ms left when paused

  // local clock: re-render every second
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const started = currentIndex >= 0 && !finished;
  const running = started && !paused;
  const secondsLeft = running ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : started ? Math.ceil(pausedLeft / 1000)
      : 0;

  const currentTask = finished ? 'Session complete 🎉'
    : started ? (tasks[currentIndex]?.task ?? '')
      : 'Not started';

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  function start() {
    if (tasks.length === 0) return;
    setFinished(false);
    setPaused(false);
    setCurrentIndex(0);
    setEndsAt(Date.now() + Number(tasks[0].minutes) * 60000);
  }

  function togglePause() {
    if (!started) return;
    if (paused) {
      setEndsAt(Date.now() + pausedLeft);   // resume: push the end time forward
      setPaused(false);
    } else {
      setPausedLeft(endsAt - Date.now());   // pause: remember what's left
      setPaused(true);
    }
  }

  function resetSession() {
    setCurrentIndex(-1);
    setFinished(false);
    setPaused(false);
  }

  async function takeShot() {
    const res = await browser.runtime.sendMessage({ type: 'SCREENSHOT', task: currentTask });
    if (res?.error) console.error(res.error);
    else setVerdict(res?.result ?? null);
  }

  // when the current task's time runs out → next task, or finish
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    const next = currentIndex + 1;
    if (next < tasks.length) {
      setCurrentIndex(next);
      setEndsAt(Date.now() + Number(tasks[next].minutes) * 60000);
    } else {
      setFinished(true);
    }
  }, [secondsLeft, running, currentIndex, tasks]);

  // focus check every 15s while running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => takeShot(), 15000);
    return () => clearInterval(id);
  }, [running, currentTask]);

  return (
    <>
      {minimized ?
        <div className="minimized-pill">
          {running ? <><span className="dot" />LIVE</> : <><span className="yellow-dot" />STOPPED</>}
          <span className="task">{currentTask}</span>
          <span className="timer">{mm}:{ss}</span>
          <img onClick={() => setMinimized(false)} src={ExpandIcon} className="maximize-icon" />
          {verdict && (verdict.onTask ? <img src={OkayIcon} className="verdict-icon" /> : <img src={AlertIcon} className="verdict-icon" />)}
        </div> :
        <div className="maximized-pill">
          <img onClick={() => setMinimized(true)} src={ExpandIcon} className="minimize-icon" />
          <div className="live-text">
            {running ? <><div className="big-dot" /><span className="live">LIVE</span></> : <><div className="big-yellow-dot" /><span className="live">STOPPED</span></>}
          </div>
          <div className="big-timer">{mm}:{ss}</div>
          {verdict && (
            <span className="verdict">{verdict.onTask ? "✅ You're on task! Keep it up!" : `❌ ${verdict.nudge}`}</span>
          )}
          <div className="current-tasks">Current tasks</div>
          {settingUp
            ? <TaskEditor tasks={tasks} setTasks={setTasks} setSettingUp={setSettingUp} resetSession={resetSession} />
            : <TaskList tasks={tasks} setSettingUp={setSettingUp}
              currentIndex={currentIndex} finished={finished}
              started={started} paused={paused} onTogglePause={togglePause}
              onStart={start} resetSession={resetSession} />}
        </div>
      }
    </>
  );
}