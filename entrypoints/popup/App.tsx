import { useState } from 'react';
import './App.css';

export default function App() {
  const [error, setError] = useState('');

  async function openPanel() {
    try {
      const current = await browser.windows.getCurrent();
      if (current.id == null) throw new Error('No Chrome window found');
      await browser.sidePanel.open({ windowId: current.id });
      window.close();
    } catch (cause) { setError(String(cause)); }
  }

  return <main className="popup">
    <div className="mark">▣</div>
    <h1>study<span>buddy.</span></h1>
    <p>Your study session is one click away.</p>
    <button onClick={() => void openPanel()}>Open Study Buddy →</button>
    {error && <p role="alert">{error}</p>}
  </main>;
}
