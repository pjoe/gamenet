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
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1 transition-colors duration-200">
        Clients ({clients.length})
      </h2>
      {clients.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-xs text-center py-2 transition-colors duration-200">
          No clients connected yet.
          {isHost && " Share your game code to get started!"}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--color-text-secondary)] text-xs">
              <th className="text-left font-medium pb-1">Name</th>
              <th className="text-right font-medium pb-1">Ping [ms]</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.clientId}
                className="group border-t border-[var(--color-border)]/40"
              >
                <td className="py-1 text-[var(--color-text-primary)]">
                  <span className="font-medium">{client.nickname}</span>
                  <span className="block font-mono text-[10px] text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 leading-tight">
                    {client.clientId}
                  </span>
                </td>
                <td className="py-1 text-right text-[var(--color-text-secondary)] tabular-nums">
                  {client.pingMs === null ? "N/A" : client.pingMs.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default ClientList;
