"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Nav from "@/components/Nav";
import {
  getAsset,
  getContract,
  approveContract,
  AssetOut,
  GeneratedContractOut,
} from "@/lib/api";
import { getRole } from "@/lib/auth";

export default function ContractPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = Number(params.id);
  const role = getRole();

  const [asset, setAsset] = useState<AssetOut | null>(null);
  const [contract, setContract] = useState<GeneratedContractOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [polling, setPolling] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await getAsset(assetId);
      setAsset(a);
      const isGenerating = [
        "awaiting_contract_generation",
        "intermediary_review_complete",
      ].includes(a.status);
      setPolling(isGenerating);

      if (!isGenerating) {
        const c = await getContract(assetId).catch(() => null);
        setContract(c);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [polling, load]);

  async function handleApprove() {
    if (!role) return;
    setApproving(true);
    setError("");
    try {
      await approveContract(assetId, role);
      await load();
      if (asset?.status === "deploying" || asset?.status === "deployed") {
        router.push(`/assets/${assetId}/deployment`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  const alreadyApproved =
    role === "intermediary"
      ? contract?.intermediary_approved
      : contract?.reviewer_approved;

  const bothApproved =
    contract?.intermediary_approved && contract?.reviewer_approved;

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
          <span>Contract</span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 28,
          }}
        >
          Smart Contract Review
        </h1>

        {/* Generating spinner */}
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
              Generating Smart Contract…
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Claude is generating the Solidity contract from your term sheet
              parameters
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "var(--danger-dim)",
              border: "1px solid var(--danger)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "var(--danger)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {contract && (
          <>
            {/* Human summary */}
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 12,
                }}
              >
                Plain-English Summary
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                {contract.human_summary}
              </p>
            </div>

            {/* Metadata */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Template
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}
                >
                  {contract.template_used.replace(/_/g, " ")}
                </div>
              </div>

              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Approvals
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: contract.intermediary_approved
                        ? "var(--emerald)"
                        : "var(--text-dim)",
                    }}
                  >
                    {contract.intermediary_approved ? "✓" : "○"} Intermediary
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: contract.reviewer_approved
                        ? "var(--emerald)"
                        : "var(--text-dim)",
                    }}
                  >
                    {contract.reviewer_approved ? "✓" : "○"} tZero Reviewer
                  </span>
                </div>
              </div>
            </div>

            {/* Solidity source toggle */}
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                marginBottom: 24,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setShowCode(!showCode)}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <span>Solidity Source Code</span>
                <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                  {showCode ? "▲ Hide" : "▼ Show"}
                </span>
              </button>

              {showCode && (
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    padding: 20,
                    background: "var(--surface)",
                    overflowX: "auto",
                  }}
                >
                  <pre
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      fontFamily: "monospace",
                      margin: 0,
                    }}
                  >
                    {contract.solidity_source}
                  </pre>
                </div>
              )}
            </div>

            {/* Approval actions */}
            {!bothApproved && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                {alreadyApproved ? (
                  <div
                    style={{
                      background: "var(--emerald-dim)",
                      border: "1px solid var(--emerald-border)",
                      color: "var(--emerald)",
                      padding: "12px 20px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ✓ You have approved this contract
                  </div>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    style={{
                      background: approving ? "var(--muted)" : "var(--emerald)",
                      color: "var(--void)",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 28px",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: approving ? "not-allowed" : "pointer",
                    }}
                  >
                    {approving ? "Approving…" : "Approve Contract"}
                  </button>
                )}
              </div>
            )}

            {bothApproved && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    background: "var(--emerald-dim)",
                    border: "1px solid var(--emerald-border)",
                    color: "var(--emerald)",
                    padding: "12px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  ✓ Both parties approved — deployment triggered
                </div>
                <button
                  onClick={() => router.push(`/assets/${assetId}/deployment`)}
                  style={{
                    background: "var(--emerald)",
                    color: "var(--void)",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px 20px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  View Deployment →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
