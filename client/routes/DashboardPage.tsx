import { Navigate } from 'react-router-dom';
import {
  LEARNER_JOURNEY,
  MENTOR_JOURNEY,
  USER_ROLE,
  learnerDashboardModel,
  lifecycleProfileFrom,
  mentorDashboardModel,
  type DashboardAction,
  type MentorQueueItem,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Grid,
  Page,
  Stack,
  Stepper,
  Text,
} from '../components';
import { useDashboardData } from '../features/dashboard/useDashboardData';
import { useAuth } from '../lib/auth';

export function DashboardPage() {
  const { account } = useAuth();
  const data = useDashboardData(account);

  if (!account) return null;
  if (account.role === USER_ROLE.admin) return <Navigate to="/admin" replace />;

  if (!data.ready) {
    return (
      <Page>
        <Text variant="muted">Opening your dashboard…</Text>
      </Page>
    );
  }

  const profile = lifecycleProfileFrom(account, account.role === USER_ROLE.mentor ? data.mentor : data.learner);

  if (account.role === USER_ROLE.mentor) {
    return (
      <MentorDashboard
        model={mentorDashboardModel({
          profile,
          applications: data.applications,
          relationships: data.relationships,
          contracts: data.contracts,
        })}
        error={data.error}
      />
    );
  }

  return (
    <LearnerDashboard
      model={learnerDashboardModel({
        profile,
        applications: data.applications,
        relationships: data.relationships,
        contracts: data.contracts,
      })}
      error={data.error}
    />
  );
}

function LearnerDashboard({
  model,
  error,
}: {
  model: ReturnType<typeof learnerDashboardModel>;
  error: string | null;
}) {
  const stageIndex = LEARNER_JOURNEY.findIndex((step) => step.id === model.stage);

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="caption">Learner dashboard</Text>
          <Text variant="h1">Your learning journey</Text>
          <Text variant="muted">
            Discover, connect, agree, learn, build, prove, then showcase. This page answers
            what to do next — not a feed of everything.
          </Text>
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        <NextActionCard action={model.next} />

        <Card>
          <Stack gap={16}>
            <Text variant="caption">Where you are</Text>
            <Text variant="h3">{LEARNER_JOURNEY[stageIndex]?.label ?? 'Discover'}</Text>
            <Stepper steps={[...LEARNER_JOURNEY]} currentStep={Math.max(0, stageIndex)} layout="rail" />
          </Stack>
        </Card>

        {model.hasActivity ? (
          <Grid cols={2}>
            <Card>
              <Stack gap={8}>
                <Text variant="caption">Who you are waiting for</Text>
                <Text variant="h3">{model.waitingFor}</Text>
              </Stack>
            </Card>
            <Card>
              <Stack gap={8}>
                <Text variant="caption">Milestone needing attention</Text>
                <Text variant="h3">{model.milestoneNeedingAttention}</Text>
              </Stack>
            </Card>
          </Grid>
        ) : (
          <OnboardingList
            heading="Start here"
            detail="No pairings yet. These three steps make you ready to apply."
            actions={model.onboarding}
          />
        )}

        <Card>
          <Stack gap={12}>
            <Text variant="caption">What you have achieved</Text>
            {model.achievements.map((item) => (
              <Text key={item}>{item}</Text>
            ))}
          </Stack>
        </Card>
      </Stack>
    </Page>
  );
}

function MentorDashboard({
  model,
  error,
}: {
  model: ReturnType<typeof mentorDashboardModel>;
  error: string | null;
}) {
  const stageIndex = MENTOR_JOURNEY.findIndex((step) => step.id === model.stage);

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="caption">Mentor dashboard</Text>
          <Text variant="h1">Your mentoring work</Text>
          <Text variant="muted">
            Be discovered, connect, guide, review, validate, then build legacy. The queue
            below is only the work that needs you.
          </Text>
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        <NextActionCard action={model.next} />

        <Card>
          <Stack gap={16}>
            <Text variant="caption">Where you are</Text>
            <Text variant="h3">{MENTOR_JOURNEY[stageIndex]?.label ?? 'Be discovered'}</Text>
            <Stepper steps={[...MENTOR_JOURNEY]} currentStep={Math.max(0, stageIndex)} layout="rail" />
          </Stack>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Count label="Pending applications" value={model.pendingApplications} href="/dashboard/applications" />
          <Count label="Learners needing you" value={model.learnersNeedingAttention} href="/dashboard/mentorships" />
          <Count label="Contracts to review" value={model.contractsAwaitingReview} href="/dashboard/mentorships" />
          <Count label="Evidence to review" value={model.evidenceAwaitingReview} href="/dashboard/mentorships" />
          <Count label="Completed outcomes" value={model.completedOutcomes} href="/dashboard/mentorships" />
        </div>

        {model.hasActivity ? (
          <Stack gap={16}>
            <Text variant="caption">Work queue</Text>
            {model.queue.length === 0 ? (
              <EmptyState
                title="Nothing waiting on you"
                description="Learners will appear here when they apply, send a contract, or submit evidence."
              />
            ) : (
              <Stack gap={12}>
                {model.queue.map((item, index) => (
                  <QueueRow key={`${item.kind}-${item.href}-${index}`} item={item} />
                ))}
              </Stack>
            )}
          </Stack>
        ) : (
          <OnboardingList
            heading="Prepare to be discovered"
            detail="No learners yet. These steps make your mentoring profile findable."
            actions={model.onboarding}
          />
        )}
      </Stack>
    </Page>
  );
}

function NextActionCard({ action }: { action: DashboardAction }) {
  return (
    <Card padding="lg">
      <Stack gap={16}>
        <Text variant="caption">What to do next</Text>
        <Text variant="h2">{action.title}</Text>
        <Text variant="muted">{action.detail}</Text>
        <Cluster gap={8}>
          <Button to={action.href}>{action.cta}</Button>
        </Cluster>
      </Stack>
    </Card>
  );
}

function OnboardingList({
  heading,
  detail,
  actions,
}: {
  heading: string;
  detail: string;
  actions: DashboardAction[];
}) {
  return (
    <Stack gap={16}>
      <Stack gap={8}>
        <Text variant="caption">{heading}</Text>
        <Text variant="muted">{detail}</Text>
      </Stack>
      <Grid cols={3}>
        {actions.map((action) => (
          <Card key={action.title}>
            <Stack gap={12}>
              <Text variant="h3">{action.title}</Text>
              <Text variant="small">{action.detail}</Text>
              <Button variant="secondary" size="sm" to={action.href}>
                {action.cta}
              </Button>
            </Stack>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

function Count({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Card padding="sm">
      <Stack gap={8}>
        <Text variant="h2" as="p">
          {value}
        </Text>
        <Text variant="small">{label}</Text>
        <Button variant="ghost" size="sm" to={href}>
          Open
        </Button>
      </Stack>
    </Card>
  );
}

function QueueRow({ item }: { item: MentorQueueItem }) {
  return (
    <Card padding="sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Stack gap={8}>
          <Cluster gap={8}>
            <Badge tone={item.kind === 'outcome' ? 'success' : item.kind === 'application' ? 'accent' : 'neutral'}>
              {item.title}
            </Badge>
          </Cluster>
          <Text>{item.detail}</Text>
        </Stack>
        <Button size="sm" to={item.href}>
          Open
        </Button>
      </div>
    </Card>
  );
}
