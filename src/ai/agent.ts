// The AI astrologer's conversation loop, for Claude (Anthropic SDK) or OpenAI (OpenAI
// SDK). Both stream text as it is generated, run the chart tools the model calls
// (tools.ts) and loop until the model has answered. The calls go straight from the
// browser to the provider with the user's own API key (personal, local use).
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  BetaContentBlockParam, BetaMessageParam, BetaToolResultBlockParam, BetaToolUnion, BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { FunctionTool, ResponseInputItem } from 'openai/resources/responses/responses';
import { AI_TOOLS, anthropicStrictSchema, openaiStrictSchema, runTool, type ToolContext } from './tools';
import { SYSTEM_PROMPT } from './systemPrompt';

export type Provider = 'claude' | 'openai';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export const OPENAI_REASONING = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type OpenAIReasoning = '' | (typeof OPENAI_REASONING)[number];

export interface AiSettings {
  provider: Provider;
  anthropicKey: string;
  openaiKey: string;
  claudeModel: string;
  openaiModel: string;
  /** Claude effort (thinking depth and thoroughness) */
  effort: Effort;
  /** OpenAI reasoning.effort for reasoning models; '' = the model's default (not sent) */
  openaiReasoning: OpenAIReasoning;
}

export const CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'];
/** Models that accept the server-side refusal fallback (fallbacks: "default"). */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

export const DEFAULT_SETTINGS: AiSettings = {
  provider: 'claude', anthropicKey: '', openaiKey: '',
  claudeModel: 'claude-opus-5-5', openaiModel: 'gpt-5', effort: 'high', openaiReasoning: '',
};

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'tool'; id: string; name: string; input: unknown }
  | { type: 'toolResult'; id: string; ok: boolean; text: string };

export interface Conversation {
  readonly provider: Provider;
  /** Send a user message; resolves when the model has finished answering. */
  send(text: string, onEvent: (e: AgentEvent) => void, signal: AbortSignal): Promise<void>;
}

async function runAll(ctx: ToolContext, calls: { id: string; name: string; input: unknown }[], onEvent: (e: AgentEvent) => void) {
  return Promise.all(calls.map(async (c) => {
    onEvent({ type: 'tool', id: c.id, name: c.name, input: c.input });
    const r = await runTool(ctx, c.name, c.input);
    onEvent({ type: 'toolResult', id: c.id, ok: r.ok, text: r.text });
    return r;
  }));
}

// ---------------------------------------------------------------------------
// Claude

const CLAUDE_TOOLS: BetaToolUnion[] = AI_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: anthropicStrictSchema(t.parameters) as { type: 'object' },
  // the model's inputs always match the schema; ranges are enforced by runTool()
  strict: true,
  ...(t.examples ? { input_examples: t.examples } : {}),
  // stream tool inputs as they are generated; runTool() validates them before running
  eager_input_streaming: true,
}));

class ClaudeConversation implements Conversation {
  readonly provider = 'claude' as const;
  private client: Anthropic;
  private messages: BetaMessageParam[] = [];

  constructor(private settings: AiSettings, private ctx: ToolContext) {
    this.client = new Anthropic({ apiKey: settings.anthropicKey, dangerouslyAllowBrowser: true });
  }

  async send(text: string, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
    this.messages.push({ role: 'user', content: text });
    const model = this.settings.claudeModel;
    const fallback = FALLBACK_MODELS.has(model);
    for (;;) {
      const stream = this.client.beta.messages.stream({
        model,
        max_tokens: 64000,
        system: SYSTEM_PROMPT,
        tools: CLAUDE_TOOLS,
        messages: this.messages,
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort: this.settings.effort },
        // the system prompt and tool list are stable: cache the growing prefix
        cache_control: { type: 'ephemeral' },
        // on a safety decline, re-run the request on Anthropic's recommended fallback model
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      }, { signal });
      stream.on('text', (delta) => onEvent({ type: 'text', delta }));
      stream.on('thinking', (delta) => onEvent({ type: 'thinking', delta }));
      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        onEvent({ type: 'text', delta: `\n\n[The model declined to continue${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ''}.]` });
        this.messages.pop(); // keep the conversation usable: drop the declined question
        return;
      }
      this.messages.push({ role: 'assistant', content: message.content as BetaContentBlockParam[] });
      if (message.stop_reason === 'pause_turn') continue;
      const calls = message.content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use');
      if (calls.length === 0) return;
      if (message.stop_reason === 'max_tokens') throw new Error('The answer hit the output limit while calling a tool; please ask again more narrowly.');
      const results = await runAll(this.ctx, calls, onEvent);
      // all results of one turn go back in a single user message
      const content: BetaToolResultBlockParam[] = calls.map((c, k) => ({
        type: 'tool_result', tool_use_id: c.id, content: results[k].text, ...(results[k].ok ? {} : { is_error: true }),
      }));
      this.messages.push({ role: 'user', content });
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI (Responses API: function tools work together with reasoning models)

const OPENAI_TOOLS: FunctionTool[] = AI_TOOLS.map((t) => ({
  // strict: every property required, optional ones nullable (runTool() drops the nulls)
  type: 'function', name: t.name, description: t.description, parameters: openaiStrictSchema(t.parameters), strict: true,
}));

class OpenAIConversation implements Conversation {
  readonly provider = 'openai' as const;
  private client: OpenAI;
  /** the last completed response; the server keeps the conversation (previous_response_id) */
  private lastId: string | null = null;

  constructor(private settings: AiSettings, private ctx: ToolContext) {
    this.client = new OpenAI({ apiKey: settings.openaiKey, dangerouslyAllowBrowser: true });
  }

  async send(text: string, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
    let previous = this.lastId;
    let input: ResponseInputItem[] = [{ role: 'user', content: text }];
    for (;;) {
      const stream = this.client.responses.stream({
        model: this.settings.openaiModel,
        instructions: SYSTEM_PROMPT,
        input,
        tools: OPENAI_TOOLS,
        ...(previous ? { previous_response_id: previous } : {}),
        ...(this.settings.openaiReasoning ? { reasoning: { effort: this.settings.openaiReasoning } } : {}),
      }, { signal });
      stream.on('response.output_text.delta', (e) => onEvent({ type: 'text', delta: e.delta }));
      const response = await stream.finalResponse();
      previous = response.id;
      for (const item of response.output) {
        if (item.type === 'message') {
          for (const c of item.content) if (c.type === 'refusal') onEvent({ type: 'text', delta: `

[The model declined: ${c.refusal}]` });
        }
      }
      const calls = response.output.flatMap((o) => (o.type === 'function_call' ? [o] : []));
      if (calls.length === 0) {
        // commit only a finished turn: a stopped or failed question leaves no unanswered tool calls behind
        this.lastId = response.id;
        if (response.status === 'incomplete') onEvent({ type: 'text', delta: `

[Incomplete: ${response.incomplete_details?.reason ?? 'unknown reason'}]` });
        return;
      }
      if (response.status === 'incomplete') throw new Error('The answer hit the output limit while calling a tool; please ask again more narrowly.');
      const parsed = calls.map((c) => {
        let args: unknown;
        try { args = JSON.parse(c.arguments || '{}'); } catch { args = undefined; }
        return { id: c.call_id, name: c.name, input: args };
      });
      const results = await runAll(this.ctx, parsed, onEvent);
      input = parsed.map((c, k) => ({ type: 'function_call_output', call_id: c.id, output: results[k].text }));
    }
  }
}

export function startConversation(settings: AiSettings, ctx: ToolContext): Conversation {
  if (settings.provider === 'openai') {
    if (!settings.openaiKey) throw new Error('Enter an OpenAI API key in the AI settings.');
    return new OpenAIConversation(settings, ctx);
  }
  if (!settings.anthropicKey) throw new Error('Enter an Anthropic API key in the AI settings.');
  return new ClaudeConversation(settings, ctx);
}

export interface ModelEntry { id: string; created: number; owner: string }

/** Every model the key can use (GET /v1/models, all pages), newest first. */
export async function listModels(provider: Provider, key: string): Promise<ModelEntry[]> {
  const out: ModelEntry[] = [];
  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
    for await (const m of client.models.list()) out.push({ id: m.id, created: m.created, owner: m.owned_by });
  } else {
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    for await (const m of client.models.list()) out.push({ id: m.id, created: Date.parse(m.created_at) / 1000, owner: 'anthropic' });
  }
  return out.sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
}

/** OpenAI ids usable with Chat Completions (drops embeddings, audio, image, moderation ...). */
export const isOpenAIChatModel = (id: string) =>
  /^(gpt-|o\d|chatgpt-)/.test(id) && !/(embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct)/.test(id);

/** A readable message for an API error (typed SDK errors first). */
export function errorText(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof OpenAI.AuthenticationError) return 'The API key was rejected - check it in the AI settings.';
  if (e instanceof Anthropic.RateLimitError || e instanceof OpenAI.RateLimitError) return 'Rate limited by the provider - wait a moment and try again.';
  if (e instanceof Anthropic.NotFoundError || e instanceof OpenAI.NotFoundError) return 'The model was not found - check the model name in the AI settings.';
  if (e instanceof Anthropic.APIError || e instanceof OpenAI.APIError) return `API error ${e.status ?? ''}: ${e.message}`;
  if (e instanceof Error && e.name === 'AbortError') return 'Stopped.';
  return e instanceof Error ? e.message : String(e);
}
