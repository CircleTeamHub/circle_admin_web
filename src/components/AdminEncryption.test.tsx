import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ close: vi.fn(), decrypt: vi.fn(), opened: vi.fn(), session: 1, listeners: new Set<() => void>() }));
vi.mock('@circle/e2ee/browser-journal.mjs', () => ({ openBrowserJournal: mocks.opened }));
vi.mock('@circle/e2ee', () => ({ ProtocolDevice: { open: async () => ({ userId: 'admin', deviceId: 'audit-device', publicIdentity: () => ({ publicKey: 'public-test-key' }) }) } }));
vi.mock('@circle/e2ee/relay-client.mjs', () => ({ EncryptionClient: class {
  device: unknown;
  constructor(device: unknown) { this.device = device; }
  run<T>(work: () => Promise<T>) { return work(); }
  devices() { return Promise.resolve([]); }
  decrypt() { return mocks.decrypt(); }
} }));
vi.mock('../api/auth', () => ({ getMe: async () => ({ id: 'admin' }) }));
vi.mock('../api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../auth/session', () => ({ getSessionEpoch: () => mocks.session, subscribeSession: (listener: () => void) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); } }));
import { AdminEncryption, AdminEncryptedText } from './AdminEncryption';
import type { EncryptedContent } from '@circle/e2ee/relay-client.mjs';
const content = { envelope: { conversationId: 'room' }, signature: 'proof' } as EncryptedContent;
beforeEach(() => {
  vi.clearAllMocks(); mocks.session = 1;
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  mocks.close.mockResolvedValue(undefined);
  mocks.opened.mockResolvedValue({ deviceId: 'audit-device', close: mocks.close });
  mocks.decrypt.mockResolvedValue({ text: 'private admin text' });
});
async function unlock() {
  fireEvent.click(screen.getByText('加密消息访问 · 未解锁'));
  fireEvent.change(screen.getByLabelText('解密设备口令'), { target: { value: 'local-vault-passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: '创建 / 解锁本机保险库' }));
  await screen.findByRole('button', { name: '锁定' });
}
describe('administrator device unlock boundary', () => {
  it('requires an explicit unlock before decrypting and clears displayed content on lock', async () => {
    render(<AdminEncryption><AdminEncryptedText content={content} reason="local test" /></AdminEncryption>);
    expect(mocks.opened).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: '在此设备解密' }));
    await screen.findByText('private admin text');
    fireEvent.click(screen.getByRole('button', { name: '锁定' }));
    expect(screen.queryByText('private admin text')).toBeNull();
    expect(mocks.close).toHaveBeenCalled();
  });
  it('locks when hidden and does not reveal an in-flight decryption result', async () => {
    let resolve!: (value: unknown) => void;
    mocks.decrypt.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<AdminEncryption><AdminEncryptedText content={content} reason="local test" /></AdminEncryption>);
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: '在此设备解密' }));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    resolve({ text: 'late private text' });
    await waitFor(() => expect(mocks.close).toHaveBeenCalled());
    expect(screen.queryByText('late private text')).toBeNull();
  });
  it('closes a vault opened after the session has changed', async () => {
    let resolve!: (value: unknown) => void;
    mocks.opened.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<AdminEncryption><AdminEncryptedText content={content} reason="local test" /></AdminEncryption>);
    fireEvent.click(screen.getByText('加密消息访问 · 未解锁'));
    fireEvent.change(screen.getByLabelText('解密设备口令'), { target: { value: 'local-vault-passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: '创建 / 解锁本机保险库' }));
    await waitFor(() => expect(mocks.opened).toHaveBeenCalled());
    mocks.session++;
    resolve({ deviceId: 'audit-device', close: mocks.close });
    await waitFor(() => expect(mocks.close).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '锁定' })).toBeNull();
  });
});
