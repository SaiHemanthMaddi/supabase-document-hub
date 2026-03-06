import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/RouteGuards';

const mockUseAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

function AuthScreen() {
  return <div>auth-screen</div>;
}

function HomeScreen() {
  return <div>home-screen</div>;
}

function LocationEcho() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>
  );
}

describe('RouteGuards', () => {
  it('redirects authenticated users away from /auth by default', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/auth" element={<AuthScreen />} />
          </Route>
          <Route path="/" element={<HomeScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('home-screen')).toBeInTheDocument();
  });

  it('allows authenticated users on /auth during password reset mode', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/auth?mode=reset']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/auth" element={<AuthScreen />} />
          </Route>
          <Route path="/" element={<HomeScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('auth-screen')).toBeInTheDocument();
  });

  it('redirects recovery links on protected routes to auth reset page', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/#type=recovery&access_token=abc']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeScreen />} />
          </Route>
          <Route path="/auth" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/auth?mode=reset#type=recovery&access_token=abc',
    );
  });
});
