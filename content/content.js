// Content Script - 处理页面内的划词翻译和页面翻译

let currentSelection = '';
let autoTranslateEnabled = false;

// 监听文本选择事件
document.addEventListener('mouseup', function(event) {
    // 检查是否启用了自动翻译
    chrome.storage.local.get(['autoTranslateOnSelection'], function(result) {
        autoTranslateEnabled = result.autoTranslateOnSelection || false;
        
        if (autoTranslateEnabled) {
            // 延迟一点确保选择完成
            setTimeout(function() {
                const selection = window.getSelection().toString().trim();
                if (selection && selection.length > 0) {
                    currentSelection = selection;
                    // 获取鼠标位置
                    const x = event.clientX;
                    const y = event.clientY;
                    // 显示翻译气泡
                    showTranslationBubble(x, y, selection);
                }
            }, 100);
        }
    });
});

// 移除自动弹出气泡功能，只保留右键菜单和popup翻译

// 监听来自popup和background的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content script received message:', request.action);
    
    if (request.action === 'getSelection') {
        sendResponse({text: currentSelection || window.getSelection().toString().trim()});
    } else if (request.action === 'translateSelection') {
        translateAndShow(request.text);
    } else if (request.action === 'translatePage') {
        translatePage();
    } else if (request.action === 'translatePageInline') {
        translatePageInline();
    } else if (request.action === 'toggleTranslations') {
        toggleTranslations();
        sendResponse({success: true});
    } else if (request.action === 'showTranslation') {
        showTranslationResult(request.result);
    } else if (request.action === 'showRightClickTranslation') {
        showRightClickTranslation(request.text);
    }
    return true;
});

// 创建翻译气泡
function createTranslationBubble() {
    let bubble = document.getElementById('ai-translator-bubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'ai-translator-bubble';
        bubble.className = 'ai-translator-bubble';
        document.body.appendChild(bubble);
    }
    return bubble;
}

// 显示翻译气泡
function showTranslationBubble(x, y, text) {
    const bubble = createTranslationBubble();
    
    bubble.innerHTML = `
        <div class="bubble-header">
            <span class="bubble-title">🌐 翻译中...</span>
            <button class="bubble-close">×</button>
        </div>
        <div class="bubble-content">
            <div class="translation-result loading">正在翻译...</div>
            <div class="translation-actions">
                <div class="provider-selector">
                    <button class="switch-provider-btn">🔄 切换翻译源</button>
                    <div class="provider-dropdown">
                        <div class="provider-option" data-provider="deepseek">
                            <span class="provider-icon">🤖</span>
                            <span class="provider-name">DeepSeek</span>
                        </div>
                        <div class="provider-option" data-provider="glm">
                            <span class="provider-icon">🧠</span>
                            <span class="provider-name">GLM4.7</span>
                        </div>
                        <div class="provider-option" data-provider="google">
                            <span class="provider-icon">🌐</span>
                            <span class="provider-name">免费翻译</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 定位气泡
    let posX = x + 10;
    let posY = y + 10;
    
    // 防止超出屏幕
    if (posX + 300 > window.innerWidth) {
        posX = window.innerWidth - 310;
    }
    if (posY + 200 > window.innerHeight) {
        posY = y - 210;
    }
    
    bubble.style.left = posX + 'px';
    bubble.style.top = posY + 'px';
    bubble.style.display = 'block';
    
    // 绑定事件
    const closeBtn = bubble.querySelector('.bubble-close');
    const switchBtn = bubble.querySelector('.switch-provider-btn');
    const dropdown = bubble.querySelector('.provider-dropdown');
    const providerOptions = bubble.querySelectorAll('.provider-option');
    
    closeBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        hideTranslationBubble();
    });
    
    // 切换下拉框显示/隐藏
    switchBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        
        // 关闭所有其他下拉框
        document.querySelectorAll('.provider-dropdown.show').forEach(d => {
            d.classList.remove('show');
        });
        
        // 切换当前下拉框
        if (!isOpen) {
            dropdown.classList.add('show');
            switchBtn.classList.add('active');
        } else {
            dropdown.classList.remove('show');
            switchBtn.classList.remove('active');
        }
    });
    
    // 选择翻译源
    providerOptions.forEach(option => {
        option.addEventListener('click', function(event) {
            event.stopPropagation();
            const selectedProvider = this.getAttribute('data-provider');
            
            // 关闭下拉框并移除active状态
            dropdown.classList.remove('show');
            switchBtn.classList.remove('active');
            
            switchToSpecificProvider(text, bubble, selectedProvider);
        });
    });
    
    // 点击其他地方关闭下拉框
    const globalClickHandler = function(event) {
        if (bubble && !bubble.contains(event.target)) {
            dropdown.classList.remove('show');
            switchBtn.classList.remove('active');
        }
    };
    
    document.addEventListener('click', globalClickHandler);
    
    // 清理事件监听器（当气泡关闭时）
    const originalHideBubble = hideTranslationBubble;
    hideTranslationBubble = function() {
        document.removeEventListener('click', globalClickHandler);
        originalHideBubble();
    };
    
    // 防止点击气泡内容时触发其他事件
    bubble.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    // 自动开始翻译
    setTimeout(() => {
        translateInBubble(text, bubble);
    }, 100);
}

// 隐藏翻译气泡
function hideTranslationBubble() {
    const bubble = document.getElementById('ai-translator-bubble');
    if (bubble) {
        bubble.style.display = 'none';
    }
}

// 在气泡中翻译
function translateInBubble(text, bubble) {
    const resultDiv = bubble.querySelector('.translation-result');
    const titleDiv = bubble.querySelector('.bubble-title');
    
    resultDiv.innerHTML = '<div class="loading">正在翻译...</div>';
    
    chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        mode: 'selection'
    }, function(response) {
        if (response && response.success) {
            resultDiv.textContent = response.translation;
            const providerName = {
                'deepseek': 'DeepSeek',
                'glm': 'GLM4.7', 
                'google': '免费翻译'
            }[response.provider] || response.provider;
            titleDiv.textContent = `✅ ${providerName}`;
        } else {
            resultDiv.textContent = '翻译失败: ' + (response ? response.error : '未知错误');
            titleDiv.textContent = '❌ 翻译失败';
        }
    });
}

// 切换到指定翻译源
function switchToSpecificProvider(text, bubble, provider) {
    chrome.storage.local.set({ apiProvider: provider }, function() {
        const resultDiv = bubble.querySelector('.translation-result');
        const titleDiv = bubble.querySelector('.bubble-title');
        
        resultDiv.innerHTML = '<div class="loading">正在切换翻译源...</div>';
        titleDiv.textContent = '🔄 切换中...';
        
        setTimeout(() => {
            translateInBubble(text, bubble);
        }, 300);
    });
}

// 翻译页面
function translatePage() {
    const bodyText = document.body.innerText;
    
    if (!bodyText || bodyText.trim().length === 0) {
        alert('页面内容为空，无法翻译');
        return;
    }
    
    console.log('Starting page translation, text length:', bodyText.length);
    
    // 显示进度提示
    const progressDiv = document.createElement('div');
    progressDiv.id = 'page-translation-progress';
    progressDiv.className = 'page-translation-progress';
    progressDiv.innerHTML = '<div class="progress-content">正在翻译页面，请稍候...</div>';
    document.body.appendChild(progressDiv);
    
    chrome.runtime.sendMessage({
        action: 'translate',
        text: bodyText.substring(0, 5000), // 限制长度避免API超时
        mode: 'page'
    }, function(response) {
        console.log('Page translation response:', response);
        
        if (progressDiv.parentNode) {
            document.body.removeChild(progressDiv);
        }
        
        if (response && response.success) {
            showTranslationResult(response.translation);
        } else {
            alert('页面翻译失败: ' + (response ? response.error : '未知错误'));
        }
    });
}

// 右键菜单翻译
function showRightClickTranslation(text) {
    console.log('Showing right click translation for:', text);
    
    // 获取鼠标位置或使用默认位置
    const x = event ? event.clientX : 200;
    const y = event ? event.clientY : 200;
    
    showTranslationBubble(x, y, text);
}

// 辅助函数：翻译并显示
function translateAndShow(text) {
    // 在鼠标位置显示气泡
    const x = 200;
    const y = 200;
    showTranslationBubble(x, y, text);
}

// 显示翻译结果（页面翻译）
function showTranslationResult(translation) {
    // 创建新窗口显示翻译结果
    const resultWindow = window.open('', '_blank', 'width=800,height=600');
    resultWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>页面翻译结果</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                h1 { color: #667eea; }
                .translation-content { white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <h1>页面翻译结果</h1>
            <div class="translation-content">${escapeHtml(translation)}</div>
        </body>
        </html>
    `);
    resultWindow.document.close();
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 悬浮球功能
let floatingBall = null;
let isTranslating = false;
let isTranslationVisible = true;

function createFloatingBall() {
    if (floatingBall) return;
    
    floatingBall = document.createElement('div');
    floatingBall.className = 'floating-ball';
    floatingBall.innerHTML = `
        <div class="floating-ball-icon">🌐</div>
        <div class="floating-ball-close">×</div>
    `;
    
    document.body.appendChild(floatingBall);
    
    const closeBtn = floatingBall.querySelector('.floating-ball-close');
    
    // 关闭悬浮球
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        hideFloatingBall();
    });
    
    // 点击悬浮球直接翻译页面
    floatingBall.addEventListener('click', function(e) {
        if (!e.target.closest('.floating-ball-close')) {
            handleFloatingBallClick();
        }
    });
}


function showFloatingBall() {
    if (!floatingBall) {
        createFloatingBall();
    }
    floatingBall.style.display = 'flex';
}

function hideFloatingBall() {
    if (floatingBall) {
        floatingBall.style.display = 'none';
    }
}

// 处理悬浮球点击
function handleFloatingBallClick() {
    if (isTranslating) {
        return; // 正在翻译中，忽略点击
    }
    
    const translations = document.querySelectorAll('.inline-translation');
    
    if (translations.length > 0) {
        // 已经翻译过，切换显示/隐藏
        toggleTranslations();
    } else {
        // 还没有翻译，开始翻译
        translatePageInline();
    }
}

// 切换翻译结果显示/隐藏
function toggleTranslations() {
    const translations = document.querySelectorAll('.inline-translation');
    
    if (translations.length === 0) {
        showToast('请先翻译页面');
        return;
    }
    
    isTranslationVisible = !isTranslationVisible;
    
    translations.forEach(translation => {
        translation.style.display = isTranslationVisible ? 'block' : 'none';
    });
    
    // 显示提示
    showToast(isTranslationVisible ? '显示翻译' : '显示原文');
}

// 显示提示信息
function showToast(message) {
    // 移除已存在的提示
    const existingToast = document.querySelector('.translation-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'translation-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// 检查是否显示悬浮球
chrome.storage.local.get(['showFloatingBall'], function(result) {
    if (result.showFloatingBall !== false) {
        showFloatingBall();
    }
});

// 监听悬浮球显示状态变化
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.showFloatingBall) {
        if (changes.showFloatingBall.newValue) {
            showFloatingBall();
        } else {
            hideFloatingBall();
        }
    }
    
    // 监听自动翻译设置变化
    if (namespace === 'local' && changes.autoTranslateOnSelection) {
        autoTranslateEnabled = changes.autoTranslateOnSelection.newValue || false;
        if (autoTranslateEnabled) {
            showToast('已启用选中文本自动翻译');
        } else {
            showToast('已关闭选中文本自动翻译');
        }
    }
});

// 内联翻译页面
function translatePageInline() {
    // 检查是否已经翻译过
    if (document.querySelector('.inline-translation')) {
        // 已经翻译过，切换显示状态
        toggleTranslations();
        return;
    }
    
    // 设置翻译状态
    isTranslating = true;
    
    // 显示进度提示
    const progressDiv = document.createElement('div');
    progressDiv.id = 'page-translation-progress';
    progressDiv.className = 'page-translation-progress';
    progressDiv.innerHTML = '<div class="progress-content">正在翻译页面，请稍候...</div>';
    document.body.appendChild(progressDiv);
    
    // 获取页面中所有文本节点
    const textNodes = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // 跳过空白节点和已经在翻译元素中的节点
                if (!node.textContent.trim() || 
                    node.parentElement.classList.contains('inline-translation') ||
                    node.parentElement.classList.contains('page-translation-progress') ||
                    node.parentElement.classList.contains('floating-ball') ||
                    node.parentElement.classList.contains('floating-ball-menu') ||
                    node.parentElement.classList.contains('floating-ball-menu-item') ||
                    node.parentElement.closest('.floating-ball')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    let node;
    while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length > 1) { // 只翻译长度大于1的文本
            // 跳过script、style、code等特殊标签的内容
            const parentTag = node.parentElement.tagName.toLowerCase();
            if (!['script', 'style', 'code', 'pre', 'noscript'].includes(parentTag)) {
                textNodes.push(node);
            }
        }
    }
    
    if (textNodes.length === 0) {
        if (progressDiv.parentNode) {
            document.body.removeChild(progressDiv);
        }
        alert('没有找到需要翻译的文本内容');
        return;
    }
    
    console.log(`Found ${textNodes.length} text nodes to translate`);
    
    // 获取API提供商配置，根据内容大小和API限制动态计算批大小
    chrome.storage.local.get(['apiProvider'], function(result) {
        // 分析待翻译内容的文本大小分布
        const textSizes = textNodes.map(node => node.textContent.length);
        const avgTextSize = textSizes.reduce((a, b) => a + b, 0) / textNodes.length;
        const maxTextSize = Math.max(...textSizes);
        
        // 不同API的文本长度限制（字符数）
        const apiLimits = {
            'deepseek': {
                maxLength: 16000,      // DeepSeek单次请求最大长度
                recommendedBatch: 8000, // 推荐单次处理长度
                maxNodes: 150          // 最大节点数
            },
            'glm': {
                maxLength: 12000,      // GLM-4单次请求最大长度
                recommendedBatch: 6000, // 推荐单次处理长度
                maxNodes: 120          // 最大节点数
            },
            'google': {
                maxLength: 500,        // Google免费API单次限制
                recommendedBatch: 400,  // 推荐单次处理长度
                maxNodes: 20           // 最大节点数
            },
            'default': {
                maxLength: 8000,
                recommendedBatch: 4000,
                maxNodes: 80
            }
        };
        
        const apiConfig = apiLimits[result.apiProvider] || apiLimits['default'];
        
        // 动态计算批大小
        let batchSize;
        
        if (result.apiProvider === 'google') {
            // Google API限制严格，基于字符数计算
            batchSize = Math.floor(apiConfig.recommendedBatch / Math.max(avgTextSize, 50));
            batchSize = Math.min(Math.max(batchSize, 5), apiConfig.maxNodes);
        } else {
            // AI API限制较宽松，可以处理更多节点
            if (avgTextSize < 50) {
                // 短文本较多，可以处理更多节点
                batchSize = Math.min(apiConfig.maxNodes, 100);
            } else if (avgTextSize < 200) {
                // 中等长度文本
                batchSize = Math.min(apiConfig.maxNodes, 80);
            } else {
                // 长文本，减少节点数避免超出长度限制
                batchSize = Math.floor(apiConfig.recommendedBatch / avgTextSize);
                batchSize = Math.max(Math.min(batchSize, 50), 20);
            }
        }
        
        console.log(`API: ${result.apiProvider}, Avg text size: ${Math.floor(avgTextSize)}, Calculated batch size: ${batchSize}`);
        
        translateBatchWithSize(batchSize, textNodes, progressDiv);
    });
}
    
    function translateBatchWithSize(batchSize, textNodes, progressDiv) {
        let translatedCount = 0;
        
        function translateBatch() {
            const batch = textNodes.slice(translatedCount, translatedCount + batchSize);
            if (batch.length === 0) {
            // 翻译完成
            isTranslating = false;
            if (progressDiv.parentNode) {
                document.body.removeChild(progressDiv);
            }
            showToast('翻译完成');
            console.log('Page translation completed');
            return;
        }
        
        // 更新进度
        progressDiv.innerHTML = `<div class="progress-content">正在翻译页面... (${Math.min(translatedCount + batchSize, textNodes.length)}/${textNodes.length})</div>`;
        
        // 翻译当前批次
        const textsToTranslate = batch.map(node => node.textContent.trim());
        
        chrome.runtime.sendMessage({
            action: 'translateBatch',
            texts: textsToTranslate
        }, function(response) {
            if (response && response.success && response.translations) {
                response.translations.forEach((translation, index) => {
                    if (translation && batch[index]) {
                        insertTranslationAfterNode(batch[index], translation);
                    }
                });
                
                translatedCount += batch.length;
                setTimeout(translateBatch, 100); // 减少延迟提高速度
            } else {
                isTranslating = false;
                if (progressDiv.parentNode) {
                    document.body.removeChild(progressDiv);
                }
                // 静默失败，不显示错误提示
                console.error('Translation failed:', response ? response.error : 'Unknown error');
            }
        });
    }
    
    translateBatch();
}

// 在文本节点后插入翻译结果
function insertTranslationAfterNode(textNode, translation) {
    const translationSpan = document.createElement('span');
    translationSpan.className = 'inline-translation';
    translationSpan.textContent = translation;
    
    // 创建包装器来保持原文和翻译在一起
    const wrapper = document.createElement('span');
    wrapper.className = 'translation-wrapper';
    
    // 获取文本节点的父元素
    const parent = textNode.parentNode;
    
    // 在文本节点后插入翻译
    if (textNode.nextSibling) {
        parent.insertBefore(translationSpan, textNode.nextSibling);
    } else {
        parent.appendChild(translationSpan);
    }
}