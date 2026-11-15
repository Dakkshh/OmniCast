
import ExpandIcon from '../../assets/expand.png';
import OkayIcon from '../../assets/okay.webp';
import AlertIcon from '../../assets/alert.png';

import './Pill.css';

import TaskEditor from './TaskEditor';
import TaskList from './TaskList';

import { useEffect, useRef, useState } from 'react';
import { useStoredState } from './useStoredState';

export default function Pill() {
  // ==========================================
  // LOCAL UI STATE
  // ==========================================

  const [minimized, setMinimized] = useState(true);
  const [verdict, setVerdict] = useState(null);
  const [settingUp, setSettingUp] = useState(false);

  // Prevent overlapping screenshot requests.
  const screenshotInProgress = useRef(false);

  // ==========================================
  // SHARED EXTENSION STATE
  // ==========================================

  const [tasks, setTasks] = useStoredState('tasks', []);
  const [currentIndex, setCurrentIndex] = useStoredState('currentIndex', -1);
  const [finished, setFinished] = useStoredState('finished', false);
  const [paused, setPaused] = useStoredState('paused', false);
  const [endsAt, setEndsAt] = useStoredState('endsAt', 0);
  const [pausedLeft, setPausedLeft] = useStoredState('pausedLeft', 0);

  // AI focus statistics.
  const [focuses, setFocuses] = useStoredState('focuses', 0);
  const [distracts, setDistracts] = useStoredState('distracts', 0);

  // ==========================================
  // TIMER
  // ==========================================

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const started = currentIndex >= 0 && !finished;
  const running = started && !paused;

  const secondsLeft = running
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : started
      ? Math.max(0, Math.ceil(pausedLeft / 1000))
      : 0;

  const currentTask = finished
    ? 'Session complete 🎉'
    : started
      ? (tasks[currentIndex]?.task ?? '')
      : 'Not started';

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const totalChecks = focuses + distracts;

  const focusScore = totalChecks > 0
    ? ((focuses / totalChecks) * 100).toFixed(2)
    : 'N/A';

  // ==========================================
  // SESSION CONTROLS
  // ==========================================

  function start() {
    if (tasks.length === 0) return;

    const minutes = Number(tasks[0].minutes);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      console.error('Invalid study task duration.');
      return;
    }

    setFinished(false);
    setPaused(false);
    setCurrentIndex(0);

    setEndsAt(Date.now() + minutes * 60000);
    setPausedLeft(minutes * 60000);

    // Start with fresh statistics.
    setFocuses(0);
    setDistracts(0);
    setVerdict(null);
  }

  function togglePause() {
    if (!started) return;

    if (paused) {
      // Resume the countdown.
      setEndsAt(Date.now() + pausedLeft);
      setPaused(false);
    } else {
      // Save the remaining time.
      setPausedLeft(Math.max(0, endsAt - Date.now()));
      setPaused(true);
    }
  }

  function resetSession() {
    setCurrentIndex(-1);
    setFinished(false);
    setPaused(false);
    setEndsAt(0);
    setPausedLeft(0);
    setVerdict(null);
  }

  // ==========================================
  // AI SCREENSHOT AND FOCUS DETECTION
  // ==========================================

  async function takeShot() {
    // Only analyze an active study session
    // in the currently focused browser tab.
    if (
      !running ||
      secondsLeft <= 0 ||
      document.visibilityState !== 'visible' ||
      !document.hasFocus() ||
      screenshotInProgress.current
    ) {
      return;
    }

    screenshotInProgress.current = true;

    // Remember which task the screenshot belongs to.
    const capturedTask = currentTask;
    const capturedIndex = currentIndex;
    const capturedEndsAt = endsAt;

    try {
      const res = await browser.runtime.sendMessage({
        type: 'SCREENSHOT',
        task: capturedTask,
      });

      if (res?.error) {
        console.error('Focus check failed:', res.error);
        return;
      }

      const result = res?.result;

      if (typeof result?.onTask !== 'boolean') {
        console.warn(
          'AI returned an invalid classification:',
          result
        );
        return;
      }

      // Ignore results from an old or paused session.
      const latestSession = await browser.storage.local.get([
        'currentIndex',
        'finished',
        'paused',
        'endsAt',
      ]);

      if (
        latestSession.finished ||
        latestSession.paused ||
        latestSession.currentIndex !== capturedIndex ||
        latestSession.endsAt !== capturedEndsAt ||
        Date.now() >= Number(latestSession.endsAt || 0)
      ) {
        return;
      }

      // ======================================
      // UPDATE EXTENSION FEEDBACK
      // ======================================

      setVerdict(result);

      if (result.onTask) {
        setFocuses((previous) => previous + 1);
      } else {
        setDistracts((previous) => previous + 1);
      }

      // ======================================
      // SEND AI RESULT TO THE WEBSITE
      // ======================================

      await browser.storage.local.set({
        studyBuddyFocusEvent: {
          id: crypto.randomUUID(),
          focused: result.onTask,
          nudge: result.nudge || '',
          task: capturedTask,
          timestamp: Date.now(),
        },
      });

      console.log(
        'Study Buddy focus result:',
        result.onTask ? 'Focused' : 'Distracted'
      );

    } catch (error) {
      console.error(
        'AI focus monitoring error:',
        error
      );
    } finally {
      screenshotInProgress.current = false;
    }
  }

  // ==========================================
  // AUTOMATIC TASK PROGRESSION
  // ==========================================

  useEffect(() => {
    if (!running || secondsLeft > 0) return;

    const next = currentIndex + 1;

    if (next < tasks.length) {
      const nextMinutes = Number(tasks[next].minutes);

      if (!Number.isFinite(nextMinutes) || nextMinutes <= 0) {
        setFinished(true);
        return;
      }

      setCurrentIndex(next);
      setEndsAt(Date.now() + nextMinutes * 60000);
      setPausedLeft(nextMinutes * 60000);
      setVerdict(null);
    } else {
      setFinished(true);
    }
  }, [secondsLeft, running, currentIndex, tasks]);

  // ==========================================
  // FOCUS CHECK EVERY 15 SECONDS
  // ==========================================

  useEffect(() => {
    if (!running) return;

    const checkId = setInterval(() => {
      void takeShot();
    }, 15000);

    return () => clearInterval(checkId);
  }, [running, currentTask, currentIndex, endsAt]);

  // ==========================================
  // EXTENSION USER INTERFACE
  // ==========================================

  return (
    <>
      {minimized ? (
        <div className="minimized-pill">
          {running ? (
            <>
              <span className="dot" />
              LIVE
            </>
          ) : (
            <>
              <span className="yellow-dot" />
              STOPPED
            </>
          )}

          <span className="task">
            {currentTask}
          </span>

          <span className="timer">
            {mm}:{ss}
          </span>

          <img
            onClick={() => setMinimized(false)}
            src={ExpandIcon}
            className="maximize-icon"
            alt="Expand Study Buddy"
          />

          {verdict && (
            <img
              src={verdict.onTask ? OkayIcon : AlertIcon}
              className="verdict-icon"
              alt={verdict.onTask ? 'Focused' : 'Distracted'}
            />
          )}
        </div>
      ) : (
        <div className="maximized-pill">
          <img
            onClick={() => setMinimized(true)}
            src={ExpandIcon}
            className="minimize-icon"
            alt="Minimize Study Buddy"
          />

          <div className="live-text">
            {running ? (
              <>
                <div className="big-dot" />
                <span className="live">LIVE</span>
              </>
            ) : (
              <>
                <div className="big-yellow-dot" />
                <span className="live">STOPPED</span>
              </>
            )}
          </div>

          <div className="big-timer">
            {mm}:{ss}
          </div>

          {/* Live AI feedback */}
          {verdict && !finished && (
            <span className="verdict">
              {verdict.onTask
                ? "✅ You're on task! Keep it up!"
                : `❌ ${verdict.nudge || 'Return to your study task.'}`}
            </span>
          )}

          {/* Completed session statistics */}
          {finished && (
            <div className="session-stats">
              <div>Session complete 🎉</div>

              <div>
                ✅ Focused checks: {focuses}
              </div>

              <div>
                ❌ Distracted checks: {distracts}
              </div>

              <div>
                Focus score: {focusScore}
                {totalChecks > 0 ? '%' : ''}
              </div>
            </div>
          )}

          <div className="current-tasks">
            Current tasks
          </div>

          {settingUp ? (
            <TaskEditor
              tasks={tasks}
              setTasks={setTasks}
              setSettingUp={setSettingUp}
              resetSession={resetSession}
            />
          ) : (
            <TaskList
              tasks={tasks}
              setSettingUp={setSettingUp}
              currentIndex={currentIndex}
              finished={finished}
              started={started}
              paused={paused}
              onTogglePause={togglePause}
              onStart={start}
              resetSession={resetSession}
            />
          )}
        </div>
      )}
    </>
  );
}
