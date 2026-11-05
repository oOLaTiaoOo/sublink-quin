/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { DIRECT_DEFAULT_RULES, PREDEFINED_RULE_SETS, REJECT_ACTION_RULES, UNIFIED_RULES } from '../config/index.js';
import { formLogicFn } from './formLogic.js';

const LINK_FIELDS = [
  { key: 'xray', labelKey: 'xrayLink' },
  { key: 'singbox', labelKey: 'singboxLink' },
  { key: 'clash', labelKey: 'clashLink' },
  { key: 'surge', labelKey: 'surgeLink' }
];

const RULE_DESCRIPTIONS = {
  'Ad Block': '拦截广告和追踪器',
  'AI Services': 'ChatGPT、Claude、Copilot 等',
  Bilibili: '哔哩哔哩相关服务',
  Youtube: 'YouTube 视频服务',
  Google: 'Google 服务走代理',
  Private: '局域网和私有 IP 直连',
  'Location:CN': '国内网站和服务直连',
  Telegram: 'Telegram 消息服务',
  Github: '代码托管服务',
  Microsoft: '微软相关服务',
  Apple: '苹果相关服务',
  'Social Media': '海外社交媒体',
  Streaming: '海外流媒体',
  Gaming: '游戏平台',
  Education: '教育和学术资源',
  Financial: '金融支付服务',
  'Cloud Services': '云服务 and 网盘',
  'Non-China': '非中国域名走代理'
};

const RULE_ENTRY_LABELS = {
  private: {
    site: '私有网络',
    ip: '私有 IP'
  },
  openai: {
    site: 'OpenAI'
  },
  anthropic: {
    site: 'Anthropic (Claude)'
  },
  'category-ai-chat-!cn': {
    site: 'AI 服务合集'
  },
  'category-ads-all': {
    site: '广告域名'
  },
  'geolocation-!cn': {
    site: '非中国域名'
  },
  'geolocation-cn': {
    site: '国内域名（精简）'
  },
  cn: {
    site: '国内域名',
    ip: '国内 IP'
  }
};

function getRuleEntryLabel(name, type) {
  return RULE_ENTRY_LABELS[name]?.[type] || name;
}

function getRuleEntries(rule) {
  const siteRules = (rule.site_rules || []).map(name => ({
    name,
    label: getRuleEntryLabel(name, 'site'),
    kind: '域名',
    path: `geosite/${name}.mrs`,
    badge: '预设'
  }));
  const ipRules = (rule.ip_rules || []).map(name => ({
    name,
    label: getRuleEntryLabel(name, 'ip'),
    kind: 'IP',
    path: `geoip/${name}.mrs`,
    badge: 'no-resolve'
  }));
  return [...siteRules, ...ipRules];
}

function getRuleAction(ruleName) {
  if (REJECT_ACTION_RULES.has(ruleName)) {
    return { label: '拒绝', className: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-350 border-red-450' };
  }
  if (DIRECT_DEFAULT_RULES.has(ruleName)) {
    return { label: '直连', className: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-350 border-emerald-450' };
  }
  return { label: '代理', className: 'bg-[#eef9ff] dark:bg-gray-800 text-[#0aa3eb] dark:text-[#6ed4ff] border-[#0aa3eb]' };
}

export const Form = (props) => {
  const { t, lang } = props;

  const translations = {
    saveConfigSuccess: t('saveConfigSuccess'),
    saveConfig: t('saveConfig'),
    savingConfig: t('savingConfig'),
    configContentRequired: t('configContentRequired'),
    configSaveFailed: t('configSaveFailed'),
    confirmClearConfig: t('confirmClearConfig'),
    custom: t('custom'),
    minimal: t('minimal'),
    balanced: t('balanced'),
    comprehensive: t('comprehensive')
  };

  const scriptContent = `
    window.APP_TRANSLATIONS = ${JSON.stringify(translations)};
    window.PREDEFINED_RULE_SETS = ${JSON.stringify(PREDEFINED_RULE_SETS)};
    window.RULE_PREVIEW_META = ${JSON.stringify(UNIFIED_RULES.map(rule => ({
      name: rule.name,
      label: t(`outboundNames.${rule.name}`),
      description: RULE_DESCRIPTIONS[rule.name] || '自定义分流规则',
      action: getRuleAction(rule.name).label,
      actionClass: getRuleAction(rule.name).className,
      entries: getRuleEntries(rule).map(entry => ({
        label: entry.label,
        kind: entry.kind,
        path: entry.path
      }))
    })))};
    window.APP_LANG = ${JSON.stringify(lang || 'zh-CN')};
    if (typeof __name === 'undefined') { var __name = function(fn) { return fn; }; }
    (${formLogicFn.toString()})();
  `;

  return (
    <div x-data="formData()" x-init="init()" class="w-full flex-1 flex flex-col min-h-0">
      <div
        x-cloak
        x-show="toastMessage"
        class="fixed right-4 top-4 z-[80] max-w-[min(92vw,360px)] border-4 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-950 shadow-[4px_4px_0_#2c2523] dark:shadow-[4px_4px_0_#f7f5f0] px-4 py-3 flex items-center gap-3 font-pixel"
        x-bind:class="toastType === 'error' ? 'text-[#c21807]' : 'text-emerald-700 dark:text-emerald-300'"
        role="status"
      >
        <span class="w-7 h-7 border-2 border-[#2c2523] dark:border-[#f7f5f0] flex items-center justify-center shrink-0"
          x-bind:class="toastType === 'error' ? 'bg-[#c21807] text-white' : 'bg-emerald-600 text-white'"
        >
          <i class="fas text-xs" x-bind:class="toastType === 'error' ? 'fa-triangle-exclamation' : 'fa-check'"></i>
        </span>
        <span class="text-xs leading-5" x-text="toastMessage"></span>
      </div>

      <template x-teleport="#navbar-auth">
        <div class="relative" {...{'x-on:click.outside': 'authMenuOpen = false'}}>
          {/* Logged in state */}
          <div x-show="currentUser" class="h-10 pl-2 pr-3 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] text-sm font-semibold flex items-center gap-2.5 shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
            <div class="w-7 h-7 border border-[#2c2523] dark:border-[#f7f5f0] bg-[#c21807] text-white flex items-center justify-center font-bold text-xs uppercase select-none">
              <span x-text="currentUser?.username ? currentUser.username[0] : 'U'"></span>
            </div>
            <span class="max-w-28 truncate font-medium text-[#2c2523] dark:text-gray-200" x-text="currentUser?.username"></span>
            <div class="w-px h-4 bg-[#2c2523] dark:bg-gray-700"></div>
            <button type="button" x-on:click="logout()" class="w-7 h-7 text-gray-500 hover:text-[#c21807] transition-colors flex items-center justify-center" title="退出登录">
              <i class="fas fa-right-from-bracket text-xs"></i>
            </button>
          </div>

          {/* Logged out state */}
          <div x-show="!currentUser" class="relative">
            <button
              type="button"
              x-on:click="authMenuOpen = !authMenuOpen"
              class="nes-btn h-10 px-4 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] text-sm font-semibold flex items-center gap-2"
            >
              <i class="far fa-circle-user text-base text-gray-500"></i>
              <span>登录</span>
            </button>

            <div
              x-cloak
              x-show="authMenuOpen"
              class="absolute right-0 top-12 w-[min(92vw,360px)] nes-card p-5 z-[70]"
            >
              <div class="flex gap-2 mb-4 justify-end">
                <button
                  type="button"
                  x-on:click="authMode = 'login'; authMessage = ''"
                  class="px-3.5 py-1.5 border-2 border-[#2c2523] dark:border-[#f7f5f0] text-sm font-semibold transition-all duration-200"
                  x-bind:class="authMode === 'login' ? 'bg-[#c21807] text-white' : 'bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] hover:bg-gray-200 dark:hover:bg-gray-700'"
                >
                  登录
                </button>
                <button
                  type="button"
                  x-on:click="authMode = 'register'; authMessage = ''"
                  class="px-3.5 py-1.5 border-2 border-[#2c2523] dark:border-[#f7f5f0] text-sm font-semibold transition-all duration-200"
                  x-bind:class="authMode === 'register' ? 'bg-[#c21807] text-white' : 'bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] hover:bg-gray-200 dark:hover:bg-gray-600'"
                >
                  注册
                </button>
              </div>
              <form {...{'x-on:submit.prevent': 'submitAuth()'}} class="grid grid-cols-1 gap-2.5">
                <input
                  type="text"
                  x-model="authUsername"
                  autocomplete="username"
                  placeholder="用户名"
                  class="nes-input px-3 py-2 text-sm outline-none"
                />
                <input
                  type="password"
                  x-model="authPassword"
                  autocomplete="current-password"
                  placeholder="密码"
                  class="nes-input px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  x-bind:disabled="authLoading"
                  class="nes-btn mt-1 px-4 py-2 bg-[#c21807] text-white hover:bg-red-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  <i class="fas" x-bind:class="authLoading ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'"></i>
                  <span x-text="authMode === 'register' ? '注册' : '登录'">登录</span>
                </button>
              </form>
              <div x-show="authMessage" class="mt-2.5 text-xs text-red-500 dark:text-red-400 text-right" x-text="authMessage"></div>
            </div>
          </div>
        </div>
      </template>

      <div x-show="currentView === 'subscriptions'" class="space-y-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold text-[#2c2523] dark:text-white font-pixel">订阅总览</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 font-pixel">查看订阅数量、节点规模、源数量，并进入编辑。</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              x-on:click="loadSubscriptions()"
              x-bind:disabled="!currentUser || subscriptionsLoading"
              class="nes-btn px-4 py-2 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <i class="fas" x-bind:class="subscriptionsLoading ? 'fa-spinner fa-spin' : 'fa-rotate'"></i>
              刷新
            </button>
            <button
              type="button"
              x-on:click="openNewSubscription()"
              class="nes-btn px-4 py-2 bg-[#c21807] text-white hover:bg-red-700 font-semibold flex items-center gap-2"
            >
              <i class="fas fa-plus"></i>
              新建订阅
            </button>
          </div>
        </div>

        <div x-show="subscriptionMessage" class="border-2 border-[#2c2523] dark:border-[#f7f5f0] px-4 py-3 text-sm bg-white dark:bg-[#111827] text-[#2c2523] dark:text-[#f7f5f0]" x-text="subscriptionMessage"></div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="nes-card p-5">
            <div class="flex items-center gap-4">
              <span class="w-12 h-12 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-[#c21807] dark:text-red-400 flex items-center justify-center shrink-0">
                <i class="fas fa-file-code"></i>
              </span>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400 font-pixel">订阅数量</div>
                <div class="text-xl font-bold text-gray-900 dark:text-white font-press-start"><span x-text="subscriptions.length"></span></div>
              </div>
            </div>
          </div>
          <div class="nes-card p-5">
            <div class="flex items-center gap-4">
              <span class="w-12 h-12 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <i class="fas fa-server"></i>
              </span>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400 font-pixel">节点总数</div>
                <div class="text-xl font-bold text-gray-900 dark:text-white font-press-start"><span x-text="subscriptions.reduce((total, item) => total + (item.nodeCount || 0), 0)"></span></div>
              </div>
            </div>
          </div>
          <div class="nes-card p-5">
            <div class="flex items-center gap-4">
              <span class="w-12 h-12 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <i class="fas fa-link"></i>
              </span>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400 font-pixel">导入源</div>
                <div class="text-xl font-bold text-gray-900 dark:text-white font-press-start"><span x-text="subscriptions.reduce((total, item) => total + (item.sourceCount || 0), 0)"></span></div>
              </div>
            </div>
          </div>
          <div class="nes-card p-5">
            <div class="flex items-center gap-4">
              <span class="w-12 h-12 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <i class="fas fa-clock-rotate-left"></i>
              </span>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400 font-pixel">最近更新</div>
                <div class="text-xs font-semibold text-gray-900 dark:text-white font-pixel" x-text="formatDate(subscriptions[0]?.updatedAt) || '-'"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="nes-card p-6">
          <div class="flex items-center justify-between gap-4 mb-5">
            <h2 class="text-xl font-bold text-[#2c2523] dark:text-white font-pixel">订阅列表</h2>
            <span class="text-sm text-gray-500 dark:text-gray-400 font-pixel">共 <span x-text="subscriptions.length"></span> 个</span>
          </div>
          <div x-show="!currentUser" class="border-4 border-dashed border-gray-300 dark:border-gray-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400 font-pixel">
            登录后可以查看你的订阅列表。
          </div>
          <div x-show="currentUser && subscriptionsLoading" class="border-4 border-dashed border-gray-300 dark:border-gray-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400 font-pixel">
            <i class="fas fa-spinner fa-spin mr-2"></i>加载中...
          </div>
          <div x-show="currentUser && !subscriptionsLoading && subscriptions.length === 0" class="border-4 border-dashed border-gray-300 dark:border-gray-700 py-10 text-center">
            <div class="text-gray-900 dark:text-white font-semibold font-pixel">还没有订阅</div>
            <button type="button" x-on:click="openNewSubscription()" class="nes-btn mt-4 px-4 py-2 bg-[#c21807] text-white hover:bg-red-700 font-semibold inline-flex items-center gap-2">
              <i class="fas fa-plus"></i>
              新建订阅
            </button>
          </div>
          <div class="space-y-3" x-show="currentUser && subscriptions.length > 0">
            <template x-for="subscription in subscriptions" x-bind:key="subscription.id">
              <div class="border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/40 p-4 shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                <div class="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div class="flex items-start gap-3 min-w-0 flex-1">
                    <span class="w-10 h-10 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-800 text-[#c21807] flex items-center justify-center shrink-0">
                      <i class="fas fa-file-code"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white truncate font-pixel" x-text="subscription.name"></div>
                      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-2 font-pixel">
                        <span>创建 <span x-text="formatDate(subscription.createdAt)"></span></span>
                        <span>更新 <span x-text="formatDate(subscription.updatedAt)"></span></span>
                        <span><span x-text="subscription.enabledSourceCount"></span>/<span x-text="subscription.sourceCount"></span> 源</span>
                        <span><span x-text="subscription.nodeCount || 0"></span> 节点</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-wrap xl:justify-end gap-2">
                    <button type="button" x-on:click="editSubscription(subscription.id)" class="nes-btn px-3 py-2 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold flex items-center gap-2">
                      <i class="fas fa-gear text-xs"></i>
                      编辑
                    </button>
                    <div class="relative">
                      <button
                        type="button"
                        x-on:click="activeCopyMenuId = (activeCopyMenuId === subscription.id ? '' : subscription.id)"
                        class="nes-btn px-3 py-2 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                        x-bind:class="copiedSubscriptionId === subscription.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : ''"
                      >
                        <i class="fas" x-bind:class="copiedSubscriptionId === subscription.id ? 'fa-circle-check text-emerald-600 dark:text-emerald-400' : 'fa-copy'"></i>
                        <span x-text="copiedSubscriptionId === subscription.id ? '复制成功' : '复制链接'"></span>
                      </button>
                      {/* Dropdown for copy options */}
                      <div
                        x-show="activeCopyMenuId === subscription.id"
                        x-cloak
                        {...{'x-on:click.outside': "activeCopyMenuId = ''"}}
                        x-transition:enter="transition ease-out duration-150"
                        x-transition:enter-start="opacity-0 scale-95 translate-y-[-4px]"
                        x-transition:enter-end="opacity-100 scale-100 translate-y-0"
                        x-transition:leave="transition ease-in duration-100"
                        x-transition:leave-start="opacity-100 scale-100 translate-y-0"
                        x-transition:leave-end="opacity-0 scale-95 translate-y-[-4px]"
                        class="absolute right-0 top-full mt-1.5 w-40 nes-card py-1.5 z-50 flex flex-col select-none"
                      >
                        <button type="button" x-on:click="copySubscriptionLink(subscription.token, 'clash', subscription.id); activeCopyMenuId = ''" class="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[#c21807] dark:hover:text-[#c21807] text-[#2c2523] dark:text-gray-200 text-xs font-semibold text-left transition-all duration-150 flex items-center gap-2.5 hover:pl-5 font-pixel">
                          <span class="w-1.5 h-1.5 bg-[#c21807] shrink-0"></span>
                          Clash
                        </button>
                        <button type="button" x-on:click="copySubscriptionLink(subscription.token, 'singbox', subscription.id); activeCopyMenuId = ''" class="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[#c21807] dark:hover:text-[#c21807] text-[#2c2523] dark:text-gray-200 text-xs font-semibold text-left transition-all duration-150 flex items-center gap-2.5 hover:pl-5 font-pixel">
                          <span class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 shrink-0"></span>
                          Sing-Box
                        </button>
                        <button type="button" x-on:click="copySubscriptionLink(subscription.token, 'xray', subscription.id); activeCopyMenuId = ''" class="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[#c21807] dark:hover:text-[#c21807] text-[#2c2523] dark:text-gray-200 text-xs font-semibold text-left transition-all duration-150 flex items-center gap-2.5 hover:pl-5 font-pixel">
                          <span class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 shrink-0"></span>
                          Xray
                        </button>
                        <button type="button" x-on:click="copySubscriptionLink(subscription.token, 'surge', subscription.id); activeCopyMenuId = ''" class="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[#c21807] dark:hover:text-[#c21807] text-[#2c2523] dark:text-gray-200 text-xs font-semibold text-left transition-all duration-150 flex items-center gap-2.5 hover:pl-5 font-pixel">
                          <span class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 shrink-0"></span>
                          Surge
                        </button>
                      </div>
                    </div>
                    <button type="button" x-on:click="deleteSubscriptionById(subscription.id)" class="nes-btn px-3 py-2 bg-[#c21807] text-white hover:bg-red-700 text-sm font-semibold flex items-center gap-2">
                      <i class="fas fa-trash text-xs"></i>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div x-show="currentView === 'home'" class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] gap-6 items-stretch flex-1 min-h-0 xl:h-full">
        <section class="flex flex-col min-h-0 xl:h-full xl:overflow-hidden min-w-0">
          <div class="nes-card flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
            <div class="flex-1 xl:overflow-y-auto px-6 pt-6 pb-2 space-y-6">
              {/* Subscription Workspace */}
              <div class="space-y-4">
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-3">
                  <div>
                    <div class="flex items-center gap-3 mb-2">
                      <span class="w-8 h-8 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-[#c21807] flex items-center justify-center shrink-0">
                        <i class="fas fa-layer-group text-sm"></i>
                      </span>
                      <h2 class="text-lg font-bold text-[#2c2523] dark:text-white font-pixel">配置</h2>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 font-pixel">保存多源配置，生成订阅链接，后续修改无需更换客户端地址。</p>
                  </div>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 font-pixel">订阅名称</label>
                    <input
                      type="text"
                      x-model="subscriptionName"
                      placeholder="例如：家庭网关、手机主订阅、备用节点池"
                      class="nes-input w-full px-4 py-2 text-sm outline-none"
                    />
                  </div>

                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-semibold text-[#2c2523] dark:text-white font-pixel">{t('shareUrls')}</h3>
                  </div>

                  <div class="space-y-3">
                    <template x-for="(source, index) in sources" x-bind:key="source.id">
                      <div class="border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/40 p-4 shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                        <div class="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                          <label class="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 font-pixel">
                            <input type="checkbox" x-model="source.enabled" x-on:change="syncInputFromSources()" class="w-4 h-4 text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] focus:ring-0" />
                            启用
                          </label>
                          <div class="flex-1 px-3 py-1.5 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-800 text-[#2c2523] dark:text-white text-xs font-semibold font-pixel">
                            <span x-text="getSourceAutoName(source, index)"></span>
                          </div>
                          <div class="flex items-center gap-1">
                            <button type="button" x-on:click="moveSource(index, -1)" class="nes-btn w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0" title="上移">
                              <i class="fas fa-chevron-up text-xs"></i>
                            </button>
                            <button type="button" x-on:click="moveSource(index, 1)" class="nes-btn w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0" title="下移">
                              <i class="fas fa-chevron-down text-xs"></i>
                            </button>
                            <button type="button" x-on:click="removeSource(index)" class="nes-btn w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0" title="删除">
                              <i class="fas fa-times text-xs"></i>
                            </button>
                          </div>
                        </div>
                        <div class="relative">
                          <textarea
                            x-model="source.content"
                            x-on:input="handleSourceContentChange(index)"
                            rows="3"
                            placeholder={t('urlPlaceholder')}
                            class="nes-textarea w-full px-4 py-3 pr-14 text-xs font-mono resize-y outline-none"
                          ></textarea>
                          <button
                            type="button"
                            {...{'x-on:click.stop': 'parseSource(index)'}}
                            x-bind:disabled="source.parsing || !(source.content || '').trim()"
                            class="nes-btn absolute right-3 top-3 w-9 h-9 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0"
                            x-bind:class="source.imported ? 'border-green-600 text-green-600 bg-green-50' : 'border-gray-400 text-gray-500 hover:text-green-600'"
                            title="校验并导入节点"
                          >
                            <i class="fas" x-bind:class="source.parsing ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                          </button>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
                          <span x-show="source.imported" class="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border-2 border-green-650 font-mono text-[10px]">
                            <i class="fas fa-check mr-1"></i><span x-text="source.nodeCount || 0"></span> 节点
                          </span>
                          <span x-show="source.error" class="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-650 dark:text-red-300 border-2 border-red-650 font-mono text-[10px]" x-text="source.error"></span>
                        </div>
                      </div>
                    </template>

                    <button
                      type="button"
                      x-on:click="addSource()"
                      class="nes-btn w-full px-3 py-1.5 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] text-xs font-medium flex items-center justify-center gap-2"
                    >
                      <i class="fas fa-plus"></i>
                      添加源
                    </button>
                  </div>

                  <div class="border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/40 p-4 shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div class="flex items-center gap-3">
                        <span class="w-8 h-8 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-800 text-[#c21807] flex items-center justify-center shrink-0">
                          <i class="fas fa-list text-sm"></i>
                        </span>
                        <div>
                          <h3 class="text-xs font-semibold text-[#2c2523] dark:text-white font-pixel">节点管理</h3>
                          <p class="text-[10px] text-gray-500 dark:text-gray-400 font-pixel">
                            <span x-text="managedNodes.length"></span> 个已导入节点
                          </p>
                        </div>
                      </div>
                      <input
                        type="search"
                        x-model="nodeSearch"
                        placeholder="搜索节点..."
                        class="nes-input w-full sm:w-56 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                    <div x-show="managedNodes.length === 0" class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 font-pixel">
                      点击上方源卡片的勾，校验成功后节点会出现在这里。
                    </div>
                    <div class="space-y-2" x-show="managedNodes.length > 0">
                      <template x-for="(node, index) in filteredManagedNodes" x-bind:key="node.id">
                        <div class="flex flex-col md:flex-row md:items-center gap-3 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-800 px-3 py-3 shadow-[1px_1px_0_#2c2523]">
                          <span class="px-2 py-0.5 text-[10px] font-semibold uppercase border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-[#2c2523] dark:text-[#f7f5f0] font-mono"
                            x-text="node.type"
                          ></span>
                          <input
                            type="text"
                            x-model="node.name"
                            x-on:input="updateNodeName(index, node.name)"
                            class="nes-input flex-1 px-3 py-2 text-sm outline-none"
                          />
                          <div class="flex items-center justify-end gap-1">
                            <span class="text-[10px] text-gray-400 mr-2 font-mono"># <span x-text="managedNodes.findIndex(item => item.id === node.id) + 1"></span></span>
                            <button type="button" x-on:click="moveNodeById(node.id, -1)" class="nes-btn w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0" title="上移">
                              <i class="fas fa-chevron-up text-xs"></i>
                            </button>
                            <button type="button" x-on:click="moveNodeById(node.id, 1)" class="nes-btn w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0" title="下移">
                              <i class="fas fa-chevron-down text-xs"></i>
                            </button>
                            <button type="button" x-on:click="removeNodeById(node.id)" class="nes-btn w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 hover:text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] shadow-none active:translate-x-0.5 active:translate-y-0.5 p-0" title="删除">
                              <i class="fas fa-trash text-xs"></i>
                            </button>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div class="border-t-4 border-[#2c2523] dark:border-gray-700 shrink-0"></div>

              {/* Rule Selection */}
              <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h2 class="text-base font-bold text-[#2c2523] dark:text-white flex items-center gap-2 font-pixel">
                    <span class="w-8 h-8 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-[#c21807] flex items-center justify-center shrink-0">
                      <i class="fas fa-filter text-sm"></i>
                    </span>
                    {t('ruleSelection')}
                  </h2>
                  <select
                    x-model="selectedPredefinedRule"
                    x-on:change="applyPredefinedRule()"
                    class="nes-select px-3 py-2 text-sm font-medium outline-none"
                  >
                    <option value="custom">{t('custom')}</option>
                    <option value="minimal">{t('minimal')}</option>
                    <option value="balanced">{t('balanced')}</option>
                    <option value="comprehensive">{t('comprehensive')}</option>
                  </select>
                </div>

                <div class="space-y-3">
                  {UNIFIED_RULES.map((rule) => {
                    const entries = getRuleEntries(rule);
                    const action = getRuleAction(rule.name);
                    return (
                      <details class="group border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/30 overflow-hidden shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                        <summary class="list-none cursor-pointer px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-[#f7f5f0] dark:hover:bg-gray-800 transition-colors">
                          <div class="flex items-start gap-3 flex-1 min-w-0">
                            <span class="mt-1 text-gray-500 transition-transform group-open:rotate-90">
                              <i class="fas fa-chevron-right text-xs"></i>
                            </span>
                            <input
                              type="checkbox"
                              value={rule.name}
                              x-model="selectedRules"
                              {...{'x-on:click.stop': 'true'}}
                              x-on:change="selectedPredefinedRule = 'custom'"
                              class="mt-0.5 w-4 h-4 text-[#c21807] border-2 border-[#2c2523] dark:border-[#f7f5f0] focus:ring-0"
                            />
                            <div class="min-w-0">
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="font-bold text-sm text-[#2c2523] dark:text-white font-pixel">
                                  {t(`outboundNames.${rule.name}`)}
                                </span>
                                <span class={`text-[10px] font-mono px-2 py-0.5 border-2 ${action.className}`}>
                                  {action.label}
                                </span>
                              </div>
                              <div class="text-xs text-[#c21807] dark:text-red-400 mt-1 font-pixel">
                                {RULE_DESCRIPTIONS[rule.name] || '自定义分流规则'} · {entries.length} 规则
                              </div>
                            </div>
                          </div>
                        </summary>
                        <div class="px-4 pb-4 pt-2 border-t-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-800">
                          <div class="space-y-3">
                            {entries.map(entry => (
                              <div class="border border-[#2c2523] dark:border-[#f7f5f0] bg-gray-50 dark:bg-gray-900/50 px-4 py-3">
                                <div class="flex flex-wrap items-center gap-2 mb-2">
                                  <span class="font-bold text-xs text-[#2c2523] dark:text-white font-pixel">
                                    {entry.label}
                                  </span>
                                  <span class="text-[10px] px-1.5 py-0.5 border border-gray-400 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono">
                                    {entry.badge}
                                  </span>
                                  <span class="text-[10px] px-1.5 py-0.5 border border-gray-400 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono">
                                    {entry.kind}
                                  </span>
                                </div>
                                <div class="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">
                                  {entry.path}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card Footer Actions */}
            <div class="px-6 py-5 border-t-4 border-[#2c2523] dark:border-gray-700 flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                type="button"
                x-on:click="generatePreview(true)"
                class="nes-btn flex-1 px-4 py-3 bg-[#c21807] text-white hover:bg-red-700 font-semibold flex items-center justify-center gap-2"
              >
                <i class="fas fa-wand-magic-sparkles text-sm"></i>
                <span class="font-pixel">生成配置</span>
              </button>
            </div>
          </div>
        </section>

        <aside class="flex flex-col min-h-0 xl:h-full xl:overflow-hidden min-w-0" x-data="{ copiedStable: null }">
          <div class="nes-card flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
            {/* Preview Header & Stats */}
            <div class="shrink-0 p-6 pb-0">
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                <div>
                  <h2 class="text-base font-bold text-[#2c2523] dark:text-white flex items-center gap-2 font-pixel">
                    <span class="w-8 h-8 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-900 text-[#c21807] flex items-center justify-center shrink-0">
                      <i class="fas fa-eye text-sm"></i>
                    </span>
                    预览
                  </h2>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 font-pixel">实时查看当前订阅会包含哪些源、节点和规则。</p>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3 mb-5">
                <div class="border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/50 p-4 text-center shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                  <div class="text-lg font-bold text-[#c21807] dark:text-red-400 font-press-start" x-text="previewNodes.length">0</div>
                  <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-pixel">节点</div>
                </div>
                <div class="border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/50 p-4 text-center shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                  <div class="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-press-start" x-text="previewSources.filter(source => source.enabled !== false && (source.content || '').trim()).length">0</div>
                  <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-pixel">启用源</div>
                </div>
                <div class="border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/50 p-4 text-center shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                  <div class="text-lg font-bold text-blue-600 dark:text-blue-400 font-press-start" x-text="previewRules.length">0</div>
                  <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-pixel">规则组</div>
                </div>
              </div>
            </div>

            {/* Scrollable Preview Content */}
            <div class="flex-1 xl:overflow-y-auto px-6 py-4 space-y-5">
              <section>
                <div class="flex items-center justify-between mb-3 font-pixel">
                  <h3 class="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <i class="fas fa-diagram-project text-gray-400"></i>
                    规则预览
                  </h3>
                  <span class="text-[10px] text-gray-500 dark:text-gray-400" x-text="window.APP_TRANSLATIONS[previewPredefinedRule] || previewPredefinedRule"></span>
                </div>
                <div class="space-y-2">
                  <template x-for="rule in (window.RULE_PREVIEW_META || []).filter(item => previewRules.includes(item.name))" x-bind:key="rule.name">
                    <details class="group border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/20 overflow-hidden shadow-[2px_2px_0_#2c2523] dark:shadow-[2px_2px_0_#f7f5f0]">
                      <summary class="list-none cursor-pointer px-3 py-3 flex items-center gap-3">
                        <span class="text-gray-500 transition-transform group-open:rotate-90">
                          <i class="fas fa-chevron-right text-xs"></i>
                        </span>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center justify-between gap-3">
                            <span class="font-bold text-xs text-gray-900 dark:text-white truncate font-pixel" x-text="rule.label"></span>
                            <span class="text-[10px] font-mono px-2 py-0.5 border-2" x-bind:class="rule.actionClass" x-text="rule.action"></span>
                          </div>
                          <div class="text-[10px] text-gray-550 mt-1 font-pixel" x-text="`${rule.description} · ${rule.entries.length} 条`"></div>
                        </div>
                      </summary>
                      <div class="border-t-2 border-[#2c2523] dark:border-[#f7f5f0] px-3 pb-3 pt-2 space-y-2 bg-white/60 dark:bg-gray-900/40">
                        <template x-for="entry in rule.entries" x-bind:key="entry.path">
                          <div class="flex items-center justify-between gap-3 text-xs font-mono">
                            <span class="font-medium text-gray-700 dark:text-gray-200" x-text="entry.label"></span>
                            <span class="text-gray-500 dark:text-gray-400 truncate text-[10px]" x-text="entry.path"></span>
                          </div>
                        </template>
                      </div>
                    </details>
                  </template>
                  <div x-show="previewRules.length === 0" class="border-2 border-dashed border-gray-300 dark:border-gray-700 py-6 text-center text-xs text-gray-500 dark:text-gray-400 font-pixel">
                    暂未选择规则
                  </div>
                </div>
              </section>

              <section>
                <div class="flex items-center justify-between mb-3 font-pixel">
                  <h3 class="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <i class="fas fa-server text-gray-400"></i>
                    节点列表
                  </h3>
                  <span class="text-[10px] text-gray-500 dark:text-gray-400">共 <span x-text="previewNodes.length"></span> 个</span>
                </div>
                <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                  <template x-for="node in previewNodes" x-bind:key="node.id">
                    <div class="flex items-center gap-3 border border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900/40 px-3 py-2">
                      <span class="w-2 h-2 bg-[#c21807] shrink-0"></span>
                      <span class="min-w-0 flex-1 truncate text-xs font-semibold text-gray-800 dark:text-gray-100 font-pixel" x-text="node.name"></span>
                      <span class="px-2 py-0.5 text-[9px] uppercase border border-gray-400 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono" x-text="node.type"></span>
                    </div>
                  </template>
                  <div x-show="previewNodes.length === 0" class="border-2 border-dashed border-gray-300 dark:border-gray-700 py-6 text-center text-xs text-gray-500 dark:text-gray-400 font-pixel">
                    校验源后会显示节点
                  </div>
                </div>
              </section>

              <section>
                <div class="flex items-center justify-between mb-3 font-pixel">
                  <h3 class="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <i class="fas fa-anchor text-gray-400"></i>
                    订阅链接
                  </h3>
                </div>
                <div class="mb-4 space-y-2">
                  <label for="subscription-link-token" class="block text-xs font-semibold text-gray-700 dark:text-gray-200 font-pixel">自定义链接标识</label>
                  <input
                    id="subscription-link-token"
                    type="text"
                    x-model="subscriptionTokenInput"
                    x-bind:disabled="savingSubscription"
                    maxlength="64"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="例如 my-subscription"
                    aria-describedby="subscription-token-help"
                    class="nes-input w-full px-3 py-2 font-mono text-xs text-[#2c2523] dark:text-[#f7f5f0]"
                  />
                  <p id="subscription-token-help" class="text-xs text-gray-500 dark:text-gray-400">3–64 位字母、数字、下划线或短横线，以字母或数字开头，区分大小写。留空时，新订阅自动生成，已有订阅保留原标识。</p>
                  <p x-cloak x-show="subscriptionToken && subscriptionTokenInput.trim() && subscriptionTokenInput.trim() !== subscriptionToken" class="text-xs text-amber-700 dark:text-amber-400">更新订阅后新标识生效，旧链接将失效，请同步更新客户端。</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">持有链接即可下载订阅，请避免使用容易猜到的标识。</p>
                  <p x-cloak x-show="subscriptionMessage" x-text="subscriptionMessage" role="status" class="text-xs text-gray-700 dark:text-gray-200"></p>
                </div>
                <div x-show="!stableLinks" class="border-2 border-dashed border-gray-300 dark:border-gray-700 py-6 text-center text-xs text-gray-500 dark:text-gray-400 font-pixel">
                  保存订阅后在这里复制客户端链接
                </div>
                <div x-cloak x-show="stableLinks" class="space-y-3">
                  {LINK_FIELDS.map((field) => (
                    <div class="relative group" key={`stable-preview-${field.key}`}>
                      <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 font-pixel">
                        {t(field.labelKey)}
                      </label>
                      <div class="flex gap-2">
                        <input
                          type="text"
                          readonly
                          x-bind:value={`stableLinks?.${field.key} || ''`}
                          class="nes-input w-full px-3 py-2 font-mono text-xs text-[#2c2523] dark:text-[#f7f5f0]"
                        />
                        <button
                          type="button"
                          x-on:click={`navigator.clipboard.writeText(stableLinks?.${field.key}).then(() => { copiedStable = '${field.key}'; showToast('订阅链接已复制'); setTimeout(() => copiedStable = null, 2000) })`}
                          class="nes-btn w-9 h-9 shrink-0 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] p-0 flex items-center justify-center"
                          x-bind:class={`{'bg-green-150': copiedStable === '${field.key}'}`}
                          title="复制链接"
                        >
                          <i class="fas" x-bind:class={`copiedStable === '${field.key}' ? 'fa-check' : 'fa-copy'`}></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Card Footer Actions */}
            <div class="px-6 py-5 border-t-4 border-[#2c2523] dark:border-gray-700 flex flex-col sm:flex-row gap-3 shrink-0 font-pixel">
              <button
                type="button"
                x-on:click="saveSubscription()"
                x-bind:disabled="savingSubscription || !currentUser"
                class="nes-btn flex-1 px-4 py-3 bg-[#c21807] text-white hover:bg-red-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <i class="fas" x-bind:class="savingSubscription ? 'fa-spinner fa-spin' : 'fa-save'"></i>
                <span x-text="activeSubscriptionId ? '更新订阅' : '保存订阅'">保存订阅</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div
        x-cloak
        x-show="pendingDeleteSourceId"
        {...{'x-on:keydown.escape.window': 'cancelPendingDeleteSource()'}}
        {...{'x-on:click.self': 'cancelPendingDeleteSource()'}}
        class="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2523]/70 dark:bg-black/75 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-source-title"
      >
        <div
          x-show="pendingDeleteSourceId"
          class="w-full max-w-md border-4 border-[#2c2523] dark:border-[#f7f5f0] bg-[#f7f5f0] dark:bg-gray-950 shadow-[8px_8px_0_#2c2523] dark:shadow-[8px_8px_0_#f7f5f0] font-pixel"
        >
          <div class="flex items-center gap-3 border-b-4 border-[#2c2523] dark:border-[#f7f5f0] bg-white dark:bg-gray-900 px-5 py-4">
            <span class="w-9 h-9 border-2 border-[#2c2523] dark:border-[#f7f5f0] bg-[#c21807] text-white flex items-center justify-center shrink-0">
              <i class="fas fa-trash text-sm"></i>
            </span>
            <div class="min-w-0">
              <h3 id="delete-source-title" class="text-sm font-bold text-[#2c2523] dark:text-white">删除节点链接？</h3>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate" x-text="pendingDeleteSourceName"></p>
            </div>
          </div>
          <div class="px-5 py-5 space-y-4">
            <p class="text-xs leading-6 text-[#2c2523] dark:text-[#f7f5f0]">
              这个节点链接导入的节点已经全部删除，是否同时删除上方的节点链接？
            </p>
            <div class="flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                {...{'x-on:click.stop': 'cancelPendingDeleteSource()'}}
                class="nes-btn px-4 py-2 bg-white dark:bg-gray-800 text-[#2c2523] dark:text-[#f7f5f0] flex items-center justify-center gap-2"
              >
                <i class="fas fa-link text-xs"></i>
                保留链接
              </button>
              <button
                type="button"
                {...{'x-on:click.stop': 'confirmPendingDeleteSource()'}}
                class="nes-btn px-4 py-2 bg-[#c21807] text-white hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <i class="fas fa-trash text-xs"></i>
                同时删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};
