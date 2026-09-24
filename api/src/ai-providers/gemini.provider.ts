import { GoogleGenerativeAI } from '@google/generative-ai';
import { OCR_PROMPT, stripCodeFence } from './ocr-prompt';

export async function ocrPageWithGemini(
  apiKey: string,
  modelId: string,
  imageBytes: Buffer,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const result = await model.generateContent([
    OCR_PROMPT,
    {
      inlineData: {
        mimeType: 'image/png',
        data: imageBytes.toString('base64'),
      },
    },
  ]);

  return stripCodeFence(result.response.text());
}
