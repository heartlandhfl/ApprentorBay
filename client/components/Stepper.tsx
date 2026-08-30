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
};

/**
 * The single stepper used by every multi-step flow in ApprentorBay.
 * Do not introduce a second stepper UI.
 */
export function Stepper({ steps, currentStep, onStepSelect }: StepperProps) {
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
                className={`flex h-8 w-8 items-center justify-center rounded-full text-small font-medium ${
                  state === 'current'
                    ? 'bg-accent text-paper-raised'
                    : state === 'complete'
                      ? 'bg-ink text-paper-raised'
                      : 'border border-line bg-paper text-ink-muted'
                }`}
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

function StepCopy({
  step,
  state,
}: {
  step: Step;
  state: 'complete' | 'current' | 'upcoming';
}) {
  return (
    <Stack gap={4}>
      <Cluster gap={8}>
        <Text variant="h3" as="h3">
          {step.label}
        </Text>
        {state === 'current' ? (
          <Text variant="caption" as="span">
            Now
          </Text>
        ) : null}
      </Cluster>
      {step.description ? <Text variant="small">{step.description}</Text> : null}
    </Stack>
  );
}
