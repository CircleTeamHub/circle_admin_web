import { describe, expect, it } from 'vitest';
import { isDangerousSelfStatusChange, userListQueryString } from './UsersPage';

describe('UsersPage helpers', () => {
  it('builds accountId and status filters', () => {
    expect(
      userListQueryString({
        accountId: ' jim ',
        status: 'BANNED',
        page: 2,
        limit: 20,
      }),
    ).toBe('page=2&limit=20&accountId=jim&status=BANNED');
  });

  it('does not allow admins to ban or delete themselves', () => {
    expect(isDangerousSelfStatusChange('admin-1', 'admin-1', 'BANNED')).toBe(
      true,
    );
    expect(isDangerousSelfStatusChange('admin-1', 'admin-1', 'DELETED')).toBe(
      true,
    );
    expect(isDangerousSelfStatusChange('admin-1', 'admin-1', 'ACTIVE')).toBe(
      false,
    );
    expect(isDangerousSelfStatusChange('admin-1', 'user-2', 'BANNED')).toBe(
      false,
    );
  });
});
