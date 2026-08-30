import { Link } from 'react-router-dom';
import { Badge } from './Badge';
import { Button } from './Button';
import { Cluster } from './Stack';
import { Text } from './Text';

export function Header() {
  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="rounded-sm no-underline">
          <Cluster gap={12}>
            <Text variant="h3" as="span">
              ApprentorBay
            </Text>
            <Badge>Harbor</Badge>
          </Cluster>
        </Link>
        <Button variant="ghost" size="sm" to="/system">
          System health
        </Button>
      </div>
    </header>
  );
}
