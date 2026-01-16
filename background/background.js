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
            
            const prompt = this.buildPrompt(text, targetLanguage, style, apiProvider);
            const response = await this.makeAIRequest(baseUrl, model, apiKey, prompt, apiProvider);
            return this.extractAITranslation(response, apiProvider);
            
        } else if (apiProvider === 'glm') {
            apiKey = glmConfig.apiKey;
            model = glmConfig.model;
            baseUrl = this.providers.glm.baseUrl;
            
            if (!apiKey) {
                throw new Error('请先配置GLM API Key');
            }
            
            const prompt = this.buildPrompt(text, targetLanguage, style, apiProvider);
            const response = await this.makeAIRequest(baseUrl, model, apiKey, prompt, apiProvider);
            return this.extractAITranslation(response, apiProvider);
            
        } else if (apiProvider === 'google') {
            // Google翻译不需要API Key
            return await this.makeGoogleRequest(text, targetLanguage);
            
        } else {
            throw new Error('不支持的API提供商');
        }
    }

    buildPrompt(text, targetLanguage, style, provider) {
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

        // 根据不同AI模型的特点优化prompt
        if (provider === 'deepseek') {
            // DeepSeek擅长逻辑推理，可以使用更简洁的prompt
            return `Translate the following text into ${targetLang}. ${styleInstruction}

Text: ${text}

Translation:`;
        } else if (provider === 'glm') {
            // GLM-4对中文理解更好，使用中文prompt
            return `你是一个专业的翻译助手。${styleInstruction}

请将以下文本翻译为${targetLang}，保持原文的含义、格式和语气：

待翻译文本：
${text}

翻译结果：`;
        }
        
        // 默认prompt（兼容性）
        return `你是一个专业的翻译助手。${styleInstruction}

请将以下文本翻译为${targetLang}，保持原文的含义和格式，只返回翻译结果，不要包含任何解释或额外内容：

待翻译文本：
${text}

翻译结果：`;
    }

    async makeAIRequest(baseUrl, model, apiKey, prompt, provider) {
        const url = `${baseUrl}/chat/completions`;
        
        // 根据不同模型优化参数
        let temperature, max_tokens;
        
        if (provider === 'deepseek') {
            // DeepSeek喜欢稍低的温度和更多的token
            temperature = 0.1;
            max_tokens = 4096;
        } else if (provider === 'glm') {
            // GLM-4对温度不太敏感，使用中等值
            temperature = 0.3;
            max_tokens = 2048;
        } else {
            // 默认参数
            temperature = 0.3;
            max_tokens = 2000;
        }
        
        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: temperature,
            max_tokens: max_tokens
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

    // 优化的语言检测函数
    detectLanguage(text) {
        // 统计各种语言字符的出现频率
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
        const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
        const arabicChars = (text.match(/[\u0600-\u06ff]/g) || []).length;
        const russianChars = (text.match(/[\u0400-\u04ff]/g) || []).length;
        const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
        
        // 找出出现最多的字符类型
        const maxChars = Math.max(chineseChars, japaneseChars, koreanChars, arabicChars, russianChars, latinChars);
        
        if (maxChars === 0) return 'en'; // 默认英语
        
        if (chineseChars === maxChars) {
            return 'zh-CN';
        } else if (japaneseChars === maxChars) {
            return 'ja';
        } else if (koreanChars === maxChars) {
            return 'ko';
        } else if (arabicChars === maxChars) {
            return 'ar';
        } else if (russianChars === maxChars) {
            return 'ru';
        } else {
            // 拉丁字母可能是英语、法语、德语、西班牙语等
            // 进一步基于常见词判断
            const englishCommonWords = /\b(the|and|is|in|it|you|that|he|was|for|on|are|as|with|his|they|I|at|be|this|have|from|or|one|had|by|word|but|not|what|all|were|we|when|your|can|said|there|use|an|each|which|she|do|how|their|if|will|up|other|about|out|many|then|them|these|so|some|her|would|make|like|him|into|time|has|look|two|more|write|go|see|number|no|way|could|people|my|than|first|water|been|call|who|oil|its|now|find|long|down|day|did|get|come|made|may|part)\b/i;
            const frenchCommonWords = /\b(le|la|les|de|du|des|un|une|et|est|en|que|qui|dans|ce|il|ne|sur|se|pas|plus|par|je|avec|tout|faire|son|mais|nous|comme|ou|si|leur|y|dire|elle|avant|deux|même|premier|tous|temps|bien|où|sans|celui|cette|après|entre|encore|nouveau|petit|mettre|si|autre|trois|aller|vouloir|ne|homme|quel|grand|aussi|très|donner|celle|faire|sous|jour|mais|quand|car|falloir|nouveau)\b/i;
            const germanCommonWords = /\b(der|die|das|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als|auch|es|werden|aus|er|hat|dass|dieser|ein|war|vom|noch|werden|bei|wir|nach|worden|zum|warum|ob|obwohl|wenn|denn|sondern|sei|habe|bin|bist|ist|sind|seid|mein|dein|sein|ihr|unser|euer|ihr|Ihr|unser|euer)\b/i;
            const spanishCommonWords = /\b(el|la|de|que|y|a|en|un|ser|se|no|haber|con|su|por|para|como|estar|tener|le|lo|todo|pero|más|hacer|o|poder|decir|este|ir|otro|ese|cuando|mucho|quien|donde|desde|todo|sin|sobre|ser|tener|le|lo|como|más|hacer|o|poder|decir|este|ir|otro|ese|cuando|mucho|quien|donde|desde|todo|sin|sobre|entre|años|algún|me|hasta|ir|yo|le|lo|si|ya|ver|porque|esta|tanto|mi|tú|tu|tu|nuestro|nuestra|vuestro|vuestra|sus|su|sus)\b/i;
            
            if (frenchCommonWords.test(text)) return 'fr';
            if (germanCommonWords.test(text)) return 'de';
            if (spanishCommonWords.test(text)) return 'es';
            
            return 'en'; // 默认英语
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
    } else if (request.action === 'translateBatch') {
        handleBatchTranslate(request, sendResponse);
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

// 处理批量翻译请求
async function handleBatchTranslate(request, sendResponse) {
    console.log('Handling batch translation request for', request.texts.length, 'texts');
    
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

        console.log('Loaded config for batch translation:', result);

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

        // 批量翻译 - 根据不同API优化批次大小
        const translations = [];
        let batchSize;
        
        if (result.apiProvider === 'deepseek') {
            batchSize = 15; // DeepSeek处理速度快，可以用较大批次
        } else if (result.apiProvider === 'glm') {
            batchSize = 12; // GLM-4速度中等
        } else {
            batchSize = 8; // Google翻译API限制较多，使用较小批次
        }
        
        for (let i = 0; i < request.texts.length; i += batchSize) {
            const batch = request.texts.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}, texts ${i+1}-${Math.min(i+batchSize, request.texts.length)}`);
            
            const batchPromises = batch.map(text => 
                api.translate(
                    result,
                    text,
                    result.targetLanguage || 'zh',
                    result.translationStyle || 'formal'
                ).catch(error => {
                    console.error('Translation error for text:', text, 'error:', error);
                    return `[翻译失败: ${error.message}]`;
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            translations.push(...batchResults);
            
            // 添加延迟避免API限制 - 根据不同API优化
            if (i + batchSize < request.texts.length) {
                let delay;
                if (result.apiProvider === 'deepseek') {
                    delay = 50; // DeepSeek限制较少
                } else if (result.apiProvider === 'glm') {
                    delay = 100; // GLM需要适中延迟
                } else {
                    delay = 200; // Google免费API需要更长延迟
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('Batch translation completed successfully');

        sendResponse({
            success: true,
            translations: translations,
            provider: result.apiProvider
        });

    } catch (error) {
        console.error('Batch translation error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}