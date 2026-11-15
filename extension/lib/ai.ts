const MODEL = 'claude-haiku-5-5';

export type Verdict = { onTask: boolean; nudge: string };

function findJsonText(obj: any): string {
  if (typeof obj === 'string') return obj.includes('{') ? obj : '';
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const found = findJsonText(v);
      if (found) return found;
    }
  }
  return '';
}

export async function askClaude(dataUrl: string, task: string): Promise<Verdict> {
  const apiKey = import.meta.env.WXT_GEMINI_API_KEY;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      model: 'gemini-3.5-flash',
      input: [
        {
          type: 'text', text: `The user's current study task is: "${task}".
          This is a screenshot of their browser. Is what they're viewing relevant to that task?
          Ignore the small focus widget in the corner.
          Reply with ONLY this JSON and nothing else:
          {"onTask": true or false, "nudge": "one short friendly sentence if off-task, otherwise empty string. Mention what the user is doing, and then on the action the user should take. Refer to the task as their task."}` },   // same prompt text you send Claude
        { type: 'image', data: dataUrl.split(',')[1], mime_type: 'image/jpeg' },
      ],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  console.log('Gemini raw:', JSON.stringify(data).slice(0, 500));  // check where the text is
  const text = data.output_text ?? findJsonText(data);

  const match = text.match(/\{[\s\S]*\}/); // grab just the {...} part
  if (!match) throw new Error('Claude did not return JSON: ' + text);
  const parsed = JSON.parse(match[0]);

  return {
    onTask: Boolean(parsed.onTask ?? parsed.on_task),
    nudge: String(parsed.nudge ?? ''),
  };
}