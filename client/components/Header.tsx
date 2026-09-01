import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { USER_ROLE } from '@apprentorbay/shared';
import { profilePath, useAuth } from '../lib/auth';
import { Button } from './Button';
import { Cluster } from './Stack';
import { Text } from './Text';

export function Header() {
  const { account, loading, logOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="rounded-sm no-underline">
            <Text variant="h3" as="span">
              ApprentorBay
            </Text>
          </Link>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-sm border border-line px-3 text-small md:hidden"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav
          id="site-nav"
          className={`${open ? 'flex' : 'hidden'} flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center`}
        >
          <Cluster gap={8}>
            <Button variant="ghost" size="sm" to="/how-it-works">
              How It Works
            </Button>
            <Button variant="ghost" size="sm" to="/mentors">
              Mentors
            </Button>
            <Button variant="ghost" size="sm" to="/support">
              Support
            </Button>
            {loading ? null : account ? (
              <>
                {account.role === USER_ROLE.admin ? (
                  <Button variant="ghost" size="sm" to="/admin">
                    Admin
                  </Button>
                ) : (
                  <Button
                    variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'}
                    size="sm"
                    to="/dashboard"
                  >
                    Dashboard
                  </Button>
                )}
                {account.role === USER_ROLE.mentor ? (
                  <Button variant="ghost" size="sm" to="/dashboard/applications">
                    Applications
                  </Button>
                ) : null}
                {account.role !== USER_ROLE.admin ? (
                  <Button variant="ghost" size="sm" to={profilePath(account)}>
                    My profile
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => void logOut()}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" to="/login">
                  Log in
                </Button>
                <Button size="sm" to="/signup">
                  Sign up
                </Button>
              </>
            )}
          </Cluster>
        </nav>
      </div>
    </header>
  );
}
