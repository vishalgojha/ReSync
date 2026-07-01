import { GoogleGenAI } from '@google/genai'
import type { AIProvider, AIProviderConfig, ChatMessage, ChatOptions } from '../provider'

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI
  private model: string

  constructor(config: AIProviderConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey })
    this.model = config.model
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystem = messages.filter(m => m.role !== 'system')

    const contents = nonSystem.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }))

    const res = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: systemMessages.length
          ? systemMessages.map(m => ({ text: m.content }))[0]
          : undefined,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      },
    })

    return res.text ?? ''
  }

  async embeddings(texts: string[]): Promise<number[][]> {
    const res = await this.client.models.embedContent({
      model: 'text-embedding-004',
      contents: texts.map(t => ({ role: 'user', parts: [{ text: t }] })),
    })
    return []
  }
}
