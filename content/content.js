// Content Script - 处理页面内的划词翻译和页面翻译

let currentSelection = '';

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