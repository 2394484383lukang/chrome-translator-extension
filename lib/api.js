// API调用封装
class TranslationAPI {
    constructor() {
        this.providers = {
            deepseek: {
                baseUrl: 'https://api.deepseek.com/v1',
                models: ['deepseek-chat', 'deepseek-coder']
            },
            glm: {
                baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
                models: ['glm-4', 'glm-4-plus', 'glm-4-0520']
            }
        };
    }

    async translate(config, text, targetLanguage, style) {
        const { apiProvider, deepseekConfig, glmConfig } = config;
        
        let apiKey, model, baseUrl;
        
        if (apiProvider === 'deepseek') {
            apiKey = deepseekConfig.apiKey;
            model = deepseekConfig.model;
            baseUrl = this.providers.deepseek.baseUrl;
        } else if (apiProvider === 'glm') {
            apiKey = glmConfig.apiKey;
            model = glmConfig.model;
            baseUrl = this.providers.glm.baseUrl;
        } else {
            throw new Error('不支持的API提供商');
        }

        if (!apiKey) {
            throw new Error('请先配置API Key');
        }

        const prompt = this.buildPrompt(text, targetLanguage, style);
        
        try {
            const response = await this.makeRequest(baseUrl, model, apiKey, prompt);
            return this.extractTranslation(response, apiProvider);
        } catch (error) {
            throw new Error(`API调用失败: ${error.message}`);
        }
    }

    buildPrompt(text, targetLanguage, style) {
        const styleInstructions = {
            formal: '请使用正式、书面的语言风格进行翻译。',
            casual: '请使用随意、口语化的语言风格进行翻译。',
            professional: '请使用专业术语和行业表达进行翻译。'
        };

        const languageNames = {
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
            'fr': '法语',
            'de': '德语',
            'es': '西班牙语'
        };

        const targetLang = languageNames[targetLanguage] || '中文';
        const styleInstruction = styleInstructions[style] || styleInstructions.formal;

        return `你是一个专业的翻译助手。${styleInstruction}

请将以下文本翻译为${targetLang}，保持原文的含义和格式，只返回翻译结果，不要包含任何解释或额外内容：

待翻译文本：
${text}

翻译结果：`;
    }

    async makeRequest(baseUrl, model, apiKey, prompt) {
        const url = `${baseUrl}/chat/completions`;
        
        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2000
        };

        console.log('Making API request to:', url);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error response:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('API success response:', data);
        return data;
    }

    extractTranslation(response, provider) {
        try {
            if (provider === 'deepseek') {
                return response.choices[0].message.content.trim();
            } else if (provider === 'glm') {
                return response.choices[0].message.content.trim();
            }
            throw new Error('Unknown provider');
        } catch (error) {
            throw new Error(`解析响应失败: ${error.message}`);
        }
    }
}

// ServiceWorker环境下不需要导出，类已经在全局作用域中
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TranslationAPI;
}