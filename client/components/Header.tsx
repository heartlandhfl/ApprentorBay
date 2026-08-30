import { Link } from 'react-router-dom';
import { profilePath, useAuth } from '../lib/auth';
import { Badge } from './Badge';
import { Button } from './Button';
import { Cluster } from './Stack';
import { Text } from './Text';

export function Header() {
  const { account, loading, logOut } = useAuth();

  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="rounded-sm no-underline">
          <Cluster gap={12}>
            <Text variant="h3" as="span">
              ApprentorBay
            </Text>
            <Badge>Harbor</Badge>
          </Cluster>
        </Link>
        <Cluster gap={8}>
          <Button variant="ghost" size="sm" to="/system">
            System health
          </Button>
          {loading ? null : account ? (
            <>
              <Button variant="ghost" size="sm" to={profilePath(account)}>
                {account.role === 'admin' ? 'Verification' : 'My profile'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void logOut()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" to="/login">
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
