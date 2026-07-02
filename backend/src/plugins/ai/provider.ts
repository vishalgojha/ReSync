export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'custom'

export interface AIProviderConfig {
  kind: ProviderKind
  apiKey: string
  model: string
  baseUrl?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
}

export interface AIProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
  embeddings(texts: string[]): Promise<number[][]>
}
