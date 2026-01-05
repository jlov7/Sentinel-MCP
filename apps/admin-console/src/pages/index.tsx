import React, { CSSProperties, useEffect, useState } from "react";
import Head from "next/head";
import { TenantSelector } from "../components/TenantSelector";
import { ToolTable } from "../components/ToolTable";
import { PolicyCheckForm } from "../components/PolicyCheckForm";
import { ManifestViewer } from "../components/ManifestViewer";
import { CONTROL_PLANE_URL, fetchHealth } from "../lib/api";

const Home = () => {
  const [tenant, setTenant] = useState<string | null>(null);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkHealth = async (showPending: boolean) => {
      if (showPending) {
        setStatus("checking");
      }
      try {
        await fetchHealth();
        if (mounted) {
          setStatus("online");
        }
      } catch {
        if (mounted) {
          setStatus("offline");
        }
      } finally {
        if (mounted) {
          setLastCheck(new Date().toLocaleTimeString());
        }
      }
    };

    checkHealth(true);
    const interval = setInterval(() => checkHealth(false), 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const statusClass =
    status === "online"
      ? "status-pill status-pill--online"
      : status === "offline"
      ? "status-pill status-pill--offline"
      : "status-pill status-pill--checking";

  const statusLabel =
    status === "online" ? "Online" : status === "offline" ? "Offline" : "Checking";

  const revealStyle = (delay: string): CSSProperties => ({ "--delay": delay });

  return (
    <>
      <Head>
        <title>Sentinel MCP Console</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="app">
        <header className="hero reveal" style={revealStyle("0s")}>
          <div>
            <h1 className="hero__title">Sentinel MCP Console</h1>
            <p className="hero__subtitle">
              Govern AI agent tools with live policy checks, kill-switch control, and verified
              provenance. Built as a personal R&amp;D cockpit for high-stakes automation.
            </p>
            <div className="hero__chips">
              <span className="hero__chip">Policy enforcement</span>
              <span className="hero__chip">Kill switch</span>
              <span className="hero__chip">Provenance signing</span>
              <span className="hero__chip">OPA-backed</span>
            </div>
          </div>
          <div className="panel">
            <h2 className="panel__title">Control plane status</h2>
            <p className="panel__meta">
              <span className={statusClass}>{statusLabel}</span>
            </p>
            <div className="panel__grid">
              <div>
                <div className="field__label">Endpoint</div>
                <div>
                  <code>{CONTROL_PLANE_URL}</code>
                </div>
              </div>
              <div>
                <div className="field__label">Last check</div>
                <div>{lastCheck ?? "Checking..."}</div>
              </div>
              <div>
                <div className="field__label">Active tenant</div>
                <div>{tenant ?? "All tenants"}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="section reveal" style={revealStyle("0.08s")}>
          <div className="section__header">
            <div>
              <h2 className="section__title">Tool inventory and kill switch</h2>
              <p className="section__subtitle">
                Browse the registered tools, inspect metadata, and disable access instantly when
                risk spikes.
              </p>
            </div>
            <TenantSelector activeTenant={tenant} onSelect={setTenant} />
          </div>
          <ToolTable tenant={tenant} />
        </section>

        <section className="section split reveal" style={revealStyle("0.16s")}>
          <PolicyCheckForm tenant={tenant} />
          <ManifestViewer />
        </section>
      </main>
    </>
  );
};

export default Home;
