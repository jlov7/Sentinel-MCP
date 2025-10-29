import { useEffect, useState } from "react";
import { Tenant, fetchTenants } from "../lib/api";

type Props = {
  activeTenant: string | null;
  onSelect: (tenant: string | null) => void;
};

export const TenantSelector = ({ activeTenant, onSelect }: Props) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchTenants();
        setTenants(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p>Loading tenants…</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>Failed to load tenants: {error}</p>;
  }

  return (
    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      Tenant:
      <select
        value={activeTenant ?? ""}
        onChange={(event) => onSelect(event.target.value || null)}
      >
        <option value="">All</option>
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.slug}>
            {tenant.display_name} ({tenant.slug})
          </option>
        ))}
      </select>
    </label>
  );
};
