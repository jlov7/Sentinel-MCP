import React, { useEffect, useState } from "react";
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
        setError(null);
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
    return <div className="status-line">Loading tenants...</div>;
  }

  if (error) {
    return <div className="status-line status-line--error">Failed to load tenants: {error}</div>;
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor="tenant-select">
        Tenant scope
      </label>
      <div className="field__control">
        <select
          id="tenant-select"
          value={activeTenant ?? ""}
          onChange={(event) => onSelect(event.target.value || null)}
        >
          <option value="">All tenants</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.slug}>
              {tenant.display_name} ({tenant.slug})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
