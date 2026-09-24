import OpenAI from 'openai';
import { OCR_PROMPT, stripCodeFence } from './ocr-prompt';

/**
 * Dung chung cho ca "openai" va "openrouter" - OpenRouter tuong thich HOAN
 * TOAN voi OpenAI SDK (chi khac baseURL), nen khong can viet 1 provider
 * rieng: chi can truyen baseURL khac mac dinh la goi duoc nhieu model
 * vision MIEN PHI khac nhau qua cung 1 SDK (2026-09-24, theo yeu cau
 * "bổ sung thêm danh mục để tôi cấu hình sử dụng khi cần" sau khi tim hieu
 * cac API AI co goi free).
 */
export async function ocrPageWithOpenAi(
  apiKey: string,
  modelId: string,
  imageBytes: Buffer,
  baseURL?: string,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL });

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBytes.toString('base64')}`,
            },
          },
        ],
      },
    ],
  });

  return stripCodeFence(response.choices[0]?.message?.content ?? '');
}
