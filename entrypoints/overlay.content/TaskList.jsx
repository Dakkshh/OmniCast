import './TaskList.css';

export default function TaskList({ tasks, setSettingUp, currentIndex, finished, started, paused, onTogglePause, onStart, resetSession }) {
  function toggleSession() {
    if (tasks.length === 0) return;
    if (!started) onStart();          // not started (or finished) → start from task 1
    else onTogglePause();        // in progress → pause / resume
  }

  const label = finished ? 'Restart'
    : !started ? 'Start'
    : paused ? 'Resume'
    : 'Pause';

  return (
    <div className="task-editor">
      {tasks.length > 0 ? (
        tasks.map((t, i) => {
          const done = finished || i < currentIndex;
          const active = started && i === currentIndex;
          return (
            <div key={t.id} className={`list-row ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <span className="list-task">{t.task}</span>
              <span className="list-minutes">{t.minutes} min</span>
            </div>
          );
        })
      ) : (
        <p>Seems like you don't have any tasks yet.</p>
      )}

      <div className="editor-actions">
        {!started && <button onClick={() => setSettingUp(true)}>Edit Tasks</button>}
        <button onClick={toggleSession}>{label} Session</button>
        <button onClick={resetSession}>Reset Session</button>
      </div>
    </div>
  );
}