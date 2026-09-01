import { Link } from 'react-router-dom';
import { Cluster } from './Stack';
import { Text } from './Text';

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-raised">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Text variant="small">ApprentorBay</Text>
        <Cluster gap={16}>
          <Link to="/legal/terms" className="text-small text-ink no-underline hover:underline">
            Terms of Use
          </Link>
          <Link to="/support" className="text-small text-ink no-underline hover:underline">
            Support
          </Link>
        </Cluster>
      </div>
    </footer>
  );
}
