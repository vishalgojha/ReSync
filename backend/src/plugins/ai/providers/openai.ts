import OpenAI from 'openai'
import type { AIProvider, AIProviderConfig, ChatMessage, ChatOptions } from '../provider'

export class OpenAIProvider implements AIProvider {
  private client: OpenAI
  private model: string

  constructor(config: AIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
    })
    this.model = config.model
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    })
    return res.choices[0]?.message?.content ?? ''
  }

  async embeddings(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts,
    })
    return res.data.map(d => d.embedding)
  }
}
