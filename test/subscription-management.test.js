import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';
import { decodeBase64 } from '../src/utils.js';
import yaml from 'js-yaml';

const VMESS = 'vmess://ew0KICAidiI6ICIyIiwNCiAgInBzIjogInRlc3QiLA0KICAiYWRkIjogIjEuMS4xLjEiLA0KICAicG9ydCI6ICI0NDMiLA0KICAiaWQiOiAiYWRkNjY2NjYtODg4OC04ODg4LTg4ODgtODg4ODg4ODg4ODg4IiwNCiAgImFpZCI6ICIwIiwNCiAgInNjeSI6ICJhdXRvIiwNCiAgIm5ldCI6ICJ3cyIsDQogICJ0eXBlIjogIm5vbmUiLA0KICAiaG9zdCI6ICIiLA0KICAicGF0aCI6ICIvIiwNCiAgInRscyI6ICJ0bHMiDQp9';

const createTestApp = () => createApp({
    kv: new MemoryKVAdapter(),
    assetFetcher: null,
    logger: console,
    config: {
        configTtlSeconds: 60,
        shortLinkTtlSeconds: null
    }
});

const createSubscriptionPayload = (overrides = {}) => ({
    name: 'Main Subscription',
    sources: [
        {
            id: 'source-1',
            name: 'Airport A',
            content: VMESS,
            enabled: true
        }
    ],
    options: {
        selectedRules: ['Google'],
        customRules: [],
        groupByCountry: false,
        includeAutoSelect: true,
        enableClashUI: false,
        externalController: '',
        externalUiDownloadUrl: '',
        ua: '',
        configType: 'singbox',
        baseConfig: null
    },
    ...overrides
});

async function registerAndGetCookie(app, username = 'alice') {
    const res = await app.request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'password123' })
    });
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('nodelink_session=');
    return setCookie.split(';')[0];
}

describe('Subscription management API', () => {
    it('supports custom tokens across all clients, renames, and deletion', async () => {
        const app = createTestApp();
        const cookie = await registerAndGetCookie(app);
        const headers = { 'Content-Type': 'application/json', Cookie: cookie };
        const createdResponse = await app.request('/api/subscriptions', {
            method: 'POST', headers,
            body: JSON.stringify(createSubscriptionPayload({ token: '  My-sub_123  ' }))
        });
        expect(createdResponse.status).toBe(201);
        const created = (await createdResponse.json()).subscription;
        expect(created.token).toBe('My-sub_123');

        const checkDownloads = async (token) => {
            for (const target of ['xray', 'singbox', 'clash', 'surge']) {
                const response = await app.request(`/sub/${token}/${target}`);
                expect(response.status).toBe(200);
                const content = await response.text();
                if (target === 'xray') expect(decodeBase64(content)).toBe(VMESS);
                if (target === 'singbox') expect(JSON.parse(content).outbounds).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'vmess', tag: 'test' })]));
                if (target === 'clash') expect(yaml.load(content).proxies).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'vmess', name: 'test' })]));
                if (target === 'surge') {
                    expect(content).toContain('[Proxy]');
                    expect(content).toContain('test = vmess,');
                }
            }
        };
        await checkDownloads(created.token);

        for (const token of [undefined, '', created.token]) {
            const response = await app.request(`/api/subscriptions/${created.id}`, {
                method: 'PUT', headers, body: JSON.stringify({ token, name: 'Updated' })
            });
            expect(response.status).toBe(200);
            expect((await response.json()).subscription.token).toBe(created.token);
        }

        const renamedResponse = await app.request(`/api/subscriptions/${created.id}`, {
            method: 'PUT', headers, body: JSON.stringify({ token: 'New-sub_456' })
        });
        expect(renamedResponse.status).toBe(200);
        const renamed = (await renamedResponse.json()).subscription;
        expect(renamed.token).toBe('New-sub_456');
        await checkDownloads(renamed.token);
        for (const target of ['xray', 'singbox', 'clash', 'surge']) {
            expect((await app.request(`/sub/${created.token}/${target}`)).status).toBe(404);
        }
        const list = await (await app.request('/api/subscriptions', { headers })).json();
        expect(list.subscriptions[0].token).toBe(renamed.token);
        const loaded = await (await app.request(`/api/subscriptions/${created.id}`, { headers })).json();
        expect(loaded.subscription.token).toBe(renamed.token);

        expect((await app.request(`/api/subscriptions/${created.id}`, { method: 'DELETE', headers })).status).toBe(200);
        expect((await app.request(`/sub/${renamed.token}/clash`)).status).toBe(404);
        const reused = await app.request('/api/subscriptions', {
            method: 'POST', headers,
            body: JSON.stringify(createSubscriptionPayload({ token: renamed.token }))
        });
        expect(reused.status).toBe(201);
    });

    it('rejects invalid and occupied tokens without changing existing links', async () => {
        const app = createTestApp();
        const cookie = await registerAndGetCookie(app);
        const otherCookie = await registerAndGetCookie(app, 'bob');
        const headers = { 'Content-Type': 'application/json', Cookie: cookie };
        const otherHeaders = { ...headers, Cookie: otherCookie };
        const create = (token, requestHeaders = headers) => app.request('/api/subscriptions', {
            method: 'POST', headers: requestHeaders,
            body: JSON.stringify(createSubscriptionPayload({ token }))
        });
        const first = (await (await create('reserved-token')).json()).subscription;
        const second = (await (await create('', otherHeaders)).json()).subscription;
        expect(second.token).toMatch(/^[A-Za-z0-9]{24}$/);
        for (const requestHeaders of [headers, otherHeaders]) {
            expect((await create(first.token, requestHeaders)).status).toBe(409);
        }
        for (const token of ['ab', 'a'.repeat(65), 'bad/path', 'bad?query', 'bad#hash', 'bad%2Fpath', 'bad token', '_bad', '中文标识', null, 123, {}, []]) {
            expect((await create(token)).status).toBe(400);
            const update = await app.request(`/api/subscriptions/${second.id}`, {
                method: 'PUT', headers: otherHeaders, body: JSON.stringify({ token })
            });
            expect(update.status).toBe(400);
        }
        const collision = await app.request(`/api/subscriptions/${second.id}`, {
            method: 'PUT', headers: otherHeaders, body: JSON.stringify({ token: first.token })
        });
        expect(collision.status).toBe(409);
        const unauthorized = await app.request(`/api/subscriptions/${first.id}`, {
            method: 'PUT', headers: otherHeaders, body: JSON.stringify({ token: 'stolen-token' })
        });
        expect(unauthorized.status).toBe(404);
        for (const subscription of [first, second]) {
            expect((await app.request(`/sub/${subscription.token}/clash`)).status).toBe(200);
        }
        expect((await app.request('/sub/stolen-token/clash')).status).toBe(404);
        expect((await (await app.request('/api/subscriptions', { headers })).json()).subscriptions).toHaveLength(1);
    });

    it('parses a source into manageable nodes', async () => {
        const app = createTestApp();

        const res = await app.request('http://localhost/api/parse-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: VMESS })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.count).toBe(1);
        expect(data.nodes[0]).toMatchObject({
            name: 'test',
            type: 'vmess'
        });
        expect(data.nodes[0].proxy).toHaveProperty('tag', 'test');
    });

    it('requires login for subscription management', async () => {
        const app = createTestApp();

        const listRes = await app.request('http://localhost/api/subscriptions');
        expect(listRes.status).toBe(401);

        const createRes = await app.request('http://localhost/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createSubscriptionPayload())
        });
        expect(createRes.status).toBe(401);
    });

    it('creates, lists, loads, updates, and deletes subscriptions by logged-in user', async () => {
        const app = createTestApp();
        const cookie = await registerAndGetCookie(app);

        const createRes = await app.request('http://localhost/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify(createSubscriptionPayload())
        });
        expect(createRes.status).toBe(201);
        const created = (await createRes.json()).subscription;
        expect(created.id).toMatch(/^sub_/);
        expect(created.token).toBeTruthy();
        expect(created.name).toBe('Main Subscription');

        const listRes = await app.request('http://localhost/api/subscriptions', {
            headers: { Cookie: cookie }
        });
        expect(listRes.status).toBe(200);
        const list = await listRes.json();
        expect(list.subscriptions).toHaveLength(1);
        expect(list.subscriptions[0]).toMatchObject({
            id: created.id,
            name: 'Main Subscription',
            sourceCount: 1,
            enabledSourceCount: 1
        });

        const otherCookie = await registerAndGetCookie(app, 'bob');
        const forbiddenRes = await app.request(`http://localhost/api/subscriptions/${created.id}`, {
            headers: { Cookie: otherCookie }
        });
        expect(forbiddenRes.status).toBe(404);

        const missingOwnerRes = await app.request(`http://localhost/api/subscriptions/${created.id}`);
        expect(missingOwnerRes.status).toBe(401);

        const updateRes = await app.request(`http://localhost/api/subscriptions/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                ...createSubscriptionPayload({ name: 'Updated Subscription' }),
                sources: [
                    { id: 'source-1', name: 'Airport A', content: VMESS, enabled: false },
                    { id: 'source-2', name: 'Airport B', content: VMESS, enabled: true }
                ]
            })
        });
        expect(updateRes.status).toBe(200);
        const updated = (await updateRes.json()).subscription;
        expect(updated.name).toBe('Updated Subscription');
        expect(updated.sources).toHaveLength(2);

        const updatedListRes = await app.request('http://localhost/api/subscriptions', {
            headers: { Cookie: cookie }
        });
        const updatedList = await updatedListRes.json();
        expect(updatedList.subscriptions[0]).toMatchObject({
            name: 'Updated Subscription',
            sourceCount: 2,
            enabledSourceCount: 1
        });

        const deleteRes = await app.request(`http://localhost/api/subscriptions/${created.id}`, {
            method: 'DELETE',
            headers: { Cookie: cookie }
        });
        expect(deleteRes.status).toBe(200);

        const emptyListRes = await app.request('http://localhost/api/subscriptions', {
            headers: { Cookie: cookie }
        });
        const emptyList = await emptyListRes.json();
        expect(emptyList.subscriptions).toHaveLength(0);
    });

    it('serves a saved subscription through stable token links', async () => {
        const app = createTestApp();
        const cookie = await registerAndGetCookie(app);
        const parseRes = await app.request('http://localhost/api/parse-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: VMESS })
        });
        const parsedNode = (await parseRes.json()).nodes[0];
        parsedNode.name = 'Renamed Node';
        parsedNode.proxy.tag = 'Renamed Node';

        const createRes = await app.request('http://localhost/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify(createSubscriptionPayload({
                name: '自用订阅.yaml',
                nodes: [parsedNode]
            }))
        });
        const created = (await createRes.json()).subscription;

        const clashRes = await app.request(`http://localhost/sub/${created.token}/clash`);
        expect(clashRes.status).toBe(200);
        expect(clashRes.headers.get('content-type')).toContain('text/yaml');
        expect(decodeBase64(clashRes.headers.get('profile-title').replace(/^base64:/, ''))).toBe('自用订阅.yaml');
        expect(clashRes.headers.get('content-disposition')).toContain("filename*=UTF-8''%E8%87%AA%E7%94%A8%E8%AE%A2%E9%98%85.yaml");
        const text = await clashRes.text();
        expect(text).toContain('proxies:');
        expect(text).toContain('Renamed Node');

        const missingRes = await app.request('http://localhost/sub/not-found/clash');
        expect(missingRes.status).toBe(404);
    });

    it('preserves sourceId for nodes in saved subscription', async () => {
        const app = createTestApp();
        const cookie = await registerAndGetCookie(app);

        const node = {
            id: 'node-1',
            sourceId: 'source-1',
            name: 'Test Node',
            type: 'ss',
            proxy: {
                tag: 'Test Node',
                type: 'ss',
                server: '1.1.1.1',
                port: 8388,
                method: 'aes-256-gcm',
                password: 'pwd'
            }
        };

        const createRes = await app.request('http://localhost/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify(createSubscriptionPayload({
                nodes: [node]
            }))
        });
        expect(createRes.status).toBe(201);
        const created = (await createRes.json()).subscription;
        expect(created.nodes).toHaveLength(1);
        expect(created.nodes[0].sourceId).toBe('source-1');

        // Also test fetching the subscription directly
        const getRes = await app.request(`http://localhost/api/subscriptions/${created.id}`, {
            headers: { Cookie: cookie }
        });
        expect(getRes.status).toBe(200);
        const fetched = (await getRes.json()).subscription;
        expect(fetched.nodes).toHaveLength(1);
        expect(fetched.nodes[0].sourceId).toBe('source-1');
    });
});
