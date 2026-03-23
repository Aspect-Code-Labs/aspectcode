/**
 * LLM utility — helpers for calling providers with per-call options.
 */

import type { ChatMessage } from '@aspectcode/optimizer';
import type { LlmProvider } from './types';

/**
 * Call the LLM with a specific temperature.
 * Uses `chatWithOptions` if available, falls back to `chat()`.
 *
 * When an AbortSignal is provided and fires, the returned promise
 * rejects immediately (the underlying HTTP call may still finish
 * in the background, but the caller stops waiting).
 */
export async function chatWithTemp(
  provider: LlmProvider,
  messages: ChatMessage[],
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const chatPromise = provider.chatWithOptions
    ? provider.chatWithOptions(messages, { temperature })
    : provider.chat(messages);

  if (!signal) return chatPromise;

  return Promise.race([
    chatPromise,
    new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }),
  ]);
}
