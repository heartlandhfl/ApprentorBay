import type { ReactNode } from 'react';
import { Stack } from './Stack';
import { Text } from './Text';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-sm border border-dashed border-line bg-paper px-6 py-12 text-center">
      <Stack gap={12}>
        <Text variant="h3">{title}</Text>
        {description ? <Text variant="muted">{description}</Text> : null}
        {action ? <div className="flex justify-center pt-2">{action}</div> : null}
      </Stack>
    </div>
  );
}
