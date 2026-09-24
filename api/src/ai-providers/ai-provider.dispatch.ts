import { AiModelConfig } from '../ai-models/ai-model.types';
import { ocrPageWithGemini } from './gemini.provider';
import { ocrPageWithAnthropic } from './anthropic.provider';
import { ocrPageWithOpenAi } from './openai.provider';

// OpenRouter (openrouter.ai) - cong gateway tuong thich HOAN TOAN OpenAI
// SDK, gom nhieu model vision MIEN PHI khac nhau qua 1 API key duy nhat -
// endpoint chuan cua ho, khong doi duoc qua UI (khac apiKey/modelId).
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Dispatch OCR 1 trang anh toi dung provider theo cau hinh model AI da chon
 * (2026-09-24) - moi provider co SDK/cau truc request-response rieng hoan
 * toan (xem gemini.provider.ts/anthropic.provider.ts/openai.provider.ts),
 * ham nay la diem vao DUY NHAT ma caller (ocr.processor.ts) can biet, khong
 * quan tam chi tiet tung provider ben trong.
 */
export async function ocrPageWithAiModel(
  config: AiModelConfig,
  imageBytes: Buffer,
): Promise<string> {
  switch (config.provider) {
    case 'gemini':
      return ocrPageWithGemini(config.apiKey, config.modelId, imageBytes);
    case 'anthropic':
      return ocrPageWithAnthropic(config.apiKey, config.modelId, imageBytes);
    case 'openai':
      return ocrPageWithOpenAi(config.apiKey, config.modelId, imageBytes);
    case 'openrouter':
      return ocrPageWithOpenAi(
        config.apiKey,
        config.modelId,
        imageBytes,
        OPENROUTER_BASE_URL,
      );
    default: {
      const exhaustiveCheck: never = config.provider;
      throw new Error(
        `Provider không được hỗ trợ: ${exhaustiveCheck as string}`,
      );
    }
  }
}
