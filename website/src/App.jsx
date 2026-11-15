import { useEffect, useRef, useState } from "react";
import CameraRecorder from "./CameraRecorder";
import { sendExtensionCommand } from "./extensionBridge";
import "./App.css";

const STORAGE_KEY = "studyBuddyData";
const DURATIONS = [1, 25, 45, 60];

function Icon({ name, size = 20, strokeWidth = 1.9 }) {
  const paths = {
    sparkle: <><path d="m12 3 1.85 5.65L19.5 10.5l-5.65 1.85L12 18l-1.85-5.65L4.5 10.5l5.65-1.85L12 3Z"/><path d="m19.5 17 .7 2.1L22.3 19.8l-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/></>,
    chart: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 16v-4m4 4V8m4 8v-6"/></>,
    book: <><path d="M12 7a5 5 0 0 0-8-2v13a5 5 0 0 1 8 2 5 5 0 0 1 8-2V5a5 5 0 0 0-8 2Z"/><path d="M12 7v13"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6m-3 3V2"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    play: <path d="m8 5 11 7-11 7V5Z"/>,
    pause: <><path d="M9 5v14m6-14v14"/></>,
    reset: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/></>,
    camera: <><path d="M14 5H8L6 8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-4l-2-3Z"/><circle cx="12" cy="14" r="3.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    trending: <><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
    circle: <circle cx="12" cy="12" r="9"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name] ?? paths.circle}
    </svg>
  );
}

function getSavedData() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function formatTime(seconds) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatDate(date) {
  try {
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function App() {
  const [savedData] = useState(getSavedData);
  const [page, setPage] = useState("dashboard");
  const [subject, setSubject] = useState(savedData.subject ?? "");
  const [goal, setGoal] = useState(savedData.goal ?? "");
  const [duration, setDuration] = useState(savedData.duration ?? 25);
  const [timeLeft, setTimeLeft] = useState((savedData.duration ?? 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const deadlineRef = useRef(null);
  const cameraRef = useRef(null);
  const lastFocusEventIdRef = useRef(null);
  const extensionEnabledRef = useRef(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraWarning, setCameraWarning] = useState("");

  const [completedSessions, setCompletedSessions] = useState(savedData.completedSessions ?? 0);
  const [totalMinutes, setTotalMinutes] = useState(savedData.totalMinutes ?? 0);
  const [sessionHistory, setSessionHistory] = useState(savedData.sessionHistory ?? []);
  const [focusStatus, setFocusStatus] = useState("Not monitoring");
  const [distractions, setDistractions] = useState(savedData.distractions ?? 0);
  const [focusedChecks, setFocusedChecks] = useState(savedData.focusedChecks ?? 0);
  const [totalChecks, setTotalChecks] = useState(savedData.totalChecks ?? 0);
  const [focusHistory, setFocusHistory] = useState(savedData.focusHistory ?? []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        subject, goal, duration, completedSessions, totalMinutes,
        sessionHistory, distractions, focusedChecks, totalChecks, focusHistory,
      }));
    } catch {
      // Storage might be disabled or full; study sessions still work in memory.
    }
  }, [subject, goal, duration, completedSessions, totalMinutes, sessionHistory,
    distractions, focusedChecks, totalChecks, focusHistory]);

  // The deadline-based timer remains accurate when mobile browsers throttle background tabs.
  useEffect(() => {
    if (!isRunning) return undefined;
    const tick = () => {
      if (deadlineRef.current !== null) {
        setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }
    };
    const intervalId = window.setInterval(tick, 400);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    tick();
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [isRunning]);

  useEffect(() => {
    if (timeLeft !== 0 || !isRunning) return undefined;
    const timeoutId = window.setTimeout(() => {
      const session = {
        id: crypto.randomUUID(),
        subject: subject.trim() || "General study",
        goal: goal.trim() || "No goal specified",
        duration,
        completedAt: new Date().toISOString(),
        distractions,
        focusScore: totalChecks ? Math.round((focusedChecks / totalChecks) * 100) : null,
      };
      setSessionHistory(previous => [session, ...previous]);
      setCompletedSessions(previous => previous + 1);
      setTotalMinutes(previous => previous + duration);
      deadlineRef.current = null;
      cameraRef.current?.stop();
      if (extensionEnabledRef.current) {
        extensionEnabledRef.current = false;
        sendExtensionCommand("STOP").catch(console.error);
      }
      setIsRunning(false);
      setFocusStatus("Not monitoring");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [timeLeft, isRunning, subject, goal, duration, distractions, focusedChecks, totalChecks]);

  function resetChecks() {
    setFocusStatus("Not monitoring");
    setDistractions(0);
    setFocusedChecks(0);
    setTotalChecks(0);
    setFocusHistory([]);
  }

  function selectDuration(minutes) {
    if (isRunning || cameraStarting) return;
    deadlineRef.current = null;
    setDuration(minutes);
    setTimeLeft(minutes * 60);
    resetChecks();
  }

  function resetTimer() {
  cameraRef.current?.stop();

  if (extensionEnabledRef.current) {
    extensionEnabledRef.current = false;
    sendExtensionCommand("STOP").catch(console.error);
  }

  deadlineRef.current = null;
  setIsRunning(false);
  setTimeLeft(duration * 60);
  resetChecks();
}

  
async function toggleTimer() {
  if (cameraStarting) return;

  // PAUSE
  if (isRunning) {
    setTimeLeft(
      Math.max(
        0,
        Math.ceil(
          ((deadlineRef.current ?? Date.now()) - Date.now()) / 1000
        )
      )
    );

    deadlineRef.current = null;
    cameraRef.current?.pause();
    setIsRunning(false);
    setFocusStatus("Not monitoring");

    if (extensionEnabledRef.current) {
      sendExtensionCommand("PAUSE").catch(console.error);
    }
    return;
  }

  if (timeLeft <= 0) return;

  setCameraWarning("");

  // RESUME
  if (cameraRef.current?.isPaused()) {
    cameraRef.current.resume();

    if (extensionEnabledRef.current) {
      sendExtensionCommand("RESUME").catch(console.error);
    }
  } else {
    // NEW STUDY SESSION
    const enableMonitoring = window.confirm(
      "Enable Chrome extension focus monitoring?\n\n" +
      "The extension may capture browser screenshots and send " +
      "them to Claude AI for analysis. Starting from the website " +
      "will replace the extension's existing task list.\n\n" +
      "Click OK to enable monitoring or Cancel for camera-only studying."
    );

    setCameraStarting(true);
    const result = await cameraRef.current?.start();
    setCameraStarting(false);

    if (!result?.ok) {
      setCameraWarning(
        result?.message || "Could not start the camera."
      );
      return;
    }

    extensionEnabledRef.current = false;

    if (enableMonitoring) {
      try {
        await sendExtensionCommand("START", {
          minutes: duration,
          task: goal.trim() || subject.trim() || "Study session",
        });

        extensionEnabledRef.current = true;
        console.log("Extension monitoring started.");
      } catch (error) {
        console.error("Extension connection error:", error);
        window.alert(
          "The study timer will run, but extension monitoring could not start."
        );
      }
    }
  }

  deadlineRef.current = Date.now() + timeLeft * 1000;
  setIsRunning(true);
  setFocusStatus("Not monitoring");
}

  function recordCheck(status) {
    if (!isRunning) return;
    setFocusStatus(status);
    setTotalChecks(previous => previous + 1);
    if (status === "Focused") setFocusedChecks(previous => previous + 1);
    else setDistractions(previous => previous + 1);
    setFocusHistory(previous => [
      { id: crypto.randomUUID(), status, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) },
      ...previous,
    ]);
  }

useEffect(() => {
  function handleFocusResult(event) {
    if (
      event.source !== window ||
      event.origin !== window.location.origin
    ) {
      return;
    }

    const message = event.data;

    if (
      message?.source !== "study-buddy-extension" ||
      message?.type !== "FOCUS_RESULT"
    ) {
      return;
    }

    // Count results only during an active monitored session.
    if (!isRunning || !extensionEnabledRef.current) return;

    const result = message.result;

    if (
      typeof result?.id !== "string" ||
      typeof result?.focused !== "boolean" ||
      lastFocusEventIdRef.current === result.id
    ) {
      return;
    }

    lastFocusEventIdRef.current = result.id;

    const status = result.focused
      ? "Focused"
      : "Distracted";

    // Update the website's existing focus statistics.
    recordCheck(status);

    console.log("AI Focus Check:", status);
  }

  window.addEventListener("message", handleFocusResult);

  return () => {
    window.removeEventListener("message", handleFocusResult);
  };
}, [isRunning]);


  function changePage(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const focusScore = totalChecks > 0 ? Math.round((focusedChecks / totalChecks) * 100) : null;
  const timerProgress = Math.max(0, Math.min(100, (1 - timeLeft / (duration * 60 || 1)) * 100));
  const currentSubject = subject.trim() || "Your next study session";

  return (
    <div className="sb-app">
      <header className="sb-site-header">
        <div className="sb-header-inner">
          <div className="sb-brand" aria-label="Study Buddy home">
            <span className="sb-brand-mark"><Icon name="sparkle" size={21} /></span>
            <div className="sb-brand-copy">
              <h1>Study Buddy<span className="sb-brand-dot">.</span></h1>
              <p>A little more focus, every day.</p>
            </div>
          </div>
          <div className="sb-head-tools">
            <span className="sb-live-chip"><span className={isRunning ? "sb-pulse-dot is-active" : "sb-pulse-dot"} />{isRunning ? "Session in progress" : "Your focus space"}</span>
          </div>
        </div>
      </header>

      <div className="sb-nav-wrap">
        <nav className="sb-nav" aria-label="Main navigation">
          <button type="button" className={page === "dashboard" ? "sb-nav-item is-active" : "sb-nav-item"} onClick={() => changePage("dashboard")} aria-current={page === "dashboard" ? "page" : undefined}>
            <Icon name="chart" size={19}/><span>Dashboard</span>
          </button>
          <button type="button" className={page === "study" ? "sb-nav-item is-active" : "sb-nav-item"} onClick={() => changePage("study")} aria-current={page === "study" ? "page" : undefined}>
            <Icon name="book" size={19}/><span>Study session</span>
          </button>
        </nav>
      </div>

      <div hidden={page !== "dashboard"}>
        <main className="sb-content" id="dashboard">
          <section className="sb-hero" aria-labelledby="sb-dashboard-heading">
            <div className="sb-hero-text">
              <p className="sb-eyebrow"><Icon name="sparkle" size={15}/> YOUR PERSONAL DASHBOARD</p>
              <h2 id="sb-dashboard-heading">Small steps. <span>Big progress.</span></h2>
              <p>See how you're doing, celebrate your wins, and get back to what matters.</p>
              <button type="button" className="sb-btn sb-btn-primary sb-hero-cta" onClick={() => changePage("study")}>Start studying <Icon name="arrow" size={17}/></button>
            </div>
            <div className="sb-hero-visual" aria-hidden="true">
              <div className="sb-orbit sb-orbit-one"/><div className="sb-orbit sb-orbit-two"/>
              <div className="sb-floating-icon"><Icon name="target" size={41} strokeWidth={1.5}/></div>
              <div className="sb-floating-label"><span className="sb-floating-dot"/> Stay in your zone</div>
            </div>
          </section>

          <section className="sb-section sb-stats-section" aria-labelledby="sb-stats-heading">
            <div className="sb-section-title">
              <div><p className="sb-eyebrow">THE BIG PICTURE</p><h3 id="sb-stats-heading">Your focus at a glance</h3></div>
              <span className="sb-section-pill">Current session</span>
            </div>
            <div className="sb-stats-grid">
              <div className="sb-stat-card sb-stat-focus">
                <div className="sb-stat-icon"><Icon name="check" size={21}/></div>
                <strong>{focusedChecks}</strong><span>Focused</span><small>Focus checks</small>
              </div>
              <div className="sb-stat-card sb-stat-distracted">
                <div className="sb-stat-icon"><Icon name="alert" size={21}/></div>
                <strong>{distractions}</strong><span>Distracted</span><small>Distraction checks</small>
              </div>
              <div className="sb-stat-card sb-stat-minutes">
                <div className="sb-stat-icon"><Icon name="clock" size={21}/></div>
                <strong>{totalMinutes}</strong><span>Minutes studied</span><small>Across sessions</small>
              </div>
              <div className="sb-stat-card sb-stat-sessions">
                <div className="sb-stat-icon"><Icon name="calendar" size={21}/></div>
                <strong>{completedSessions}</strong><span>Sessions done</span><small>Keep it going</small>
              </div>
            </div>
          </section>

          <div className="sb-overview-grid">
            <section className="sb-panel sb-score-panel" aria-labelledby="sb-focus-score-heading">
              <div className="sb-panel-heading"><div><p className="sb-eyebrow">FOCUS INSIGHTS</p><h3 id="sb-focus-score-heading">How's your focus?</h3></div><span className="sb-icon-bubble"><Icon name="activity" size={19}/></span></div>
              <div className="sb-score-content">
                <div className="sb-score-ring" style={{ "--sb-score": `${focusScore ?? 0}%` }} role="progressbar" aria-label="Focus score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={focusScore ?? 0}>
                  <div className="sb-score-center"><strong>{focusScore === null ? "—" : `${focusScore}%`}</strong><span>Focus score</span></div>
                </div>
                <div className="sb-score-description">
                  <strong>{focusScore === null ? "Ready when you are" : focusScore >= 70 ? "Looking good!" : "Every check helps"}</strong>
                  <p>{focusScore === null ? "Start a session and log some focus checks to see your score." : `${focusedChecks} focused checks out of ${totalChecks} total checks this session.`}</p>
                  <div className="sb-mini-legend"><span><i className="sb-legend-focused"/>Focused</span><span><i className="sb-legend-distracted"/>Distracted</span></div>
                </div>
              </div>
              <p className="sb-disclaimer">Currently tracked with manual demo buttons, not camera AI.</p>
            </section>

            <section className="sb-panel sb-next-panel" aria-labelledby="sb-next-heading">
              <div className="sb-panel-heading"><div><p className="sb-eyebrow">UP NEXT</p><h3 id="sb-next-heading">Pick up where you left off</h3></div><span className="sb-icon-bubble"><Icon name="book" size={19}/></span></div>
              <p className="sb-next-kicker">CURRENT STUDY PLAN</p>
              <h4>{currentSubject}</h4>
              <p className="sb-next-goal">{goal.trim() || "Set a goal and make this time count."}</p>
              <div className="sb-next-bottom"><span><Icon name="timer" size={17}/>{duration} min focus block</span><button type="button" onClick={() => changePage("study")} className="sb-text-link">Open session <Icon name="chevron" size={18}/></button></div>
            </section>
          </div>

          <section className="sb-panel sb-history-panel" aria-labelledby="sb-history-heading">
            <div className="sb-panel-heading"><div><p className="sb-eyebrow">YOUR JOURNEY</p><h3 id="sb-history-heading">Recent study sessions</h3></div><span className="sb-section-pill">{sessionHistory.length} total</span></div>
            {sessionHistory.length === 0 ? (
              <div className="sb-empty"><span className="sb-empty-icon"><Icon name="calendar" size={26}/></span><strong>Your journey starts here.</strong><p>Complete your first session and it will appear here.</p><button type="button" className="sb-btn sb-btn-ghost" onClick={() => changePage("study")}>Let's begin <Icon name="arrow" size={16}/></button></div>
            ) : (
              <div className="sb-history-list">
                {sessionHistory.slice(0, 6).map(session => (
                  <article className="sb-history-row" key={session.id}>
                    <span className="sb-history-icon"><Icon name="book" size={20}/></span>
                    <div className="sb-history-main"><strong>{session.subject}</strong><p>{session.goal}</p><small>{formatDate(session.completedAt)}</small></div>
                    <div className="sb-history-meta"><strong>{session.duration} min</strong><span>{session.focusScore === null ? "No checks" : `${session.focusScore}% focus`}</span></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
      <div hidden={page !== "study"}>
        <main className="sb-content" id="study">
          <section className="sb-study-hero">
            <div><p className="sb-eyebrow"><Icon name="sparkle" size={15}/> TIME TO LOCK IN</p><h2>Make this session count<span>.</span></h2><p>Set a goal, find your rhythm, and focus on one thing at a time.</p></div>
            <span className={isRunning ? "sb-session-badge is-running" : "sb-session-badge"}><span className="sb-pulse-dot"/> {isRunning ? "Session active" : "Ready to begin"}</span>
          </section>

          <div className="sb-study-grid">
            <div className="sb-study-left">
              <section className="sb-panel sb-plan-panel" aria-labelledby="sb-plan-heading">
                <div className="sb-panel-heading"><div><p className="sb-eyebrow">01 / GET READY</p><h3 id="sb-plan-heading">Your study plan</h3></div><span className="sb-icon-bubble"><Icon name="target" size={19}/></span></div>
                <label htmlFor="sb-subject">What are you studying?</label>
                <input id="sb-subject" value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g. Data Structures" disabled={isRunning || cameraStarting} maxLength={80}/>
                <label htmlFor="sb-goal">What's your goal?</label>
                <textarea id="sb-goal" value={goal} onChange={event => setGoal(event.target.value)} placeholder="e.g. Solve five practice problems" rows={3} disabled={isRunning || cameraStarting} maxLength={300}/>
                <div className="sb-duration-title">Choose your focus time</div>
                <div className="sb-duration-grid" role="group" aria-label="Session duration">
                  {DURATIONS.map(minutes => <button type="button" key={minutes} className={duration === minutes ? "sb-duration is-selected" : "sb-duration"} onClick={() => selectDuration(minutes)} disabled={isRunning || cameraStarting} aria-pressed={duration === minutes}>{minutes}<small>min</small></button>)}
                </div>
              </section>
              <section className="sb-panel sb-timer-panel" aria-labelledby="sb-timer-heading">
                <div className="sb-panel-heading"><div><p className="sb-eyebrow">02 / DEEP WORK</p><h3 id="sb-timer-heading">Focus timer</h3></div><span className="sb-icon-bubble"><Icon name="timer" size={19}/></span></div>
                <div className="sb-timer-face" style={{ "--sb-timer-progress": `${timerProgress}%` }}><div className="sb-timer-inside"><span className="sb-timer-caption">TIME REMAINING</span><div className="sb-timer-display" role="timer" aria-label="Time remaining">{formatTime(timeLeft)}</div><span className="sb-timer-state">{isRunning ? "● You're in focus mode" : timeLeft === 0 ? "✓ Session completed!" : "Ready when you are"}</span></div></div>
                {cameraWarning && <p className="sb-camera-error" role="alert">{cameraWarning}</p>}
                <div className="sb-timer-controls"><button type="button" className="sb-btn sb-btn-primary" onClick={toggleTimer} disabled={timeLeft === 0 || cameraStarting}><Icon name={isRunning ? "pause" : "play"} size={18}/>{cameraStarting ? "Connecting camera…" : isRunning ? "Pause session" : "Start / resume"}</button><button type="button" className="sb-btn sb-btn-secondary" onClick={resetTimer} disabled={cameraStarting}><Icon name="reset" size={18}/>Reset</button></div>
              </section>
            </div>
            <div className="sb-study-right">
              <CameraRecorder ref={cameraRef}/>
              <section className="sb-panel sb-monitor-panel" aria-labelledby="sb-monitor-heading">
                <div className="sb-panel-heading"><div><p className="sb-eyebrow">03 / CHECK IN</p><h3 id="sb-monitor-heading">Focus check-ins</h3></div><span className="sb-demo-pill">DEMO</span></div>
                <p className="sb-panel-description">Test focus tracking while you study. These buttons simulate detection until the browser extension is connected.</p>
                <div className="sb-current-status"><span>Current status</span><strong className={focusStatus === "Focused" ? "is-focused" : focusStatus === "Distracted" ? "is-distracted" : ""}>{focusStatus}</strong></div>
                <div className="sb-check-buttons"><button type="button" className="sb-check-btn sb-check-positive" onClick={() => recordCheck("Focused")} disabled={!isRunning}><Icon name="check" size={18}/>Focused</button><button type="button" className="sb-check-btn sb-check-negative" onClick={() => recordCheck("Distracted")} disabled={!isRunning}><Icon name="alert" size={18}/>Distracted</button></div>
                {!isRunning && <p className="sb-helper">Start the timer to enable check-ins.</p>}
                <div className="sb-check-summary"><span><strong>{focusedChecks}</strong> focused</span><span><strong>{distractions}</strong> distracted</span><span><strong>{focusScore === null ? "—" : `${focusScore}%`}</strong> score</span></div>
                {focusHistory.length > 0 && <div className="sb-activity"><h4>Recent activity</h4>{focusHistory.slice(0, 4).map(item => <div key={item.id} className="sb-activity-row"><span className={item.status === "Focused" ? "sb-event-good" : "sb-event-bad"}>{item.status === "Focused" ? "✓" : "!"}</span><strong>{item.status}</strong><time>{item.time}</time></div>)}</div>}
              </section>
            </div>
          </div>
        </main>
      </div>

      <footer className="sb-footer"><span>✦ Study Buddy</span><span>Made for better study days · HackPrinceton</span></footer>
    </div>
  );
}
