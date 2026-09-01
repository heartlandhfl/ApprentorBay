import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TERMS_SUMMARY, needsTermsAcceptance } from '@apprentorbay/shared';
import { useAuth } from '../lib/auth';
import { Button } from './Button';
import { Modal } from './Modal';
import { Stack } from './Stack';
import { TermsAcceptance } from './TermsAcceptance';
import { Text } from './Text';

export function TermsGate({ children }: { children: React.ReactNode }) {
  const { account, loading, acceptCurrentTerms } = useAuth();
  const location = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = Boolean(account && !loading && needsTermsAcceptance(account));
  const readingFullTerms = location.pathname === '/legal/terms';

  async function accept() {
    if (!agreed) return;
    setBusy(true);
    setError(null);
    try {
      await acceptCurrentTerms();
      setAgreed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record acceptance');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      <Modal
        open={blocked && !readingFullTerms}
        title="Updated Terms of Use"
        dismissible={false}
      >
        <Stack gap={16}>
          <Text>{TERMS_SUMMARY}</Text>
          <TermsAcceptance
            id="reaccept-terms"
            checked={agreed}
            onChange={setAgreed}
          />
          {error ? <Text variant="danger">{error}</Text> : null}
          <Button disabled={!agreed} loading={busy} onClick={() => void accept()}>
            Accept and continue
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
