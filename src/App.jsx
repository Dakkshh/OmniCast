
import { useEffect, useState } from "react";
import "./App.css";

const STORAGE_KEY = "studyBuddyData";

function getSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function App() {
  const [savedData] = useState(getSavedData);

  const [subject, setSubject] = useState(savedData.subject ?? "");
  const [goal, setGoal] = useState(savedData.goal ?? "");
  const [duration, setDuration] = useState(savedData.duration ?? 25);
  const [timeLeft, setTimeLeft] = useState(
    (savedData.duration ?? 25) * 60
  );
  const [isRunning, setIsRunning] = useState(false);

  const [completedSessions, setCompletedSessions] = useState(
    savedData.completedSessions ?? 0
  );
  const [totalMinutes, setTotalMinutes] = useState(
    savedData.totalMinutes ?? 0
  );
  const [sessionHistory, setSessionHistory] = useState(
    savedData.sessionHistory ?? []
  );

  const [focusStatus, setFocusStatus] = useState("Not Monitoring");
  const [distractions, setDistractions] = useState(
    savedData.distractions ?? 0
  );
  const [focusedChecks, setFocusedChecks] = useState(
    savedData.focusedChecks ?? 0
  );
  const [totalChecks, setTotalChecks] = useState(
    savedData.totalChecks ?? 0
  );
  const [focusHistory, setFocusHistory] = useState(
    savedData.focusHistory ?? []
  );

  // Save study data whenever it changes.
  useEffect(() => {
    const data = {
      subject,
      goal,
      duration,
      completedSessions,
      totalMinutes,
      sessionHistory,
      distractions,
      focusedChecks,
      totalChecks,
      focusHistory,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [
    subject,
    goal,
    duration,
    completedSessions,
    totalMinutes,
    sessionHistory,
    distractions,
    focusedChecks,
    totalChecks,
    focusHistory,
  ]);

  // Countdown timer.
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Record completed sessions.
  useEffect(() => {
    if (timeLeft !== 0 || !isRunning) return;

    const timeout = setTimeout(() => {
      const newSession = {
        id: crypto.randomUUID(),
        subject: subject || "General Study",
        goal: goal || "No goal specified",
        duration,
        completedAt: new Date().toISOString(),
        distractions,
        focusScore:
          totalChecks === 0
            ? null
            : Math.round((focusedChecks / totalChecks) * 100),
      };

      setSessionHistory((previous) => [
        newSession,
        ...previous,
      ]);

      setCompletedSessions((previous) => previous + 1);
      setTotalMinutes((previous) => previous + duration);
      setIsRunning(false);
      setFocusStatus("Not Monitoring");
    }, 0);

    return () => clearTimeout(timeout);
  }, [
    timeLeft,
    isRunning,
    subject,
    goal,
    duration,
    distractions,
    focusedChecks,
    totalChecks,
  ]);

  function changeDuration(minutes) {
    setIsRunning(false);
    setDuration(minutes);
    setTimeLeft(minutes * 60);
    setFocusStatus("Not Monitoring");
    resetMonitoring();
  }

  function resetMonitoring() {
    setFocusStatus("Not Monitoring");
    setDistractions(0);
    setFocusedChecks(0);
    setTotalChecks(0);
    setFocusHistory([]);
  }

  function resetTimer() {
    setIsRunning(false);
    setTimeLeft(duration * 60);
    resetMonitoring();
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  function toggleTimer() {
    if (isRunning) {
      setIsRunning(false);
      setFocusStatus("Not Monitoring");
    } else if (timeLeft > 0) {
      setIsRunning(true);
      setFocusStatus("Not Monitoring");
    }
  }

  function simulateFocusCheck(status) {
    if (!isRunning) {
      alert("Start a study session first!");
      return;
    }

    setFocusStatus(status);
    setTotalChecks((previous) => previous + 1);

    if (status === "Focused") {
      setFocusedChecks((previous) => previous + 1);
    } else if (status === "Distracted") {
      setDistractions((previous) => previous + 1);
    }

    setFocusHistory((previous) => [
      {
        id: crypto.randomUUID(),
        status,
        time: new Date().toLocaleTimeString(),
      },
      ...previous,
    ]);
  }

  const focusScore =
    totalChecks === 0
      ? null
      : Math.round((focusedChecks / totalChecks) * 100);

  return (
    <div className="app">
      <header className="header">
        <h1>🧠 Study Buddy</h1>
        <p>Your AI-powered study companion</p>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <h2>Time to lock in! 🚀</h2>
          <p>
            Stay focused, achieve your goals, and study smarter.
          </p>
        </section>

        {/* Study setup */}
        <section className="card">
          <h2>📚 Your Study Session</h2>

          <label htmlFor="subject">
            What are you studying?
          </label>
          <input
            id="subject"
            type="text"
            placeholder="e.g. Data Structures"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={isRunning}
          />

          <label htmlFor="goal">What's your goal?</label>
          <textarea
            id="goal"
            placeholder="e.g. Finish Chapter 3"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            disabled={isRunning}
          />

          <h3>Choose your focus duration</h3>
          <div className="duration-buttons">
            {[1, 25, 45, 60].map((minutes) => (
              <button
                key={minutes}
                className={duration === minutes ? "selected" : ""}
                onClick={() => changeDuration(minutes)}
                disabled={isRunning}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </section>

        {/* Timer */}
        <section className="card timer-card">
          <h2>⏱️ Focus Timer</h2>
          <div className="timer">{formatTime(timeLeft)}</div>

          <p className="timer-status">
            {isRunning
              ? "🟢 Focus session in progress"
              : timeLeft === 0
                ? "🎉 Session complete!"
                : "Ready when you are!"}
          </p>

          <div className="timer-buttons">
            <button
              className="primary-button"
              onClick={toggleTimer}
              disabled={timeLeft === 0}
            >
              {isRunning ? "⏸ Pause" : "▶ Start / Resume"}
            </button>

            <button className="reset-button" onClick={resetTimer}>
              ↻ Reset
            </button>
          </div>
        </section>

        {/* Focus monitoring */}
        <section className="card">
          <h2>🧠 AI Focus Monitoring</h2>

          <div className="monitoring-status">
            <h3>Current Status</h3>
            <p
              className={
                focusStatus === "Focused"
                  ? "status-focused"
                  : focusStatus === "Distracted"
                    ? "status-distracted"
                    : "status-inactive"
              }
            >
              {focusStatus}
            </p>
          </div>

          <div className="monitoring-stats">
            <div className="stat">
              <h3>{distractions}</h3>
              <p>Distractions Detected</p>
            </div>

            <div className="stat">
              <h3>
                {focusScore === null ? "—" : `${focusScore}%`}
              </h3>
              <p>Focus Score</p>
            </div>
          </div>

          <h3>Test AI Detection</h3>
          <p>Simulate results from your Chrome extension.</p>

          <div className="test-buttons">
            <button
              className="focused-button"
              onClick={() => simulateFocusCheck("Focused")}
            >
              ✅ Focused
            </button>

            <button
              className="distracted-button"
              onClick={() => simulateFocusCheck("Distracted")}
            >
              ⚠️ Distracted
            </button>
          </div>

          <h3>Recent Activity</h3>
          {focusHistory.length === 0 ? (
            <p>No activity recorded yet.</p>
          ) : (
            <ul className="activity-list">
              {focusHistory.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <span>
                    {event.status === "Focused" ? "✅" : "⚠️"}
                  </span>
                  <span>{event.status}</span>
                  <span>{event.time}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Overall progress */}
        <section className="card">
          <h2>📊 Your Progress</h2>
          <div className="stats">
            <div className="stat">
              <h3>{completedSessions}</h3>
              <p>Completed Sessions</p>
            </div>
            <div className="stat">
              <h3>{totalMinutes}</h3>
              <p>Focused Minutes</p>
            </div>
          </div>
        </section>

        {/* Completed session history */}
        <section className="card">
          <h2>📅 Study Session History</h2>

          {sessionHistory.length === 0 ? (
            <p>No completed sessions yet. Start studying!</p>
          ) : (
            <div className="session-history">
              {sessionHistory.map((session) => (
                <div className="session-item" key={session.id}>
                  <div>
                    <h3>{session.subject}</h3>
                    <p>{session.goal}</p>
                    <small>
                      {new Date(
                        session.completedAt
                      ).toLocaleString()}
                    </small>
                  </div>

                  <div className="session-details">
                    <strong>{session.duration} min</strong>
                    <span>
                      {session.focusScore === null
                        ? "Not monitored"
                        : `${session.focusScore}% focused`}
                    </span>
                    <span>
                      {session.distractions} distractions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>Made with ❤️ for HackPrinceton</footer>
    </div>
  );
}

export default App;
