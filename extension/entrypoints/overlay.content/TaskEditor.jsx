import { useState } from 'react';
import './TaskEditor.css';

function newTask() {
  return { id: crypto.randomUUID(), task: '', minutes: '' };
}

export default function TaskEditor({ tasks, setTasks, setSettingUp, resetSession }) {
  // update one field ("task" or "minutes") of the task with this id
  function updateTask(id, field, value) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  function removeTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addTask() {
    setTasks((prev) => [...prev, newTask()]);
  }

  function handleDone() {
    // clean up: drop empty rows, turn minutes into numbers
    const cleaned = tasks
      .filter((t) => t.task.trim() !== '')
      .map((t) => ({ ...t, task: t.task.trim() }));

    // console.log('tasks:', cleaned);
    // onDone?.(cleaned); // only runs if a parent passed onDone
    setTasks(cleaned);
    resetSession()
    setSettingUp(false);
  }

  return (
    <div className="task-editor">
      {tasks.map((t, i) => (
        <div key={t.id} className="task-item">
          <div className="task-fields">
            <input
              className="task-input"
              placeholder={`Task ${i + 1}`}
              value={t.task}
              onChange={(e) => updateTask(t.id, 'task', e.target.value)}
            />
            <input
              className="minutes-input"
              type="number"
              min="0"
              placeholder="Minutes"
              value={t.minutes}
              onChange={(e) => updateTask(t.id, 'minutes', e.target.value)}
            />
          </div>
          <button className="remove-btn" onClick={() => removeTask(t.id)}>−</button>
        </div>
      ))}

      <div className="editor-actions">
        <button onClick={addTask}>Add</button>
        <button onClick={handleDone}>Done</button>
      </div>
    </div>
  );
}