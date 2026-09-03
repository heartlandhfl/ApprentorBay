import type { ReactNode } from 'react';
import type { MentorshipOfferingView } from '@apprentorbay/shared';
import { Badge, Button, Cluster, Stack, Text } from '../../components';

type MentorshipOfferingCardProps = {
  offering: MentorshipOfferingView;
  action?: ReactNode;
  compact?: boolean;
};

export function MentorshipOfferingCard({
  offering,
  action,
  compact = false,
}: MentorshipOfferingCardProps) {
  return (
    <div className="rounded-sm border border-line bg-paper-raised p-4 sm:p-6">
      <Stack gap={16}>
        <Stack gap={8}>
          <Cluster gap={8}>
            <Text variant="h3" as="h3">
              {offering.sessionTitle}
            </Text>
            <Badge tone={offering.isPaid ? 'neutral' : 'success'}>{offering.serviceModelTitle}</Badge>
          </Cluster>
          {!compact ? (
            <Cluster gap={12}>
              {offering.durationLabel ? (
                <Text variant="small">{offering.durationLabel}</Text>
              ) : null}
              <Text variant="h2" as="p">
                {offering.priceAmountLabel}
                {offering.isPaid ? (
                  <Text as="span" variant="small">
                    {' '}
                    {offering.currencyCode}
                  </Text>
                ) : null}
              </Text>
            </Cluster>
          ) : (
            <Text variant="small">{offering.priceSummary}</Text>
          )}
        </Stack>

        <Text variant={compact ? 'small' : 'body'}>{offering.description}</Text>

        {!compact ? (
          <Stack gap={8}>
            <Text variant="caption">Included</Text>
            <Text variant="small">
              {offering.includesVideo ? 'Video session' : 'No video session'}
              {' · '}
              {offering.includesMessaging ? 'Messaging included' : 'Messaging not included'}
            </Text>
          </Stack>
        ) : null}

        {!compact ? (
          <Stack gap={8}>
            <Text variant="caption">What happens next</Text>
            <ol className="list-decimal space-y-2 pl-5 text-small text-ink-muted">
              {offering.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Stack>
        ) : null}

        {action ? <div>{action}</div> : null}
      </Stack>
    </div>
  );
}

export function MentorshipOfferingCardButton({
  label,
  onClick,
  to,
  loading,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  to?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  if (to) {
    return (
      <Button to={to} className="w-full sm:w-auto" disabled={disabled}>
        {label}
      </Button>
    );
  }
  return (
    <Button onClick={onClick} loading={loading} className="w-full sm:w-auto" disabled={disabled}>
      {label}
    </Button>
  );
}
