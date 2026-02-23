import type { ClientsPingListEntry } from "@gamenet/core";

function ClientList({
  clients,
  isHost,
}: {
  clients: ClientsPingListEntry[];
  isHost?: boolean;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
        Connected Clients ({clients.length})
      </h2>
      {clients.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm text-center py-4 transition-colors duration-200">
          No clients connected yet.
          {isHost && " Share your game code to get started!"}
        </p>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.clientId}
              className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 flex items-center justify-between transition-colors duration-200"
            >
              <div>
                <p className="font-semibold text-[var(--color-text-primary)] transition-colors duration-200">
                  {client.nickname}
                </p>
                <p className="font-mono text-xs text-[var(--color-text-secondary)] transition-colors duration-200">
                  {client.clientId}
                </p>
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
                Ping:{" "}
                {client.pingMs === null
                  ? "N/A"
                  : `${client.pingMs.toFixed(2)}ms`}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default ClientList;
