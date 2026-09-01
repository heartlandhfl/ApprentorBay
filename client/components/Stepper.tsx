import { Cluster, Stack } from './Stack';
import { Text } from './Text';

export type Step = {
  id: string;
  label: string;
  description?: string;
};

type StepperProps = {
  steps: Step[];
  currentStep: number;
  onStepSelect?: (index: number) => void;
  /** `rail` wraps on small screens so dashboards stay scannable. Same marks as the stack. */
  layout?: 'stack' | 'rail';
};

/**
 * The single stepper used by every multi-step flow in ApprentorBay.
 * Do not introduce a second stepper UI.
 */
export function Stepper({ steps, currentStep, onStepSelect, layout = 'stack' }: StepperProps) {
  if (layout === 'rail') {
    return (
      <ol className="flex flex-wrap gap-x-4 gap-y-4">
        {steps.map((step, index) => {
          const state =
            index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
          return (
            <li key={step.id} className="flex min-w-[6.5rem] flex-1 items-start gap-2">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-small font-medium ${markClass(state)}`}
              >
                {index + 1}
              </span>
              <StepCopy step={step} state={state} compact />
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const state =
          index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        const clickable = Boolean(onStepSelect) && index <= currentStep;

        return (
          <li key={step.id} className="flex gap-4">
            <div className="flex w-8 flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-small font-medium ${markClass(state)}`}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span className="min-h-8 w-px flex-1 bg-line" aria-hidden />
              ) : null}
            </div>
            <div className={`pb-8 ${index === steps.length - 1 ? 'pb-0' : ''}`}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepSelect?.(index)}
                  className="text-left"
                >
                  <StepCopy step={step} state={state} />
                </button>
              ) : (
                <StepCopy step={step} state={state} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function markClass(state: 'complete' | 'current' | 'upcoming'): string {
  if (state === 'current') return 'bg-accent text-paper-raised';
  if (state === 'complete') return 'bg-ink text-paper-raised';
  return 'border border-line bg-paper text-ink-muted';
}

function StepCopy({
  step,
  state,
  compact = false,
}: {
  step: Step;
  state: 'complete' | 'current' | 'upcoming';
  compact?: boolean;
}) {
  return (
    <Stack gap={4}>
      <Cluster gap={8}>
        <Text variant={compact ? 'small' : 'h3'} as={compact ? 'span' : 'h3'}>
          {step.label}
        </Text>
        {state === 'current' ? (
          <Text variant="caption" as="span">
            Now
          </Text>
        ) : null}
      </Cluster>
      {step.description && !compact ? <Text variant="small">{step.description}</Text> : null}
    </Stack>
  );
}
