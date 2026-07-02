import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, AIProviderConfig, ChatMessage, ChatOptions } from '../provider'

export class AnthropicProvider implements AIProvider {
  private client: Anthropic
  private model: string

  constructor(config: AIProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystem = messages.filter(m => m.role !== 'system')

    const res = await this.client.messages.create({
      model: this.model,
      system: systemMessages.map(m => ({ type: 'text' as const, text: m.content })),
      messages: nonSystem.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens ?? 4096,
    })

    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  }

  async embeddings(_texts: string[]): Promise<number[][]> {
    throw new Error('Anthropic does not provide embeddings')
  }
}
