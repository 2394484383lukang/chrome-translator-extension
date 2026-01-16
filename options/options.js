// 设置页面逻辑
document.addEventListener('DOMContentLoaded', function() {
    const apiProviderRadios = document.querySelectorAll('input[name="apiProvider"]');
    const deepseekApiKey = document.getElementById('deepseekApiKey');
    const deepseekModel = document.getElementById('deepseekModel');
    const glmApiKey = document.getElementById('glmApiKey');
    const glmModel = document.getElementById('glmModel');
    const targetLanguage = document.getElementById('targetLanguage');
    const translationStyle = document.getElementById('translationStyle');
    const autoTranslateOnSelection = document.getElementById('autoTranslateOnSelection');
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusMessage = document.getElementById('statusMessage');

    // 加载已保存的设置
    loadSettings();

    // API提供商切换
    apiProviderRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            toggleProviderConfig(this.value);
        });
    });

    // 保存设置
    saveBtn.addEventListener('click', function() {
        saveSettings();
    });

    // 测试连接
    testBtn.addEventListener('click', function() {
        testConnection();
    });

    // 重置设置
    resetBtn.addEventListener('click', function() {
        if (confirm('确定要重置所有设置吗？')) {
            resetSettings();
        }
    });

    function loadSettings() {
        chrome.storage.local.get([
            'apiProvider',
            'deepseekConfig',
            'glmConfig',
            'targetLanguage',
            'translationStyle',
            'autoTranslateOnSelection'
        ], function(result) {
            // 设置API提供商
            if (result.apiProvider) {
                const radio = document.querySelector(`input[name="apiProvider"][value="${result.apiProvider}"]`);
                if (radio) radio.checked = true;
                toggleProviderConfig(result.apiProvider);
            }

            // 设置DeepSeek配置
            if (result.deepseekConfig) {
                deepseekApiKey.value = result.deepseekConfig.apiKey || '';
                deepseekModel.value = result.deepseekConfig.model || 'deepseek-chat';
            }

            // 设置GLM配置
            if (result.glmConfig) {
                glmApiKey.value = result.glmConfig.apiKey || '';
                glmModel.value = result.glmConfig.model || 'glm-4';
            }

            // 设置翻译配置
            if (result.targetLanguage) {
                targetLanguage.value = result.targetLanguage;
            }
            if (result.translationStyle) {
                translationStyle.value = result.translationStyle;
            }
            
            // 设置自动翻译开关
            if (result.autoTranslateOnSelection !== undefined) {
                autoTranslateOnSelection.checked = result.autoTranslateOnSelection;
            } else {
                autoTranslateOnSelection.checked = false; // 默认关闭
            }
        });
    }

    function saveSettings() {
        const apiProvider = document.querySelector('input[name="apiProvider"]:checked').value;
        
        const settings = {
            apiProvider: apiProvider,
            deepseekConfig: {
                apiKey: deepseekApiKey.value.trim(),
                model: deepseekModel.value
            },
            glmConfig: {
                apiKey: glmApiKey.value.trim(),
                model: glmModel.value
            },
            targetLanguage: targetLanguage.value,
            translationStyle: translationStyle.value,
            autoTranslateOnSelection: autoTranslateOnSelection.checked
        };

        // 验证必填字段（Google翻译不需要API Key）
        if (apiProvider === 'deepseek' && !settings.deepseekConfig.apiKey) {
            showStatus('请输入DeepSeek API Key', 'error');
            return;
        }
        if (apiProvider === 'glm' && !settings.glmConfig.apiKey) {
            showStatus('请输入GLM API Key', 'error');
            return;
        }
        // Google翻译不需要API Key，直接保存

        chrome.storage.local.set(settings, function() {
            showStatus('设置保存成功！', 'success');
        });
    }

    function testConnection() {
        const apiProvider = document.querySelector('input[name="apiProvider"]:checked').value;
        
        // 验证API Key是否已配置
        if (apiProvider === 'deepseek' && !deepseekApiKey.value.trim()) {
            showStatus('请先输入DeepSeek API Key', 'error');
            return;
        }
        if (apiProvider === 'glm' && !glmApiKey.value.trim()) {
            showStatus('请先输入GLM API Key', 'error');
            return;
        }
        // Google翻译不需要API Key验证
        
        // 临时保存当前表单配置用于测试
        const tempSettings = {
            apiProvider: apiProvider,
            deepseekConfig: {
                apiKey: deepseekApiKey.value.trim(),
                model: deepseekModel.value
            },
            glmConfig: {
                apiKey: glmApiKey.value.trim(),
                model: glmModel.value
            },
            targetLanguage: targetLanguage.value,
            translationStyle: translationStyle.value
        };
        
        const testText = 'Hello, world!';

        showStatus('正在测试连接...', 'info');

        // 先临时保存配置
        chrome.storage.local.set(tempSettings, function() {
            // 然后进行测试
            chrome.runtime.sendMessage({
                action: 'translate',
                text: testText,
                mode: 'test'
            }, function(response) {
                if (response && response.success) {
                    showStatus('✅ 连接测试成功！翻译结果：' + response.translation, 'success');
                } else {
                    showStatus('❌ 连接测试失败：' + (response ? response.error : '未知错误'), 'error');
                }
            });
        });
    }

    function resetSettings() {
        chrome.storage.local.clear(function() {
            // 清空表单
            deepseekApiKey.value = '';
            deepseekModel.value = 'deepseek-chat';
            glmApiKey.value = '';
            glmModel.value = 'glm-4';
            targetLanguage.value = 'zh';
            translationStyle.value = 'formal';
            autoTranslateOnSelection.checked = false; // 重置为关闭
            
            // 重置为默认提供商
            const defaultRadio = document.querySelector('input[name="apiProvider"][value="deepseek"]');
            defaultRadio.checked = true;
            toggleProviderConfig('deepseek');
            
            showStatus('设置已重置', 'success');
        });
    }

    function toggleProviderConfig(provider) {
        const deepseekSection = document.querySelector('.deepseek-config');
        const glmSection = document.querySelector('.glm-config');
        const googleSection = document.querySelector('.google-config');

        deepseekSection.classList.add('hidden');
        glmSection.classList.add('hidden');
        googleSection.classList.add('hidden');

        if (provider === 'deepseek') {
            deepseekSection.classList.remove('hidden');
        } else if (provider === 'glm') {
            glmSection.classList.remove('hidden');
        } else if (provider === 'google') {
            googleSection.classList.remove('hidden');
        }
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
        
        // 移除之前的定时器（如果存在）
        if (statusMessage.timeoutId) {
            clearTimeout(statusMessage.timeoutId);
        }
        
        // 设置新的定时器，10秒后自动隐藏
        statusMessage.timeoutId = setTimeout(function() {
            statusMessage.className = 'status-message';
        }, 10000);
    }
});