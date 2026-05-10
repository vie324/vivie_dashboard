// Claude API クライアント (Anthropic SDK 不要、fetch ベース)
// プロンプトキャッシュは目標提案では不要なため未使用。

interface CompletionOpts {
  model?: string;
  maxTokens?: number;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

interface CompletionResult {
  text: string;
  raw: any;
}

export function claudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function complete(opts: CompletionOpts): Promise<CompletionResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY が未設定です');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model ?? 'claude-sonnet-4-6',
      max_tokens: opts.maxTokens ?? 1500,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n')
    .trim();
  return { text, raw: data };
}
