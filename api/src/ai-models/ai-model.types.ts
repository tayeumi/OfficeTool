// 4 provider AI ho tro cho tool "OCR PDF sang Word (AI)" va cac tinh nang AI
// tuong lai - "openrouter" dung CHUNG code voi "openai" (tuong thich hoan
// toan OpenAI SDK, chi khac baseURL - xem ai-providers/openai.provider.ts)
// vi la 1 cong gateway gom nhieu model MIEN PHI khac nhau, huu ich khi can
// phuong an du phong ngoai Gemini (2026-09-24, theo yeu cau "bổ sung thêm
// danh mục để tôi cấu hình sử dụng khi cần").
export type AiProvider = 'gemini' | 'anthropic' | 'openai' | 'openrouter';

export interface AiModelConfig {
  id: string;
  // Ten hien thi cho nguoi dung chon (vd "Gemini 2.5 Flash (mac dinh)") -
  // KHAC voi modelId (ten model that su goi API, vd "gemini-2.5-flash").
  label: string;
  provider: AiProvider;
  modelId: string;
  apiKey: string;
  // Cau hinh duoc BAT/TAT rieng - tat thi khong hien trong dropdown chon
  // model cua nguoi dung nhung KHONG xoa (giu lai de admin bat lai sau).
  enabled: boolean;
  createdAt: string;
}

// Phien ban an toan gui ve FRONTEND - KHONG BAO GIO tra nguyen ven apiKey
// (chi 4 ky tu cuoi de admin nhan dien dung key nao, tranh lo toan bo key
// qua Network tab/DevTools cua trinh duyet).
export interface AiModelConfigPublic {
  id: string;
  label: string;
  provider: AiProvider;
  modelId: string;
  apiKeyMasked: string;
  enabled: boolean;
  createdAt: string;
}

export function toPublicAiModelConfig(
  config: AiModelConfig,
): AiModelConfigPublic {
  const { apiKey, ...rest } = config;
  const last4 = apiKey.slice(-4);
  return { ...rest, apiKeyMasked: `${'*'.repeat(8)}${last4}` };
}
