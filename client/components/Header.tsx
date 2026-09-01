import { Link } from 'react-router-dom';
import { USER_ROLE } from '@apprentorbay/shared';
import { profilePath, useAuth } from '../lib/auth';
import { Button } from './Button';
import { Cluster } from './Stack';
import { Text } from './Text';

export function Header() {
  const { account, loading, logOut } = useAuth();

  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="rounded-sm no-underline">
          <Text variant="h3" as="span">
            ApprentorBay
          </Text>
        </Link>
        <Cluster gap={8}>
          <Button variant="ghost" size="sm" to="/how-it-works">
            How It Works
          </Button>
          <Button variant="ghost" size="sm" to="/mentors">
            Mentors
          </Button>
          {loading ? null : account ? (
            <>
              {account.role === USER_ROLE.admin ? (
                <Button variant="ghost" size="sm" to="/admin">
                  Admin
                </Button>
              ) : null}
              {account.role === USER_ROLE.mentor ? (
                <Button variant="ghost" size="sm" to="/dashboard/applications">
                  Applications
                </Button>
              ) : null}
              {account.role === USER_ROLE.learner || account.role === USER_ROLE.mentor ? (
                <Button variant="ghost" size="sm" to="/dashboard/messages">
                  Messages
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
      </div>
    </header>
  );
}
