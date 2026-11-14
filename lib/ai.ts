const MODEL = 'claude-haiku-5-5';

export type Verdict = { onTask: boolean; nudge: string };

export async function askClaude(dataUrl: string, task: string): Promise<Verdict> {
  const apiKey = import.meta.env.WXT_ANTHROPIC_API_KEY;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] },
            },
            {
              type: 'text',
              text: `The user's current study task is: "${task}".
                    This is a screenshot of their browser. Is what they're viewing relevant to that task?
                    Ignore the small focus widget in the corner.
                    Reply with ONLY this JSON and nothing else:
                    {"onTask": true or false, "nudge": "one short friendly sentence if off-task, otherwise empty string"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text: string = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  console.log('Claude said:', text); // shows in the SERVICE WORKER console

  const match = text.match(/\{[\s\S]*\}/); // grab just the {...} part
  if (!match) throw new Error('Claude did not return JSON: ' + text);
  const parsed = JSON.parse(match[0]);

  return {
    onTask: Boolean(parsed.onTask ?? parsed.on_task),
    nudge: String(parsed.nudge ?? ''),
  };
}