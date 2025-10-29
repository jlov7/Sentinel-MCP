import React, { useEffect, useState } from "react";
import { Tool, fetchTools, disableTool, enableTool } from "../lib/api";

type Props = {
  tenant: string | null;
};

export const ToolTable = ({ tenant }: Props) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTools = async () => {
    try {
      setLoading(true);
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

  const handleDisable = async (tool: Tool) => {
    try {
      await disableTool({
        tenant_slug: tool.owner,
        tool_name: tool.name,
        reason: "Admin console disable",
      });
      setMessage(`Disabled ${tool.name}`);
      await loadTools();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEnable = async (tool: Tool) => {
    try {
      await enableTool({
        tenant_slug: tool.owner,
        tool_name: tool.name,
      });
      setMessage(`Enabled ${tool.name}`);
      await loadTools();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return <p>Loading tools…</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>Failed to load tools: {error}</p>;
  }

  if (!tools.length) {
    return <p>No tools registered for this tenant.</p>;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "1rem",
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Tool</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Owner</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Scopes</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Status</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.id}>
              <td style={{ padding: "0.5rem 0" }}>
                <strong>{tool.name}</strong>
                <div style={{ fontSize: "0.85rem", color: "#555" }}>{tool.url}</div>
              </td>
              <td>{tool.owner}</td>
              <td>{tool.scopes.join(", ") || "—"}</td>
              <td>{tool.is_active ? "active" : "disabled"}</td>
              <td>
                {tool.is_active ? (
                  <button type="button" onClick={() => handleDisable(tool)}>
                    Kill-switch
                  </button>
                ) : (
                  <button type="button" onClick={() => handleEnable(tool)}>
                    Enable
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
