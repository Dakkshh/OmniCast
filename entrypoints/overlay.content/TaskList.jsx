import './TaskList.css';

export default function TaskList({ tasks, setSettingUp }) {
  return (
    <div className="task-editor">
      {tasks.length > 0 ? (
        tasks.map((t) => (
          <div key={t.id} className="task-item">
            <div className="task-fields">
              <span className="list-task">
                {t.task}
              </span>
              <span className="list-minutes">
                {t.minutes}
              </span>
            </div>
          </div>
        ))
      ) : (
        <p>Seems like you don't have any tasks yet.</p>
      )}

      <div className="editor-actions">
        <button onClick={() => {setSettingUp(true)}}>Edit Tasks</button>
      </div>
    </div>
  );
}