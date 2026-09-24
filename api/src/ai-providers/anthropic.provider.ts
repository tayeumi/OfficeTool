import Anthropic from '@anthropic-ai/sdk';
import { OCR_PROMPT, stripCodeFence } from './ocr-prompt';

export async function ocrPageWithAnthropic(
  apiKey: string,
  modelId: string,
  imageBytes: Buffer,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBytes.toString('base64'),
            },
          },
          { type: 'text', text: OCR_PROMPT },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  return stripCodeFence(textBlock?.type === 'text' ? textBlock.text : '');
}
