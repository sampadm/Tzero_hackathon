"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Nav from "@/components/Nav";
import {
  getAsset,
  getDeployment,
  getAuditLog,
  AssetOut,
  DeploymentOut,
  AuditEventOut,
} from "@/lib/api";

function truncate(s: string | null | undefined, n = 12): string {
  if (!s) return "—";
  return s.length > n * 2 ? s.slice(0, n) + "…" + s.slice(-n) : s;
}

export default function DeploymentPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = Number(params.id);

  const [asset, setAsset] = useState<AssetOut | null>(null);
  const [deployment, setDeployment] = useState<DeploymentOut | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await getAsset(assetId);
      setAsset(a);
      setPolling(a.status === "deploying");

      const [d, log] = await Promise.all([
        getDeployment(assetId).catch(() => null),
        getAuditLog(assetId).catch(() => []),
      ]);
      setDeployment(d);
      setAuditLog(log);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [polling, load]);

  if (loading) {
    return (
      <>
        <Nav />
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
          Loading…
        </div>
      </>
    );
  }

  const deployed = asset?.status === "deployed";

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
          <span
            style={{ cursor: "pointer", color: "var(--emerald)" }}
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </span>
          {" / "}
          <span>{asset?.name}</span>
          {" / "}
          <span>Deployment</span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 28,
          }}
        >
          Blockchain Deployment
        </h1>

        {/* Deploying spinner */}
        {polling && (
          <div
            style={{
              background: "var(--amber-dim)",
              border: "1px solid var(--amber)",
              borderRadius: 10,
              padding: 24,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 24, color: "var(--amber)", marginBottom: 8 }}>
              ⟳
            </div>
            <div style={{ fontWeight: 600, color: "var(--amber)", marginBottom: 4 }}>
              Deploying to Sepolia Testnet…
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Broadcasting transaction and waiting for confirmation (up to 3 min)
            </div>
            {deployment?.tx_hash && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: "var(--text-dim)",
                  fontFamily: "monospace",
                }}
              >
                tx: {truncate(deployment.tx_hash, 16)}
              </div>
            )}
          </div>
        )}

        {/* Deployed success */}
        {deployed && deployment?.contract_address && (
          <div
            style={{
              background: "var(--emerald-dim)",
              border: "1px solid var(--emerald)",
              borderRadius: 10,
              padding: 24,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 32,
                color: "var(--emerald)",
                marginBottom: 8,
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: "var(--emerald)",
                marginBottom: 4,
              }}
            >
              Token Deployed Successfully
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Your ERC-3643 security token is live on Ethereum Sepolia
            </div>
          </div>
        )}

        {/* Contract details */}
        {deployment && (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 20,
              }}
            >
              Deployment Details
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Network", value: deployment.network ?? "Sepolia" },
                {
                  label: "Status",
                  value: deployment.status.toUpperCase(),
                  color:
                    deployment.status === "confirmed"
                      ? "var(--emerald)"
                      : deployment.status === "failed"
                        ? "var(--danger)"
                        : "var(--amber)",
                },
                {
                  label: "Contract Address",
                  value: deployment.contract_address,
                  mono: true,
                  copyable: true,
                },
                {
                  label: "Transaction Hash",
                  value: deployment.tx_hash,
                  mono: true,
                  copyable: true,
                },
                {
                  label: "Deployed At",
                  value: deployment.deployed_at
                    ? new Date(deployment.deployed_at).toLocaleString()
                    : "—",
                },
              ].map(({ label, value, color, mono, copyable }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-dim)",
                      flexShrink: 0,
                      width: 160,
                    }}
                  >
                    {label}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                      justifyContent: "flex-end",
                    }}
                  >
                    <span
                      style={{
                        fontSize: mono ? 12 : 14,
                        color: color ?? "var(--text-primary)",
                        fontFamily: mono ? "monospace" : "inherit",
                        fontWeight: 500,
                        wordBreak: "break-all",
                        textAlign: "right",
                      }}
                    >
                      {value ?? "—"}
                    </span>
                    {copyable && value && (
                      <button
                        onClick={() => navigator.clipboard.writeText(value)}
                        title="Copy"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text-dim)",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {deployment.error_message && (
                <div
                  style={{
                    background: "var(--danger-dim)",
                    border: "1px solid var(--danger)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "var(--danger)",
                    fontSize: 13,
                    marginTop: 8,
                  }}
                >
                  Error: {deployment.error_message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit log */}
        {auditLog.length > 0 && (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Audit Trail
            </div>
            {auditLog.map((event, i) => (
              <div
                key={event.id}
                style={{
                  padding: "12px 20px",
                  borderBottom:
                    i < auditLog.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {event.description}
                  </div>
                  {event.actor && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      by {event.actor}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {new Date(event.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
