import { describe, it, expect, vi } from 'vitest';
import { formLogicFn } from '../src/components/formLogic.js';

describe('formLogic toString fix', () => {
  it('keeps published links until a custom token is saved successfully', async () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {}, location: { origin: 'http://localhost' } };
    const fetchMock = vi.fn();
    const fn = new Function('window', 'fetch', '(' + formLogicFn.toString() + ')(); return window.formData();');
    const data = fn(fakeWindow, fetchMock);
    data.currentUser = { id: 'user-1' };
    data.activeSubscriptionId = 'sub_1';
    data.subscriptionToken = 'old-token';
    data.subscriptionTokenInput = '  new-token  ';
    data.stableLinks = data.buildStableLinks('old-token');
    data.syncInputFromSources = () => {};
    data.getCustomRulesPayload = () => [];
    data.getBaseConfigPayload = () => null;
    data.generatePreview = () => {};
    data.loadSubscriptions = async () => {};
    data.showToast = vi.fn();
    const oldLinks = { ...data.stableLinks };
    fetchMock.mockResolvedValueOnce(new Response('订阅链接标识已被使用，请换一个', { status: 409 }));
    await data.saveSubscription();
    expect(data.stableLinks).toEqual(oldLinks);
    expect(data.subscriptionToken).toBe('old-token');
    expect(data.subscriptionTokenInput).toBe('  new-token  ');
    expect(data.subscriptionMessage).toContain('已被使用');
    expect(data.savingSubscription).toBe(false);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).token).toBe('new-token');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ subscription: { id: 'sub_1', token: 'new-token', name: 'Updated' } })));
    await data.saveSubscription();
    expect(data.subscriptionTokenInput).toBe('new-token');
    expect(data.subscriptionToken).toBe('new-token');
    for (const target of ['xray', 'singbox', 'clash', 'surge']) {
      expect(data.stableLinks[target]).toBe(`http://localhost/sub/new-token/${target}`);
    }
    data.createEmptySource = () => ({});
    data.resetSubscriptionDraft();
    expect(data.subscriptionTokenInput).toBe('');
    expect(data.stableLinks).toBeNull();
  });

  it('includes parseSurgeConfigInput definition in toString output', () => {
    const fnString = formLogicFn.toString();

    // Verify the function references parseSurgeConfigInput
    expect(fnString).toContain('parseSurgeConfigInput');

    // Verify the arrow function definitions ARE included
    expect(fnString).toMatch(/(?:const|var|let)\s+parseSurgeConfigInput\s*=/);
    expect(fnString).toMatch(/(?:const|var|let)\s+parseSurgeValue\s*=/);
    expect(fnString).toMatch(/(?:const|var|let)\s+convertSurgeIniToJson\s*=/);
  });

  it('does not contain __name calls that break in browser runtime', () => {
    const fnString = formLogicFn.toString();
    // Ensure no function declarations that esbuild would inject __name() for
    expect(fnString).not.toMatch(/^\s*function\s+parseSurgeValue\b/m);
    expect(fnString).not.toMatch(/^\s*function\s+convertSurgeIniToJson\b/m);
    expect(fnString).not.toMatch(/^\s*function\s+parseSurgeConfigInput\b/m);
  });

  it('formData() returns a valid Alpine data object', () => {
    // Simulate browser global environment using Function constructor
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    expect(typeof data.saveSubscription).toBe('function');
    expect(typeof data.toggleAccordion).toBe('function');
    expect(data.showAdvanced).toBe(false);
  });

  it('auto names node and subscription sources by type and order', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();

    data.sources = [
      { content: 'vless://example' },
      { content: 'https://example.com/sub' },
      { content: 'ss://example' },
      { content: 'http://example.com/sub' }
    ];

    expect(data.getSourceAutoName(data.sources[0], 0)).toBe('节点链接 #1');
    expect(data.getSourceAutoName(data.sources[1], 1)).toBe('订阅链接 #1');
    expect(data.getSourceAutoName(data.sources[2], 2)).toBe('节点链接 #2');
    expect(data.getSourceAutoName(data.sources[3], 3)).toBe('订阅链接 #2');
  });

  it('stores toast feedback messages', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();

    data.showToast('已添加输入源');

    expect(data.toastMessage).toBe('已添加输入源');
    expect(data.toastType).toBe('success');
  });

  it('removes managed nodes when their source is removed', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'vless://a' },
      { id: 'source-b', content: 'vless://b' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: 'source-a' },
      { id: 'node-b', sourceId: 'source-b' }
    ];

    data.removeSource(1);

    expect(data.sources.map(source => source.id)).toEqual(['source-a']);
    expect(data.managedNodes.map(node => node.id)).toEqual(['node-a']);
  });

  it('links legacy managed nodes to sources by order before source removal', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'vless://a' },
      { id: 'source-b', content: 'vmess://b' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: '', name: 'A', type: 'vless', proxy: { type: 'vless', tag: 'A' } },
      { id: 'node-b', sourceId: '', name: 'B', type: 'vmess', proxy: { type: 'vmess', tag: 'B' } }
    ];

    data.reconcileManagedNodeSourceIds();
    data.removeSource(1);

    expect(data.sources.map(source => source.id)).toEqual(['source-a']);
    expect(data.managedNodes.map(node => node.id)).toEqual(['node-a']);
    expect(data.managedNodes[0].sourceId).toBe('source-a');
  });

  it('clears managed nodes when the only source is cleared', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'vless://a', imported: true, nodeCount: 1, error: 'old error' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: 'source-a' },
      { id: 'node-b', sourceId: 'source-b' }
    ];

    data.removeSource(0);

    expect(data.sources).toEqual([
      { id: 'source-a', content: '', imported: false, nodeCount: 0, error: '' }
    ]);
    expect(data.managedNodes).toEqual([]);
  });

  it('removes source when deleting the last managed node and confirmed', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'vless://a', imported: true, nodeCount: 1, error: '' },
      { id: 'source-b', content: 'vmess://b', imported: true, nodeCount: 1, error: '' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: 'source-a' },
      { id: 'node-b', sourceId: 'source-b' }
    ];

    data.removeNodeById('node-b');
    expect(data.pendingDeleteSourceId).toBe('source-b');

    data.confirmPendingDeleteSource();

    expect(data.sources.map(source => source.id)).toEqual(['source-a']);
    expect(data.managedNodes.map(node => node.id)).toEqual(['node-a']);
    expect(data.pendingDeleteSourceId).toBe('');
  });

  it('clears the only source when deleting its last managed node and confirmed', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'vless://a', imported: true, nodeCount: 1, error: '' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: 'source-a' }
    ];

    data.removeNodeById('node-a');
    expect(data.pendingDeleteSourceId).toBe('source-a');

    data.confirmPendingDeleteSource();

    expect(data.sources).toEqual([
      { id: 'source-a', content: '', imported: false, nodeCount: 0, error: '' }
    ]);
    expect(data.managedNodes).toEqual([]);
    expect(data.pendingDeleteSourceId).toBe('');
  });

  it('keeps source when deleting the last managed node and cancelled', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'vless://a', imported: true, nodeCount: 1, error: '' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: 'source-a' }
    ];

    data.removeNodeById('node-a');
    expect(data.pendingDeleteSourceId).toBe('source-a');

    data.cancelPendingDeleteSource();

    expect(data.sources).toEqual([
      { id: 'source-a', content: 'vless://a', imported: false, nodeCount: 0, error: '' }
    ]);
    expect(data.managedNodes).toEqual([]);
    expect(data.pendingDeleteSourceId).toBe('');
  });

  it('does not remove subscription source when its last managed node is deleted', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    data.syncInputFromSources = () => {};

    data.sources = [
      { id: 'source-a', content: 'https://example.com/sub', imported: true, nodeCount: 1, error: '' }
    ];
    data.managedNodes = [
      { id: 'node-a', sourceId: 'source-a' }
    ];

    data.removeNodeById('node-a');

    expect(data.sources).toEqual([
      { id: 'source-a', content: 'https://example.com/sub', imported: false, nodeCount: 0, error: '' }
    ]);
    expect(data.managedNodes).toEqual([]);
    expect(data.pendingDeleteSourceId).toBe('');
  });

  it('keeps renamed nodes when the same source is imported again', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();

    const source = { id: 'source-a' };
    const parsedNode = {
      id: 'node-new',
      sourceId: 'source-a',
      name: 'US-LA-ISP-1',
      type: 'vless',
      enabled: true,
      proxy: {
        type: 'vless',
        tag: 'US-LA-ISP-1',
        server: '172.252.125.177',
        port: 443,
        uuid: '3f42aaeb-e402-4379-9fb4-480a39187c61'
      }
    };
    data.managedNodes = [
      {
        id: 'node-existing',
        sourceId: 'source-a',
        name: '自用-美国洛杉矶',
        type: 'vless',
        enabled: true,
        proxy: {
          type: 'vless',
          tag: '自用-美国洛杉矶',
          server: '172.252.125.177',
          port: 443,
          uuid: '3f42aaeb-e402-4379-9fb4-480a39187c61'
        }
      }
    ];

    data.mergeImportedNodes(source, [parsedNode]);

    expect(data.managedNodes).toHaveLength(1);
    expect(data.managedNodes[0]).toMatchObject({
      id: 'node-existing',
      sourceId: 'source-a',
      name: '自用-美国洛杉矶',
      proxy: {
        tag: '自用-美国洛杉矶'
      }
    });
  });

  it('deduplicates legacy nodes without source ids when importing the same proxy', () => {
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();

    data.managedNodes = [
      {
        id: 'legacy-node',
        sourceId: '',
        name: '自用-美国洛杉矶',
        type: 'vless',
        enabled: true,
        proxy: {
          type: 'vless',
          tag: '自用-美国洛杉矶',
          server: '172.252.125.177',
          port: 443,
          uuid: '3f42aaeb-e402-4379-9fb4-480a39187c61'
        }
      }
    ];

    data.mergeImportedNodes({ id: 'source-a' }, [
      {
        id: 'fresh-node',
        sourceId: 'source-a',
        name: 'US-LA-ISP-1',
        type: 'vless',
        enabled: true,
        proxy: {
          type: 'vless',
          tag: 'US-LA-ISP-1',
          server: '172.252.125.177',
          port: 443,
          uuid: '3f42aaeb-e402-4379-9fb4-480a39187c61'
        }
      }
    ]);

    expect(data.managedNodes).toHaveLength(1);
    expect(data.managedNodes[0]).toMatchObject({
      id: 'legacy-node',
      name: '自用-美国洛杉矶',
      sourceId: 'source-a'
    });
  });
});
