import { TERMS_ACCEPTANCE_LABEL, termsEffectiveLabel } from '@apprentorbay/shared';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Stack } from './Stack';
import { Text } from './Text';

type TermsAcceptanceProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function TermsAcceptance({ id, checked, onChange }: TermsAcceptanceProps) {
  return (
    <Stack gap={12}>
      <Text variant="small">{termsEffectiveLabel()}</Text>
      <Button variant="secondary" to="/legal/terms">
        Read the full Terms of Use
      </Button>
      <Checkbox
        id={id}
        label={TERMS_ACCEPTANCE_LABEL}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </Stack>
  );
}
