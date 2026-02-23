import { ActionButton, Card, PageLayout } from "@gamenet/example-ui";
import { version } from "../../package.json" with { type: "json" };

function Home() {
  return (
    <PageLayout title="Welcome to GameNet" centered titleSize="4xl">
      <p className="text-xl text-[var(--color-text-secondary)] mb-8 transition-colors duration-200">
        Multiplayer gaming made simple
      </p>
      <Card padding="md" className="max-w-md mx-auto">
        <p className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
          GameNet Library v{version}
        </p>
        <div className="mt-6 space-y-4">
          <ActionButton color="blue" to="/host">
            Host a Game
          </ActionButton>
          <ActionButton color="green" to="/join">
            Join a Game
          </ActionButton>
        </div>
      </Card>
    </PageLayout>
  );
}

export default Home;
