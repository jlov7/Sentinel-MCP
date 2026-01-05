import React, { useEffect, useMemo, useState } from "react";
import { Tool, fetchTools, disableTool, enableTool } from "../lib/api";

type Props = {
  tenant: string | null;
};

export const ToolTable = ({ tenant }: Props) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const data = await fetchTools(tenant ?? undefined);
      setTools(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const filteredTools = useMemo(() => {
    if (!filter.trim()) {
      return tools;
    }
    const query = filter.trim().toLowerCase();
    return tools.filter((tool) => {
      const haystack = [
        tool.name,
        tool.owner,
        tool.url,
        ...(tool.scopes ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [filter, tools]);

  const activeCount = tools.filter((tool) => tool.is_active).length;
  const disabledCount = tools.length - activeCount;

  const handleDisable = async (tool: Tool) => {
    try {
      setActioningId(tool.id);
      setError(null);
      const tenantSlug = tenant ?? tool.owner;
      await disableTool({
        tenant_slug: tenantSlug,
        tool_name: tool.name,
        reason: "Admin console disable",
      });
      setMessage(`Disabled ${tool.name}`);
      await loadTools();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActioningId(null);
    }
  };

  const handleEnable = async (tool: Tool) => {
    try {
      setActioningId(tool.id);
      setError(null);
      const tenantSlug = tenant ?? tool.owner;
      await enableTool({
        tenant_slug: tenantSlug,
        tool_name: tool.name,
      });
      setMessage(`Enabled ${tool.name}`);
      await loadTools();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return <div className="status-line">Loading tools...</div>;
  }

  if (error) {
    return <div className="status-line status-line--error">Failed to load tools: {error}</div>;
  }

  if (!tools.length) {
    return <div className="status-line">No tools registered for this tenant.</div>;
  }

  return (
    <div className="panel">
      <div className="section__header">
        <div>
          <div className="section__subtitle">
            {tools.length} tools total, {activeCount} active, {disabledCount} disabled
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="tool-filter">
            Filter tools
          </label>
          <div className="field__control">
            <input
              id="tool-filter"
              type="text"
              value={filter}
              placeholder="Search by name, owner, or scope"
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        </div>
      </div>
      {message ? <div className="status-line status-line--success">{message}</div> : null}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Owner</th>
              <th>Scopes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTools.map((tool) => {
              const metadata = tool.metadata ?? {};
              const tags = [
                typeof metadata.tier === "string" ? `tier: ${metadata.tier}` : null,
                typeof metadata.data_sensitivity === "string"
                  ? `sensitivity: ${metadata.data_sensitivity}`
                  : null,
                typeof metadata.criticality === "string"
                  ? `criticality: ${metadata.criticality}`
                  : null,
              ].filter(Boolean) as string[];
              return (
                <tr key={tool.id}>
                  <td>
                    <div className="tool-name">{tool.name}</div>
                    <div className="tool-url">{tool.url}</div>
                    {tags.length ? (
                      <div className="tools-meta">
                        {tags.map((tag) => (
                          <span className="tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td>{tool.owner}</td>
                  <td>{tool.scopes.join(", ") || "—"}</td>
                  <td>
                    <span className={tool.is_active ? "badge badge--active" : "badge badge--inactive"}>
                      {tool.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    {tool.is_active ? (
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => handleDisable(tool)}
                        disabled={actioningId === tool.id}
                      >
                        {actioningId === tool.id ? "Disabling..." : "Kill switch"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleEnable(tool)}
                        disabled={actioningId === tool.id}
                      >
                        {actioningId === tool.id ? "Restoring..." : "Enable"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filter && !filteredTools.length ? (
        <div className="status-line">No tools match your filter.</div>
      ) : null}
    </div>
  );
};
