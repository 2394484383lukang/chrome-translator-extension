// Popup界面逻辑
document.addEventListener('DOMContentLoaded', function() {
    const optionsBtn = document.getElementById('optionsBtn');
    const selectionMode = document.getElementById('selectionMode');
    const pageMode = document.getElementById('pageMode');
    const inputText = document.getElementById('inputText');
    const translateBtn = document.getElementById('translateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const outputText = document.getElementById('outputText');
    const copyBtn = document.getElementById('copyBtn');
    const statusText = document.getElementById('statusText');
    const apiProvider = document.getElementById('apiProvider');

    let currentMode = 'selection';

    // 打开设置页面
    optionsBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });

    // 模式切换
    selectionMode.addEventListener('click', function() {
        currentMode = 'selection';
        selectionMode.classList.add('active');
        pageMode.classList.remove('active');
        inputText.placeholder = '选择要翻译的文本，或点击页面翻译...';
    });

    pageMode.addEventListener('click', function() {
        currentMode = 'page';
        pageMode.classList.add('active');
        selectionMode.classList.remove('active');
        inputText.placeholder = '点击翻译按钮翻译整个页面...';
    });

    // 获取当前选中的文本
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelection'}, function(response) {
            if (response && response.text) {
                inputText.value = response.text;
            }
        });
    });

    // 翻译按钮
    translateBtn.addEventListener('click', async function() {
        const text = inputText.value.trim();
        
        if (currentMode === 'page') {
            // 页面翻译模式
            showStatus('正在翻译页面...', 'loading');
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'translatePage'}, function(response) {
                    if (chrome.runtime.lastError) {
                        showStatus('请刷新页面后重试', 'error');
                    } else {
                        showStatus('页面翻译已启动', 'success');
                    }
                });
            });
            return;
        }
        
        // 划词翻译模式
        if (!text) {
            showStatus('请输入或选择要翻译的文本', 'error');
            return;
        }

        showStatus('正在翻译...', 'loading');
        translateBtn.disabled = true;

        try {
            const result = await translateText(text, currentMode);
            outputText.textContent = result;
            showStatus('翻译完成', 'success');
        } catch (error) {
            outputText.textContent = '翻译失败: ' + error.message;
            showStatus('翻译失败: ' + error.message, 'error');
        } finally {
            translateBtn.disabled = false;
        }
    });

    // 清除按钮
    clearBtn.addEventListener('click', function() {
        inputText.value = '';
        outputText.textContent = '';
        showStatus('已清除', 'ready');
    });

    // 复制按钮
    copyBtn.addEventListener('click', function() {
        const text = outputText.textContent;
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                showStatus('已复制到剪贴板', 'success');
            });
        }
    });

    // 显示状态信息
    function showStatus(message, type) {
        statusText.textContent = message;
        statusText.style.color = getStatusColor(type);
    }

    function getStatusColor(type) {
        switch(type) {
            case 'error': return '#e74c3c';
            case 'success': return '#27ae60';
            case 'loading': return '#f39c12';
            default: return '#888';
        }
    }

    // 翻译文本
    async function translateText(text, mode) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'translate',
                text: text,
                mode: mode
            }, function(response) {
                if (response && response.success) {
                    resolve(response.translation);
                } else {
                    reject(new Error(response ? response.error : '未知错误'));
                }
            });
        });
    }

    // 加载API配置信息
    loadApiConfig();
});

async function loadApiConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiProvider', 'deepseekConfig', 'glmConfig'], function(result) {
            const apiProvider = document.getElementById('apiProvider');
            if (result.apiProvider) {
                const providerName = {
                    'deepseek': 'DeepSeek',
                    'glm': 'GLM4.7',
                    'google': '免费翻译'
                }[result.apiProvider] || result.apiProvider;
                apiProvider.textContent = `当前API: ${providerName}`;
            } else {
                apiProvider.textContent = '请先配置API';
                apiProvider.style.color = '#e74c3c';
            }
            resolve();
        });
    });
}