import { Stack } from './Stack';
import { Text } from './Text';

type MessageBubbleProps = {
  mine: boolean;
  author: string;
  text: string;
  time: string;
};

export function MessageBubble({ mine, author, text, time }: MessageBubbleProps) {
  return (
    <div className={`w-full max-w-[min(36rem,100%)] ${mine ? 'ml-auto' : 'mr-auto'}`}>
      <div
        className={`rounded-sm border px-4 py-3 ${
          mine ? 'border-accent-subtle bg-accent-subtle' : 'border-line bg-paper-raised'
        }`}
      >
        <Stack gap={4}>
          <Text variant="caption" as="span">
            {author}
          </Text>
          <Text>{text}</Text>
          <Text variant="small" as="span">
            {time}
          </Text>
        </Stack>
      </div>
    </div>
  );
}
