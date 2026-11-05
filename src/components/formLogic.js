export const formLogicFn = (t) => {
    window.formData = function () {
        // Inline parseSurgeConfigInput to make it available in toString()
        const parseSurgeValue = (rawValue = '') => {
            const trimmed = rawValue.trim();
            if (trimmed === '') return '';
            const unquoted = trimmed.replace(/^"(.*)"$/, '$1');
            const lower = unquoted.toLowerCase();
            if (lower === 'true') return true;
            if (lower === 'false') return false;
            if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted);
            return unquoted;
        };

        const convertSurgeIniToJson = (content) => {
            const lines = content.split(/\r?\n/);
            const config = {};
            let currentSection = null;
            const ensureObject = (key) => {
                if (!config[key]) config[key] = {};
                return config[key];
            };
            const ensureArray = (key) => {
                if (!config[key]) config[key] = [];
                return config[key];
            };
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith(';') || line.startsWith('#')) continue;
                const sectionMatch = line.match(/^\[(.+)]$/);
                if (sectionMatch) {
                    currentSection = sectionMatch[1].trim();
                    continue;
                }
                if (!currentSection) continue;
                const sectionName = currentSection.toLowerCase();
                if (sectionName === 'general' || sectionName === 'replica') {
                    const equalsIndex = line.indexOf('=');
                    if (equalsIndex === -1) continue;
                    const key = line.slice(0, equalsIndex).trim();
                    const value = line.slice(equalsIndex + 1).trim();
                    if (!key) continue;
                    const target = ensureObject(sectionName);
                    target[key] = parseSurgeValue(value);
                } else if (sectionName === 'proxy') {
                    ensureArray('proxies').push(line);
                } else if (sectionName === 'proxy group') {
                    ensureArray('proxy-groups').push(line);
                } else if (sectionName === 'rule') {
                    ensureArray('rules').push(line);
                } else {
                    ensureArray(sectionName).push(line);
                }
            }
            if (!config.general && !config.replica && !config.proxies && !config['proxy-groups']) {
                throw new Error('Unable to parse Surge INI content');
            }
            return config;
        };

        const parseSurgeConfigInput = (content) => {
            const trimmed = content.trim();
            if (!trimmed) throw new Error('Config content is empty');
            try {
                return { configObject: JSON.parse(trimmed), convertedFromIni: false };
            } catch {
                const converted = convertSurgeIniToJson(content);
                return { configObject: converted, convertedFromIni: true };
            }
        };

        return {
            input: '',
            ownerToken: '',
            currentUser: null,
            currentView: 'home',
            editSubscriptionId: '',
            authMode: 'login',
            authUsername: '',
            authPassword: '',
            authMessage: '',
            authLoading: false,
            authMenuOpen: false,
            subscriptionName: '',
            subscriptions: [],
            subscriptionsLoading: false,
            activeCopyMenuId: '',
            copiedSubscriptionId: '',
            subscriptionMessage: '',
            activeSubscriptionId: '',
            subscriptionToken: '',
            subscriptionTokenInput: '',
            stableLinks: null,
            savingSubscription: false,
            sources: [],
            managedNodes: [],
            nodeSearch: '',
            showAdvanced: false,
            // Accordion states for each section (二级手风琴状态)
            accordionSections: {
                rules: true,        // 规则选择 - 默认展开
                customRules: false, // 自定义规则
                general: false,     // 通用设置
                baseConfig: false,  // 基础配置
                ua: false          // User Agent
            },
            selectedRules: [],
            selectedPredefinedRule: 'balanced',
            previewSources: [],
            previewNodes: [],
            previewRules: [],
            previewPredefinedRule: 'balanced',
            pendingDeleteSourceId: '',
            pendingDeleteSourceName: '',
            toastMessage: '',
            toastType: 'success',
            toastTimer: null,
            subconverterCopied: false,
            groupByCountry: false,
            includeAutoSelect: true,
            enableClashUI: false,
            externalController: '',
            externalUiDownloadUrl: '',
            configType: 'singbox',
            configEditor: '',
            savingConfig: false,
            currentConfigId: '',
            saveConfigText: '',
            savingConfigText: '',
            configContentRequiredText: '',
            configSaveFailedText: '',
            configValidationState: '',
            configValidationMessage: '',
            customUA: '',
            parsingUrl: false,
            parseDebounceTimer: null,

            init() {
                const initialUrlParams = new URLSearchParams(window.location.search);
                this.currentView = initialUrlParams.get('view') === 'subscriptions' ? 'subscriptions' : 'home';
                this.editSubscriptionId = initialUrlParams.get('edit') || '';

                // Load translations
                if (window.APP_TRANSLATIONS) {
                    this.saveConfigText = window.APP_TRANSLATIONS.saveConfig;
                    this.savingConfigText = window.APP_TRANSLATIONS.savingConfig;
                    this.configContentRequiredText = window.APP_TRANSLATIONS.configContentRequired;
                    this.configSaveFailedText = window.APP_TRANSLATIONS.configSaveFailed;
                }

                // Load saved data
                this.input = localStorage.getItem('inputTextarea') || '';
                this.ownerToken = this.getOrCreateOwnerToken();
                this.subscriptionName = localStorage.getItem('subscriptionName') || '';
                this.sources = this.loadSavedSources(this.input);
                this.managedNodes = this.loadSavedNodes();
                this.reconcileManagedNodeSourceIds();
                this.syncInputFromSources();
                this.showAdvanced = localStorage.getItem('advancedToggle') === 'true';
                this.groupByCountry = localStorage.getItem('groupByCountry') === 'true';
                this.includeAutoSelect = localStorage.getItem('includeAutoSelect') !== 'false';
                this.enableClashUI = localStorage.getItem('enableClashUI') === 'true';
                this.externalController = localStorage.getItem('externalController') || '';
                this.externalUiDownloadUrl = localStorage.getItem('externalUiDownloadUrl') || '';
                this.customUA = localStorage.getItem('userAgent') || '';
                this.configEditor = localStorage.getItem('configEditor') || '';
                this.configType = localStorage.getItem('configType') || 'singbox';
                this.currentConfigId = initialUrlParams.get('configId') || '';

                // Load accordion states
                const savedAccordion = localStorage.getItem('accordionSections');
                if (savedAccordion) {
                    try {
                        this.accordionSections = JSON.parse(savedAccordion);
                    } catch (e) {
                        // If parsing fails, keep defaults
                    }
                }

                // Initialize rules
                this.applyPredefinedRule();
                if (this.currentView === 'home' && !this.editSubscriptionId) {
                    this.resetSubscriptionDraft();
                }

                // Watchers to save state
                this.$watch('input', val => {
                    localStorage.setItem('inputTextarea', val);
                    this.handleInputChange(val);
                });
                this.$watch('subscriptionName', val => localStorage.setItem('subscriptionName', val));
                this.$watch('showAdvanced', val => localStorage.setItem('advancedToggle', val));
                this.$watch('groupByCountry', val => localStorage.setItem('groupByCountry', val));
                this.$watch('includeAutoSelect', val => localStorage.setItem('includeAutoSelect', val));
                this.$watch('enableClashUI', val => localStorage.setItem('enableClashUI', val));
                this.$watch('externalController', val => localStorage.setItem('externalController', val));
                this.$watch('externalUiDownloadUrl', val => localStorage.setItem('externalUiDownloadUrl', val));
                this.$watch('customUA', val => localStorage.setItem('userAgent', val));
                this.$watch('configEditor', val => {
                    localStorage.setItem('configEditor', val);
                    this.resetConfigValidation();
                });
                this.$watch('configType', val => {
                    localStorage.setItem('configType', val);
                    this.resetConfigValidation();
                });
                this.$watch('accordionSections', val => localStorage.setItem('accordionSections', JSON.stringify(val)), { deep: true });

                this.generatePreview();
                this.loadCurrentUser();
            },

            toggleAccordion(section) {
                this.accordionSections[section] = !this.accordionSections[section];
            },

            createClientToken(length = 32) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                if (window.crypto && window.crypto.getRandomValues) {
                    const values = new Uint8Array(length);
                    window.crypto.getRandomValues(values);
                    return Array.from(values, value => chars[value % chars.length]).join('');
                }
                return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            },

            getOrCreateOwnerToken() {
                const existing = localStorage.getItem('subscriptionOwnerToken');
                if (existing) return existing;
                const token = this.createClientToken(36);
                localStorage.setItem('subscriptionOwnerToken', token);
                return token;
            },

            createEmptySource(index = 0) {
                return {
                    id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: '',
                    content: '',
                    enabled: true,
                    parsing: false,
                    imported: false,
                    nodeCount: 0,
                    error: ''
                };
            },

            getSourceKind(source) {
                const content = (source?.content || '').trim().toLowerCase();
                return content.startsWith('http://') || content.startsWith('https://') ? 'subscription' : 'node';
            },

            getSourceAutoName(source, index) {
                const kind = this.getSourceKind(source);
                const sameKindBefore = this.sources
                    .slice(0, index)
                    .filter(item => this.getSourceKind(item) === kind)
                    .length;
                const prefix = kind === 'subscription' ? '订阅链接' : '节点链接';
                return `${prefix} #${sameKindBefore + 1}`;
            },

            loadSavedSources(fallbackInput = '') {
                const saved = localStorage.getItem('subscriptionSources');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            return parsed.map((source, index) => ({
                                id: source.id || `src_${index + 1}`,
                                name: '',
                                content: source.content || '',
                                enabled: source.enabled !== false,
                                parsing: false,
                                imported: source.imported === true,
                                nodeCount: Number(source.nodeCount) || 0,
                                error: source.error || ''
                            }));
                        }
                    } catch { }
                }
                return [{ ...this.createEmptySource(0), content: fallbackInput || '' }];
            },

            persistSources() {
                localStorage.setItem('subscriptionSources', JSON.stringify(this.sources));
            },

            loadSavedNodes() {
                const saved = localStorage.getItem('managedNodes');
                if (!saved) return [];
                try {
                    const parsed = JSON.parse(saved);
                    if (!Array.isArray(parsed)) return [];
                    return parsed.map((node, index) => this.normalizeManagedNode(node, index)).filter(Boolean);
                } catch {
                    return [];
                }
            },

            persistNodes() {
                localStorage.setItem('managedNodes', JSON.stringify(this.managedNodes));
            },

            normalizeManagedNode(node, index = 0) {
                if (!node || typeof node !== 'object' || !node.proxy || typeof node.proxy !== 'object') return null;
                const name = (node.name || node.proxy.tag || node.proxy.name || `节点 ${index + 1}`).trim();
                if (!name || !node.proxy.type) return null;
                return {
                    id: node.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    sourceId: node.sourceId || '',
                    name,
                    type: node.type || node.proxy.type,
                    enabled: node.enabled !== false,
                    proxy: {
                        ...node.proxy,
                        tag: name
                    }
                };
            },

            reconcileManagedNodeSourceIds() {
                const sourceIds = new Set(this.sources.map(source => source?.id).filter(Boolean));
                if (sourceIds.size === 0 || this.managedNodes.length === 0) return;

                const hasValidSourceId = node => node?.sourceId && sourceIds.has(node.sourceId);
                const unlinkedNodes = this.managedNodes.filter(node => !hasValidSourceId(node));
                if (unlinkedNodes.length === 0) return;

                if (this.sources.length === 1) {
                    unlinkedNodes.forEach(node => {
                        node.sourceId = this.sources[0].id;
                    });
                    return;
                }

                if (this.sources.length !== this.managedNodes.length) return;

                this.managedNodes.forEach((node, index) => {
                    const source = this.sources[index];
                    if (!hasValidSourceId(node) && source?.id) {
                        node.sourceId = source.id;
                    }
                });
            },

            sortObjectKeys(value) {
                if (Array.isArray(value)) return value.map(item => this.sortObjectKeys(item));
                if (!value || typeof value !== 'object') return value;
                return Object.keys(value)
                    .sort()
                    .reduce((result, key) => {
                        result[key] = this.sortObjectKeys(value[key]);
                        return result;
                    }, {});
            },

            getNodeFingerprint(node) {
                const proxy = node?.proxy;
                if (!proxy || typeof proxy !== 'object') return '';
                const comparable = { ...proxy };
                delete comparable.tag;
                delete comparable.name;
                return JSON.stringify(this.sortObjectKeys(comparable));
            },

            mergeImportedNodes(source, importedNodes) {
                const existingByFingerprint = new Map();
                this.managedNodes.forEach(node => {
                    const fingerprint = this.getNodeFingerprint(node);
                    if (fingerprint) existingByFingerprint.set(fingerprint, node);
                });

                const importedFingerprints = new Set(importedNodes.map(node => this.getNodeFingerprint(node)).filter(Boolean));
                const mergedNodes = importedNodes.map(node => {
                    const existing = existingByFingerprint.get(this.getNodeFingerprint(node));
                    if (!existing) return node;
                    return {
                        ...node,
                        id: existing.id,
                        name: existing.name,
                        enabled: existing.enabled !== false,
                        proxy: {
                            ...node.proxy,
                            tag: existing.name
                        }
                    };
                });

                this.managedNodes = [
                    ...this.managedNodes.filter(node => {
                        const fingerprint = this.getNodeFingerprint(node);
                        return node.sourceId !== source.id && (!fingerprint || !importedFingerprints.has(fingerprint));
                    }),
                    ...mergedNodes
                ];
            },

            getManagedNodesInput() {
                const outbounds = this.managedNodes
                    .filter(node => node.enabled !== false)
                    .map(node => ({
                        ...node.proxy,
                        tag: node.name
                    }))
                    .filter(proxy => proxy && proxy.tag && proxy.type);
                return outbounds.length > 0 ? JSON.stringify({ outbounds }) : '';
            },

            syncInputFromSources() {
                const managedInput = this.getManagedNodesInput();
                this.input = managedInput || this.sources
                    .filter(source => source.enabled !== false)
                    .map(source => (source.content || '').trim())
                    .filter(Boolean)
                    .join('\n');
                this.persistSources();
                this.persistNodes();
            },

            showToast(message, type = 'success') {
                if (!message) return;
                this.toastMessage = message;
                this.toastType = type;
                if (this.toastTimer) {
                    clearTimeout(this.toastTimer);
                }
                this.toastTimer = setTimeout(() => {
                    this.toastMessage = '';
                    this.toastTimer = null;
                }, 2200);
            },

            addSource() {
                this.sources.push(this.createEmptySource(this.sources.length));
                this.persistSources();
                this.showToast('已添加输入源');
            },

            removeSource(index) {
                const source = this.sources[index];
                if (!source) return;
                if (this.sources.length <= 1) {
                    this.managedNodes = [];
                    this.sources[0] = {
                        ...this.sources[0],
                        content: '',
                        imported: false,
                        nodeCount: 0,
                        error: ''
                    };
                    this.syncInputFromSources();
                    this.showToast('节点链接已清空');
                    return;
                }
                this.managedNodes = this.managedNodes.filter(node => node.sourceId !== source.id);
                this.sources.splice(index, 1);
                this.syncInputFromSources();
                this.showToast('输入源已删除');
            },

            moveSource(index, direction) {
                const nextIndex = index + direction;
                if (nextIndex < 0 || nextIndex >= this.sources.length) return;
                const [source] = this.sources.splice(index, 1);
                this.sources.splice(nextIndex, 0, source);
                this.syncInputFromSources();
                this.showToast(direction < 0 ? '输入源已上移' : '输入源已下移');
            },

            handleSourceContentChange(index) {
                const source = this.sources[index];
                if (!source) return;
                source.imported = false;
                source.nodeCount = 0;
                source.error = '';
                this.managedNodes = this.managedNodes.filter(node => node.sourceId !== source.id);
                this.syncInputFromSources();
            },

            resetSubscriptionDraft() {
                this.activeSubscriptionId = '';
                this.editSubscriptionId = '';
                this.subscriptionToken = '';
                this.subscriptionTokenInput = '';
                this.stableLinks = null;
                this.subscriptionName = '';
                this.sources = [this.createEmptySource(0)];
                this.managedNodes = [];
                this.syncInputFromSources();
                this.generatePreview();
            },

            openNewSubscription() {
                window.location.href = '/';
            },

            editSubscription(id) {
                if (!id) return;
                window.location.href = `/?edit=${encodeURIComponent(id)}`;
            },

            async loadCurrentUser() {
                try {
                    const response = await fetch('/api/auth/me');
                    if (!response.ok) throw new Error(await response.text());
                    const data = await response.json();
                    this.currentUser = data.user || null;
                    if (this.currentUser) {
                        await this.loadSubscriptions();
                        if (this.currentView === 'home' && this.editSubscriptionId) {
                            await this.loadSubscription(this.editSubscriptionId);
                        }
                    } else {
                        this.subscriptions = [];
                    }
                } catch (error) {
                    console.error('Failed to load current user:', error);
                    this.currentUser = null;
                    this.subscriptions = [];
                }
            },

            async submitAuth() {
                this.authLoading = true;
                this.authMessage = '';
                try {
                    const response = await fetch(`/api/auth/${this.authMode === 'register' ? 'register' : 'login'}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: this.authUsername,
                            password: this.authPassword
                        })
                    });
                    const responseText = await response.text();
                    if (!response.ok) throw new Error(responseText || response.statusText);
                    const data = JSON.parse(responseText);
                    this.currentUser = data.user;
                    this.authPassword = '';
                    this.authMessage = this.authMode === 'register' ? '注册成功' : '登录成功';
                    this.authMenuOpen = false;
                    await this.loadSubscriptions();
                    if (this.currentView === 'home' && this.editSubscriptionId) {
                        await this.loadSubscription(this.editSubscriptionId);
                    }
                } catch (error) {
                    console.error('Auth failed:', error);
                    this.authMessage = error?.message || '认证失败';
                } finally {
                    this.authLoading = false;
                }
            },

            async logout() {
                try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                } catch (error) {
                    console.error('Logout failed:', error);
                }
                this.currentUser = null;
                this.authMenuOpen = false;
                this.subscriptions = [];
                this.activeSubscriptionId = '';
                this.subscriptionToken = '';
                this.subscriptionTokenInput = '';
                this.stableLinks = null;
            },

            buildStableLinks(token) {
                if (!token) return null;
                const origin = window.location.origin;
                return {
                    xray: `${origin}/sub/${token}/xray`,
                    singbox: `${origin}/sub/${token}/singbox`,
                    clash: `${origin}/sub/${token}/clash`,
                    surge: `${origin}/sub/${token}/surge`
                };
            },

            formatDate(value) {
                if (!value) return '';
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return '';
                return date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            },

            copySubscriptionLink(token, type = 'clash', subscriptionId = '') {
                const links = this.buildStableLinks(token);
                const url = links?.[type] || links?.clash;
                if (!url) return;
                navigator.clipboard.writeText(url).then(() => {
                    this.showToast('订阅链接已复制');
                    if (subscriptionId) {
                        this.copiedSubscriptionId = subscriptionId;
                        setTimeout(() => {
                            if (this.copiedSubscriptionId === subscriptionId) {
                                this.copiedSubscriptionId = '';
                            }
                        }, 2000);
                    }
                }).catch(() => {});
            },

            getCustomRulesPayload() {
                try {
                    const customRulesInput = document.querySelector('input[name="customRules"]');
                    return customRulesInput && customRulesInput.value ? JSON.parse(customRulesInput.value) : [];
                } catch {
                    return [];
                }
            },

            getBaseConfigPayload() {
                const content = (this.configEditor || '').trim();
                if (!content) return null;
                if (this.configType === 'clash') {
                    if (!window.jsyaml || !window.jsyaml.load) {
                        throw new Error(window.APP_TRANSLATIONS.parserUnavailable || 'Parser unavailable. Please refresh and try again.');
                    }
                    return window.jsyaml.load(content);
                }
                if (this.configType === 'surge') {
                    return parseSurgeConfigInput(this.configEditor).configObject;
                }
                return JSON.parse(content);
            },

            buildSubscriptionPayload() {
                this.syncInputFromSources();
                return {
                    ownerToken: this.ownerToken,
                    token: this.subscriptionTokenInput.trim(),
                    name: (this.subscriptionName || '').trim() || `我的订阅 ${new Date().toLocaleDateString()}`,
                    sources: this.sources.map((source, index) => ({
                        id: source.id,
                        name: this.getSourceAutoName(source, index),
                        content: source.content,
                        enabled: source.enabled !== false
                    })),
                    nodes: this.managedNodes.map(node => ({
                        id: node.id,
                        sourceId: node.sourceId,
                        name: node.name,
                        type: node.type,
                        enabled: node.enabled !== false,
                        proxy: {
                            ...node.proxy,
                            tag: node.name
                        }
                    })),
                    options: {
                        selectedRules: this.selectedRules,
                        customRules: this.getCustomRulesPayload(),
                        groupByCountry: this.groupByCountry,
                        includeAutoSelect: this.includeAutoSelect,
                        enableClashUI: this.enableClashUI,
                        externalController: this.externalController,
                        externalUiDownloadUrl: this.externalUiDownloadUrl,
                        ua: this.customUA,
                        configType: this.configType,
                        baseConfig: this.getBaseConfigPayload()
                    }
                };
            },

            async loadSubscriptions() {
                if (!this.currentUser) return;
                this.subscriptionsLoading = true;
                try {
                    const response = await fetch('/api/subscriptions');
                    if (!response.ok) throw new Error(await response.text());
                    const data = await response.json();
                    this.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
                } catch (error) {
                    console.error('Failed to load subscriptions:', error);
                    this.subscriptionMessage = `加载订阅失败：${error?.message || 'Unknown error'}`;
                } finally {
                    this.subscriptionsLoading = false;
                }
            },

            async loadSubscription(id) {
                if (!this.currentUser) {
                    this.subscriptionMessage = '请先登录';
                    return;
                }
                if (!id) return;
                try {
                    const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`);
                    if (!response.ok) throw new Error(await response.text());
                    const data = await response.json();
                    const subscription = data.subscription;
                    this.activeSubscriptionId = subscription.id;
                    this.subscriptionToken = subscription.token;
                    this.subscriptionTokenInput = subscription.token;
                    this.subscriptionName = subscription.name || '';
                    this.sources = this.loadSavedSources('');
                    if (Array.isArray(subscription.sources) && subscription.sources.length > 0) {
                        this.sources = subscription.sources.map((source, index) => ({
                            id: source.id || `src_${index + 1}`,
                            name: '',
                            content: source.content || '',
                            enabled: source.enabled !== false
                        }));
                    }
                    this.managedNodes = Array.isArray(subscription.nodes)
                        ? subscription.nodes.map((node, index) => this.normalizeManagedNode(node, index)).filter(Boolean)
                        : [];
                    this.reconcileManagedNodeSourceIds();
                    const options = subscription.options || {};
                    this.selectedRules = Array.isArray(options.selectedRules) ? options.selectedRules : [];
                    this.selectedPredefinedRule = 'custom';
                    this.groupByCountry = options.groupByCountry === true;
                    this.includeAutoSelect = options.includeAutoSelect !== false;
                    this.enableClashUI = options.enableClashUI === true;
                    this.externalController = options.externalController || '';
                    this.externalUiDownloadUrl = options.externalUiDownloadUrl || '';
                    this.customUA = options.ua || '';
                    this.configType = options.configType || 'singbox';
                    this.configEditor = options.baseConfig ? JSON.stringify(options.baseConfig, null, 2) : '';
                    if (Array.isArray(options.customRules)) {
                        window.dispatchEvent(new CustomEvent('restore-custom-rules', {
                            detail: { rules: options.customRules }
                        }));
                    }
                    this.stableLinks = this.buildStableLinks(subscription.token);
                    this.syncInputFromSources();
                    this.generatePreview();
                    this.showAdvanced = true;
                } catch (error) {
                    console.error('Failed to load subscription:', error);
                    this.subscriptionMessage = `载入订阅失败：${error?.message || 'Unknown error'}`;
                }
            },

            async saveSubscription() {
                if (this.savingSubscription) return;
                if (!this.currentUser) {
                    this.subscriptionMessage = '请先登录后再保存订阅';
                    return;
                }
                this.savingSubscription = true;
                this.subscriptionMessage = '';
                try {
                    const payload = this.buildSubscriptionPayload();
                    const isUpdate = Boolean(this.activeSubscriptionId);
                    const response = await fetch(isUpdate ? `/api/subscriptions/${encodeURIComponent(this.activeSubscriptionId)}` : '/api/subscriptions', {
                        method: isUpdate ? 'PUT' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const responseText = await response.text();
                    if (!response.ok) throw new Error(responseText || response.statusText);
                    const data = JSON.parse(responseText);
                    const subscription = data.subscription;
                    this.activeSubscriptionId = subscription.id;
                    this.subscriptionToken = subscription.token;
                    this.subscriptionTokenInput = subscription.token;
                    this.subscriptionName = subscription.name;
                    this.stableLinks = this.buildStableLinks(subscription.token);
                    this.subscriptionMessage = isUpdate ? '订阅已更新' : '订阅已保存';
                    this.showToast(isUpdate ? '订阅已更新' : '订阅已保存');
                    await this.loadSubscriptions();
                    this.generatePreview();
                } catch (error) {
                    console.error('Failed to save subscription:', error);
                    this.subscriptionMessage = `保存订阅失败：${error?.message || 'Unknown error'}`;
                    this.showToast(this.subscriptionMessage, 'error');
                } finally {
                    this.savingSubscription = false;
                }
            },

            async deleteSubscription() {
                if (!this.currentUser) {
                    this.subscriptionMessage = '请先登录';
                    return;
                }
                if (!this.activeSubscriptionId) return;
                if (!confirm('确定要删除当前订阅吗？')) return;
                try {
                    const response = await fetch(`/api/subscriptions/${encodeURIComponent(this.activeSubscriptionId)}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) throw new Error(await response.text());
                    this.subscriptionMessage = '订阅已删除';
                    this.resetSubscriptionDraft();
                    await this.loadSubscriptions();
                    this.showToast('订阅已删除');
                } catch (error) {
                    console.error('Failed to delete subscription:', error);
                    this.subscriptionMessage = `删除订阅失败：${error?.message || 'Unknown error'}`;
                }
            },

            async deleteSubscriptionById(id) {
                if (!this.currentUser) {
                    this.subscriptionMessage = '请先登录';
                    return;
                }
                if (!id) return;
                if (!confirm('确定要删除这个订阅吗？')) return;
                try {
                    const response = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) throw new Error(await response.text());
                    if (this.activeSubscriptionId === id) {
                        this.resetSubscriptionDraft();
                    }
                    this.subscriptionMessage = '订阅已删除';
                    await this.loadSubscriptions();
                    this.showToast('订阅已删除');
                } catch (error) {
                    console.error('Failed to delete subscription:', error);
                    this.subscriptionMessage = `删除订阅失败：${error?.message || 'Unknown error'}`;
                }
            },

            async parseSource(index) {
                const source = this.sources[index];
                if (!source || !(source.content || '').trim()) {
                    this.subscriptionMessage = '请先输入节点链接或订阅链接';
                    return;
                }
                source.parsing = true;
                source.error = '';
                source.imported = false;
                this.persistSources();
                try {
                    const response = await fetch('/api/parse-source', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: source.content,
                            ua: this.customUA
                        })
                    });
                    const responseText = await response.text();
                    if (!response.ok) throw new Error(responseText || response.statusText);
                    const data = JSON.parse(responseText);
                    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
                    if (nodes.length === 0) throw new Error('No valid nodes found');
                    const importedNodes = nodes
                        .map((node, nodeIndex) => this.normalizeManagedNode({
                            ...node,
                            sourceId: source.id,
                            name: node.name || `${this.getSourceAutoName(source, index)}-${nodeIndex + 1}`
                        }, nodeIndex))
                        .filter(Boolean);
                    this.mergeImportedNodes(source, importedNodes);
                    source.imported = true;
                    source.nodeCount = importedNodes.length;
                    this.subscriptionMessage = `已导入 ${importedNodes.length} 个节点`;
                    this.showToast(`已导入 ${importedNodes.length} 个节点`);
                    this.syncInputFromSources();
                } catch (error) {
                    console.error('Failed to parse source:', error);
                    source.error = error?.message || 'Parse failed';
                    source.imported = false;
                    source.nodeCount = 0;
                    this.subscriptionMessage = `校验失败：${source.error}`;
                    this.persistSources();
                } finally {
                    source.parsing = false;
                    this.persistSources();
                }
            },

            updateNodeName(index, name) {
                const node = this.filteredManagedNodes[index];
                if (!node) return;
                const target = this.managedNodes.find(item => item.id === node.id);
                if (!target) return;
                target.name = name;
                target.proxy = {
                    ...target.proxy,
                    tag: name
                };
                this.syncInputFromSources();
            },

            moveNodeById(id, direction) {
                const index = this.managedNodes.findIndex(node => node.id === id);
                const nextIndex = index + direction;
                if (index < 0 || nextIndex < 0 || nextIndex >= this.managedNodes.length) return;
                const [node] = this.managedNodes.splice(index, 1);
                this.managedNodes.splice(nextIndex, 0, node);
                this.syncInputFromSources();
                this.showToast(direction < 0 ? '节点已上移' : '节点已下移');
            },

            removeNodeById(id) {
                const node = this.managedNodes.find(item => item.id === id);
                if (!node) return;

                const source = node.sourceId
                    ? this.sources.find(item => item.id === node.sourceId)
                    : null;

                this.managedNodes = this.managedNodes.filter(item => item.id !== id);

                if (source) {
                    const remainingSourceNodes = this.managedNodes.filter(item => item.sourceId === source.id);
                    source.nodeCount = remainingSourceNodes.length;
                    source.imported = remainingSourceNodes.length > 0;
                    source.error = '';

                    if (remainingSourceNodes.length === 0 && this.getSourceKind(source) === 'node') {
                        const sourceIndex = this.sources.findIndex(item => item.id === source.id);
                        this.pendingDeleteSourceId = source.id;
                        this.pendingDeleteSourceName = sourceIndex >= 0
                            ? this.getSourceAutoName(source, sourceIndex)
                            : '节点链接';
                    }
                }

                if (this.sources.length === 0) {
                    this.sources = [this.createEmptySource(0)];
                }
                this.syncInputFromSources();
                this.showToast('节点已删除');
            },

            confirmPendingDeleteSource() {
                const sourceId = this.pendingDeleteSourceId;
                this.pendingDeleteSourceId = '';
                this.pendingDeleteSourceName = '';

                const sourceIndex = this.sources.findIndex(source => source.id === sourceId);
                if (sourceIndex >= 0) {
                    this.removeSource(sourceIndex);
                    return;
                }

                this.syncInputFromSources();
            },

            cancelPendingDeleteSource() {
                this.pendingDeleteSourceId = '';
                this.pendingDeleteSourceName = '';
                this.syncInputFromSources();
                this.showToast('已保留节点链接');
            },

            get filteredManagedNodes() {
                const keyword = (this.nodeSearch || '').trim().toLowerCase();
                if (!keyword) return this.managedNodes;
                return this.managedNodes.filter(node =>
                    (node.name || '').toLowerCase().includes(keyword) ||
                    (node.type || '').toLowerCase().includes(keyword)
                );
            },

            applyPredefinedRule() {
                if (this.selectedPredefinedRule === 'custom') return;

                // PREDEFINED_RULE_SETS will be injected globally
                const rules = window.PREDEFINED_RULE_SETS;
                if (rules && rules[this.selectedPredefinedRule]) {
                    this.selectedRules = rules[this.selectedPredefinedRule];
                }
            },

            getSubconverterUrl() {
                const origin = window.location.origin;
                const params = new URLSearchParams();

                // Use preset name directly if a predefined rule set is selected
                if (this.selectedPredefinedRule && this.selectedPredefinedRule !== 'custom') {
                    params.append('selectedRules', this.selectedPredefinedRule);
                } else if (this.selectedPredefinedRule === 'custom') {
                    params.append('selectedRules', JSON.stringify(this.selectedRules));
                }

                // Include customRules when available (best-effort; may make URL long)
                try {
                    const customRulesInput = document.querySelector('input[name="customRules"]');
                    const customRules = customRulesInput && customRulesInput.value ? JSON.parse(customRulesInput.value) : [];
                    if (Array.isArray(customRules) && customRules.length > 0) {
                        params.append('customRules', JSON.stringify(customRules));
                    }
                } catch { }

                if (!this.includeAutoSelect) {
                    params.append('include_auto_select', 'false');
                }

                if (this.groupByCountry) {
                    params.append('group_by_country', 'true');
                }

                // Include lang parameter so subconverter gets correct group names
                const appLang = window.APP_LANG || 'zh-CN';
                if (appLang !== 'zh-CN') {
                    params.append('lang', appLang);
                }

                const queryString = params.toString();
                return origin + '/subconverter' + (queryString ? '?' + queryString : '');
            },

            copySubconverterUrl() {
                const url = this.getSubconverterUrl();
                navigator.clipboard.writeText(url).then(() => {
                    this.subconverterCopied = true;
                    this.showToast('配置地址已复制');
                    setTimeout(() => this.subconverterCopied = false, 2000);
                }).catch(() => {});
            },

            resetConfigValidation() {
                this.configValidationState = '';
                this.configValidationMessage = '';
            },

            async saveBaseConfig() {
                const content = (this.configEditor || '').trim();
                if (!content) {
                    alert(this.configContentRequiredText || window.APP_TRANSLATIONS.configContentRequired);
                    return;
                }

                let payloadContent = this.configEditor;
                if (this.configType === 'surge') {
                    try {
                        const { configObject } = parseSurgeConfigInput(this.configEditor);
                        payloadContent = JSON.stringify(configObject);
                    } catch (parseError) {
                        const prefix = window.APP_TRANSLATIONS.configValidationError || 'Config validation error:';
                        alert(`${prefix} ${parseError?.message || ''}`.trim());
                        return;
                    }
                }

                this.savingConfig = true;
                try {
                    const response = await fetch('/config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: this.configType,
                            content: payloadContent
                        })
                    });
                    const responseText = await response.text();
                    if (!response.ok) {
                        throw new Error(responseText || response.statusText || 'Request failed');
                    }
                    const configId = responseText.trim();
                    if (!configId) {
                        throw new Error('Missing config ID');
                    }
                    this.currentConfigId = configId;
                    this.updateConfigIdInUrl(configId);

                    const successMessage = window.APP_TRANSLATIONS.saveConfigSuccess || 'Configuration saved successfully!';
                    this.showToast(`${successMessage} ID: ${configId}`);
                } catch (error) {
                    console.error('Failed to save base config:', error);
                    const errorPrefix = this.configSaveFailedText || window.APP_TRANSLATIONS.configSaveFailed || 'Failed to save configuration';
                    alert(`${errorPrefix}: ${error?.message || 'Unknown error'}`);
                } finally {
                    this.savingConfig = false;
                }
            },

            validateBaseConfig() {
                const content = (this.configEditor || '').trim();
                if (!content) {
                    this.configValidationState = 'error';
                    this.configValidationMessage = this.configContentRequiredText || window.APP_TRANSLATIONS.configContentRequired;
                    return;
                }

                try {
                    if (this.configType === 'clash') {
                        if (!window.jsyaml || !window.jsyaml.load) {
                            throw new Error(window.APP_TRANSLATIONS.parserUnavailable || 'Parser unavailable. Please refresh and try again.');
                        }
                        window.jsyaml.load(content);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validYamlConfig || 'YAML config is valid';
                        this.showToast('配置校验通过');
                    } else if (this.configType === 'surge') {
                        parseSurgeConfigInput(this.configEditor);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validJsonConfig || 'JSON config is valid';
                        this.showToast('配置校验通过');
                    } else {
                        JSON.parse(content);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validJsonConfig || 'JSON config is valid';
                        this.showToast('配置校验通过');
                    }
                } catch (error) {
                    this.configValidationState = 'error';
                    const prefix = window.APP_TRANSLATIONS.configValidationError || 'Config validation error: ';
                    this.configValidationMessage = `${prefix}${error?.message || ''}`;
                }
            },

            clearBaseConfig() {
                if (confirm(window.APP_TRANSLATIONS.confirmClearConfig)) {
                    this.configEditor = '';
                    localStorage.removeItem('configEditor');
                    this.currentConfigId = '';
                    this.updateConfigIdInUrl(null);
                    this.showToast('基础配置已清空');
                }
            },

            updateConfigIdInUrl(configId) {
                const url = new URL(window.location.href);
                if (configId) {
                    url.searchParams.set('configId', configId);
                } else {
                    url.searchParams.delete('configId');
                }
                window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
            },

            // Handle input change with debounce
            handleInputChange(val) {
                // Clear previous timer
                if (this.parseDebounceTimer) {
                    clearTimeout(this.parseDebounceTimer);
                }

                // If input is empty, don't try to parse
                if (!val || !val.trim()) {
                    return;
                }

                // Debounce for 500ms
                this.parseDebounceTimer = setTimeout(() => {
                    this.tryParseSubscriptionUrl(val.trim());
                }, 500);
            },

            // Check if input looks like a subscription URL
            isSubscriptionUrl(text) {
                // Check if it's a single line URL (not multiple lines)
                if (text.includes('\n')) {
                    return false;
                }

                try {
                    const url = new URL(text);
                    // Check if it matches our short link pattern: /[bcxs]/[code]
                    const pathMatch = url.pathname.match(/^\/([bcxs])\/([a-zA-Z0-9_-]+)$/);
                    if (pathMatch) {
                        return true;
                    }

                    // Check if it's a full subscription URL with query params
                    const fullMatch = url.pathname.match(/^\/(singbox|clash|xray|surge)$/);
                    if (fullMatch && url.search) {
                        return true;
                    }

                    return false;
                } catch {
                    return false;
                }
            },

            // Try to parse subscription URL
            async tryParseSubscriptionUrl(text) {
                if (!this.isSubscriptionUrl(text)) {
                    return;
                }

                this.parsingUrl = true;
                try {
                    let urlToParse;

                    try {
                        urlToParse = new URL(text);
                    } catch {
                        return;
                    }

                    // Check if it's a short link
                    const shortMatch = urlToParse.pathname.match(/^\/([bcxs])\/([a-zA-Z0-9_-]+)$/);

                    if (shortMatch) {
                        // It's a short link, resolve it first
                        const response = await fetch(`/resolve?url=${encodeURIComponent(text)}`);
                        if (!response.ok) {
                            console.warn('Failed to resolve short URL');
                            return;
                        }

                        const data = await response.json();
                        if (!data.originalUrl) {
                            console.warn('No original URL returned');
                            return;
                        }

                        urlToParse = new URL(data.originalUrl);
                    }

                    // Now parse the full URL and populate form
                    this.populateFormFromUrl(urlToParse);
                    this.generatePreview();

                    // Show a success message
                    const message = window.APP_TRANSLATIONS?.urlParsedSuccess || '已成功解析订阅链接配置';
                    this.showToast(message);

                } catch (error) {
                    console.error('Error parsing subscription URL:', error);
                } finally {
                    this.parsingUrl = false;
                }
            },

            // Populate form fields from parsed URL
            populateFormFromUrl(url) {
                const params = new URLSearchParams(url.search);

                // Extract config (the original subscription URLs)
                const config = params.get('config');
                if (config) {
                    this.input = config;
                }

                // Extract selectedRules
                const selectedRules = params.get('selectedRules');
                if (selectedRules) {
                    try {
                        const parsed = JSON.parse(selectedRules);
                        if (Array.isArray(parsed)) {
                            this.selectedRules = parsed;
                            this.selectedPredefinedRule = 'custom';
                        }
                    } catch (e) {
                        console.warn('Failed to parse selectedRules:', e);
                    }
                }

                // Extract customRules
                const customRules = params.get('customRules');
                if (customRules) {
                    try {
                        const parsed = JSON.parse(customRules);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            // Dispatch custom event for CustomRules component to listen
                            window.dispatchEvent(new CustomEvent('restore-custom-rules', {
                                detail: { rules: parsed }
                            }));
                        }
                    } catch (e) {
                        console.warn('Failed to parse customRules:', e);
                    }
                }

                // Extract other parameters
                this.groupByCountry = params.get('group_by_country') === 'true';
                this.includeAutoSelect = params.get('include_auto_select') !== 'false';
                this.enableClashUI = params.get('enable_clash_ui') === 'true';

                const externalController = params.get('external_controller');
                if (externalController) {
                    this.externalController = externalController;
                }

                const externalUiDownloadUrl = params.get('external_ui_download_url');
                if (externalUiDownloadUrl) {
                    this.externalUiDownloadUrl = externalUiDownloadUrl;
                }

                const ua = params.get('ua');
                if (ua) {
                    this.customUA = ua;
                }

                const configId = params.get('configId');
                if (configId) {
                    this.currentConfigId = configId;
                    this.updateConfigIdInUrl(configId);
                }

                // Expand advanced options if any advanced settings are present
                if (selectedRules || customRules || this.groupByCountry || this.includeAutoSelect || this.enableClashUI ||
                    externalController || externalUiDownloadUrl || ua || configId) {
                    this.showAdvanced = true;
                }
            },

            generatePreview(showFeedback = false) {
                this.previewSources = JSON.parse(JSON.stringify(this.sources));
                this.previewNodes = JSON.parse(JSON.stringify(this.managedNodes));
                this.previewRules = JSON.parse(JSON.stringify(this.selectedRules));
                this.previewPredefinedRule = this.selectedPredefinedRule;
                if (showFeedback) {
                    this.showToast('预览已更新');
                }
            }
        }
    }
};
