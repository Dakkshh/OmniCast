import ExpandIcon from '../../assets/expand.png'
import OkayIcon from '../../assets/okay.webp'
import AlertIcon from '../../assets/alert.png'
import './Pill.css'
import TaskEditor from './TaskEditor'
import TaskList from './TaskList'
import { useState } from 'react';

export default function Pill({ seconds, minimized, setMinimized, verdict }) {
  function newTask() {
    return { id: crypto.randomUUID(), task: '', minutes: '' };
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const [tasks, setTasks] = useState([]);
  const [settingUp, setSettingUp] = useState(false);

  return (
    <>
      {minimized ?
        <div className="minimized-pill">
          <span className="dot" />LIVE
          <span className="task">Read chapter 4</span>
          <span className="timer">{mm}:{ss}</span>
          <img onClick={() => setMinimized(false)} src={ExpandIcon} className="maximize-icon" />
          {/* <button onClick={takeShot}>📸</button> */}
          {verdict && (verdict.onTask ? <img src={OkayIcon} className="verdict-icon" /> : <img src={AlertIcon} className="verdict-icon" />)}
        </div> :
        <div className="maximized-pill">
          <img onClick={() => setMinimized(true)} src={ExpandIcon} className="minimize-icon" />
          <div className="live-text">
            <div className="big-dot" /><span className="live">LIVE</span>
          </div>
          {/* <span className="task">Read chapter 4</span> */}
          <div className="big-timer">{mm}:{ss}</div>
          {/* <button onClick={takeShot}>📸</button> */}
          {verdict && (
            <span className="verdict">{verdict.onTask ? '✅ on task' : `❌ ${verdict.nudge}`}</span>
          )}
          <div className="current-tasks">Current tasks</div>
          {settingUp ? <TaskEditor tasks={tasks} setTasks={setTasks} setSettingUp={setSettingUp}/> : <TaskList tasks={tasks} setSettingUp={setSettingUp} />}
        </div>
      }
    </>
  );
}