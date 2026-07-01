import type { AIProvider, AIProviderConfig } from './provider'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'

const BASE_URLS: Record<string, string | undefined> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  anthropic: undefined,
  gemini: undefined,
  custom: undefined,
}

export class ProviderFactory {
  static create(config: AIProviderConfig): AIProvider {
    switch (config.kind) {
      case 'openai':
      case 'openrouter':
      case 'custom':
        return new OpenAIProvider({
          ...config,
          baseUrl: config.baseUrl ?? BASE_URLS[config.kind],
        })
      case 'anthropic':
        return new AnthropicProvider(config)
      case 'gemini':
        return new GeminiProvider(config)
    }
  }
}
