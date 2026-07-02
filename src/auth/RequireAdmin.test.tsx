import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './RequireAdmin';

function renderGuard(user: Parameters<typeof RequireAdmin>[0]['user']) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAdmin user={user}>
              <div>Admin Home</div>
            </RequireAdmin>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  it('redirects anonymous users to login', () => {
    renderGuard(null);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('blocks non-admin users', () => {
    renderGuard({
      id: 'u1',
      accountId: 'user',
      nickname: 'User',
      role: 'USER',
      status: 'ACTIVE',
    });
    expect(screen.getByText('无权限访问后台')).toBeInTheDocument();
  });

  it('allows active admin users', () => {
    renderGuard({
      id: 'a1',
      accountId: 'admin',
      nickname: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });
});
