// Background Service Worker

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
            },
            google: {
                baseUrl: 'https://translate.googleapis.com/translate_a/single',
                useApiKey: false
            }
        };
    }

    async translate(config, text, targetLanguage, style) {
        const { apiProvider, deepseekConfig, glmConfig, googleConfig } = config;
        
        let apiKey, model, baseUrl;
        
        if (apiProvider === 'deepseek') {
            apiKey = deepseekConfig.apiKey;
            model = deepseekConfig.model;
            baseUrl = this.providers.deepseek.baseUrl;
            
            if (!apiKey) {
                throw new Error('请先配置DeepSeek API Key');
            }
            
            const prompt = this.buildPrompt(text, targetLanguage, style);
            const response = await this.makeAIRequest(baseUrl, model, apiKey, prompt);
            return this.extractAITranslation(response, apiProvider);
            
        } else if (apiProvider === 'glm') {
            apiKey = glmConfig.apiKey;
            model = glmConfig.model;
            baseUrl = this.providers.glm.baseUrl;
            
            if (!apiKey) {
                throw new Error('请先配置GLM API Key');
            }
            
            const prompt = this.buildPrompt(text, targetLanguage, style);
            const response = await this.makeAIRequest(baseUrl, model, apiKey, prompt);
            return this.extractAITranslation(response, apiProvider);
            
        } else if (apiProvider === 'google') {
            // Google翻译不需要API Key
            return await this.makeGoogleRequest(text, targetLanguage);
            
        } else {
            throw new Error('不支持的API提供商');
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

    async makeAIRequest(baseUrl, model, apiKey, prompt) {
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

        console.log('Making AI API request to:', url);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('AI API response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('AI API error response:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('AI API success response:', data);
        return data;
    }

    async makeGoogleRequest(text, targetLanguage) {
        // 使用MyMemory免费翻译API
        const url = 'https://api.mymemory.translated.net/get';
        
        const googleLangMap = {
            'zh': 'zh-CN',
            'en': 'en', 
            'ja': 'ja',
            'ko': 'ko',
            'fr': 'fr',
            'de': 'de',
            'es': 'es'
        };

        const targetLang = googleLangMap[targetLanguage] || 'zh-CN';
        
        // 检测文本语言（简单启发式方法）
        const sourceLang = this.detectLanguage(text);
        
        // MyMemory API限制500字符，需要分段处理
        const maxQueryLength = 450; // 留一些安全边距
        
        if (text.length <= maxQueryLength) {
            return await this.singleTranslation(text, sourceLang, targetLang, url);
        } else {
            return await this.batchTranslation(text, sourceLang, targetLang, maxQueryLength, url);
        }
    }

    async singleTranslation(text, sourceLang, targetLang, url) {
        const params = new URLSearchParams({
            'q': text,
            'langpair': `${sourceLang}|${targetLang}`
        });

        console.log('Making single translation request via MyMemory API');
        console.log('Source language:', sourceLang, 'Target language:', targetLang);

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET'
            });

            console.log('Translation response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Translation success response');
            
            if (data && data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            } else {
                throw new Error('翻译服务返回了无效的响应格式');
            }
        } catch (error) {
            console.error('Translation error:', error);
            throw new Error(`翻译失败: ${error.message}`);
        }
    }

    async batchTranslation(text, sourceLang, targetLang, maxLength, url) {
        console.log('Text too long, starting batch translation');
        
        // 按句子分段，保持语义完整性
        const sentences = this.splitText(text, maxLength);
        const translations = [];
        
        for (let i = 0; i < sentences.length; i++) {
            console.log(`Translating segment ${i + 1}/${sentences.length}`);
            
            try {
                const segmentTranslation = await this.singleTranslation(
                    sentences[i], 
                    sourceLang, 
                    targetLang, 
                    url
                );
                translations.push(segmentTranslation);
                
                // 添加小延迟避免API限制
                if (i < sentences.length - 1) {
                    await this.sleep(200);
                }
            } catch (error) {
                console.error(`Error translating segment ${i + 1}:`, error);
                // 如果某段翻译失败，保留原文
                translations.push(sentences[i]);
            }
        }
        
        return translations.join(' ');
    }

    splitText(text, maxLength) {
        // 首先按句子分割
        const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
        const segments = [];
        let currentSegment = '';
        
        for (const sentence of sentences) {
            if ((currentSegment + sentence).length <= maxLength) {
                currentSegment += sentence;
            } else {
                if (currentSegment) {
                    segments.push(currentSegment.trim());
                }
                // 如果单个句子超过最大长度，强制分割
                if (sentence.length > maxLength) {
                    const words = sentence.split(/\s+/);
                    let tempSegment = '';
                    for (const word of words) {
                        if ((tempSegment + ' ' + word).trim().length <= maxLength) {
                            tempSegment = (tempSegment + ' ' + word).trim();
                        } else {
                            if (tempSegment) {
                                segments.push(tempSegment);
                            }
                            tempSegment = word;
                        }
                    }
                    if (tempSegment) {
                        currentSegment = tempSegment;
                    } else {
                        currentSegment = '';
                    }
                } else {
                    currentSegment = sentence;
                }
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment.trim());
        }
        
        return segments.filter(seg => seg.length > 0);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 简单的语言检测函数
    detectLanguage(text) {
        // 检测中文字符
        const chineseRegex = /[\u4e00-\u9fa5]/;
        // 检测日文字符
        const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
        // 检测韩文字符
        const koreanRegex = /[\uac00-\ud7af]/;
        // 检测阿拉伯文字符
        const arabicRegex = /[\u0600-\u06ff]/;
        // 检测俄文字符
        const russianRegex = /[\u0400-\u04ff]/;
        
        if (chineseRegex.test(text)) {
            return 'zh-CN';
        } else if (japaneseRegex.test(text)) {
            return 'ja';
        } else if (koreanRegex.test(text)) {
            return 'ko';
        } else if (arabicRegex.test(text)) {
            return 'ar';
        } else if (russianRegex.test(text)) {
            return 'ru';
        } else {
            // 默认假设为英语
            return 'en';
        }
    }

    extractAITranslation(response, provider) {
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

let translationAPI = null;

// 初始化API
function initAPI() {
    if (!translationAPI) {
        translationAPI = new TranslationAPI();
    }
    return translationAPI;
}

// 监听消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'translate') {
        handleTranslate(request, sendResponse);
        return true; // 保持消息通道开启
    }
});

// 处理翻译请求
async function handleTranslate(request, sendResponse) {
    console.log('Handling translation request:', request);
    
    try {
        const api = initAPI();
        
        // 获取配置
        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get([
                'apiProvider',
                'deepseekConfig',
                'glmConfig',
                'targetLanguage',
                'translationStyle'
            ], function(config) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(config);
                }
            });
        });

        console.log('Loaded config:', result);

        // 验证配置
        if (!result.apiProvider) {
            sendResponse({
                success: false,
                error: '请先在设置页面配置API提供商'
            });
            return;
        }

        // 验证API Key（Google翻译不需要API Key）
        let apiKey = null;
        if (result.apiProvider === 'deepseek') {
            apiKey = result.deepseekConfig?.apiKey;
        } else if (result.apiProvider === 'glm') {
            apiKey = result.glmConfig?.apiKey;
        }
        // Google翻译不需要API Key，跳过验证

        if (result.apiProvider !== 'google' && !apiKey) {
            const providerName = {
                'deepseek': 'DeepSeek',
                'glm': 'GLM'
            }[result.apiProvider] || result.apiProvider;
            
            sendResponse({
                success: false,
                error: `请先在设置页面配置${providerName} API Key`
            });
            return;
        }

        console.log('Starting translation for text length:', request.text.length);

        // 执行翻译
        const translation = await api.translate(
            result,
            request.text,
            result.targetLanguage || 'zh',
            result.translationStyle || 'formal'
        );

        console.log('Translation completed successfully');

        sendResponse({
            success: true,
            translation: translation,
            provider: result.apiProvider
        });

    } catch (error) {
        console.error('Translation error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: 'translateSelection',
        title: '使用AI翻译助手翻译 "%s"',
        contexts: ['selection']
    });
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === 'translateSelection') {
        const selectedText = info.selectionText;
        if (selectedText) {
            // 直接翻译选中的文本
            chrome.tabs.sendMessage(tab.id, {
                action: 'showRightClickTranslation',
                text: selectedText
            });
        }
    }
});

// 监听插件图标点击
chrome.action.onClicked.addListener(function(tab) {
    chrome.action.openPopup();
});