const KEY_NAME = 'gemini_api_key';
const MODEL_NAME = 'gemini_model_id';

export const getGeminiKey = (): { key: string, modelId: string } | null => {
    const key = localStorage.getItem(KEY_NAME);
    const modelId = localStorage.getItem(MODEL_NAME) || 'models/gemini-1.5-flash';
    if (!key) return null;
    return { key, modelId };
};

export const setGeminiKey = (key: string, modelId: string): void => {
    localStorage.setItem(KEY_NAME, key);
    localStorage.setItem(MODEL_NAME, modelId);
};

export const clearGeminiKey = (): void => {
    localStorage.removeItem(KEY_NAME);
    localStorage.removeItem(MODEL_NAME);
};
