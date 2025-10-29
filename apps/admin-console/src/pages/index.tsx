import { useState } from "react";
import Head from "next/head";
import { TenantSelector } from "../components/TenantSelector";
import { ToolTable } from "../components/ToolTable";
import { PolicyCheckForm } from "../components/PolicyCheckForm";
import { ManifestViewer } from "../components/ManifestViewer";

const Home = () => {
  const [tenant, setTenant] = useState<string | null>(null);

  return (
    <>
      <Head>
        <title>Sentinel MCP Console</title>
      </Head>
      <main style={{ padding: "2rem", fontFamily: "Inter, sans-serif" }}>
        <header>
          <h1>Sentinel MCP Console (R&amp;D)</h1>
          <p style={{ maxWidth: "60ch" }}>
            Lightweight console to peek at registered MCP tools, flip the kill-switch, and probe
            policy decisions. Point <code>NEXT_PUBLIC_CONTROL_PLANE_URL</code> at your running
            FastAPI instance (defaults to http://localhost:8000).
          </p>
        </header>

        <section style={{ marginTop: "1.5rem" }}>
          <TenantSelector activeTenant={tenant} onSelect={setTenant} />
          <ToolTable tenant={tenant} />
        </section>

        <PolicyCheckForm tenant={tenant} />
        <ManifestViewer />
      </main>
    </>
  );
};

export default Home;
