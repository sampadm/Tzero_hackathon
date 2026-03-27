"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getAssets, AssetOut } from "@/lib/api";
import { isLoggedIn, getRole } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--text-dim)",
  pdf_processing: "var(--amber)",
  awaiting_intermediary_review: "var(--amber)",
  submitted_for_compliance: "var(--info)",
  changes_requested: "var(--danger)",
  compliance_approved: "var(--info)",
  contract_generating: "var(--amber)",
  awaiting_contract_approval: "var(--amber)",
  contract_approved: "var(--info)",
  deploying: "var(--amber)",
  deployed: "var(--emerald)",
  rejected: "var(--danger)",
  withdrawn: "var(--text-dim)",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pdf_processing: "AI Extracting…",
  awaiting_intermediary_review: "Awaiting Review",
  submitted_for_compliance: "In Compliance Review",
  changes_requested: "Changes Requested",
  compliance_approved: "Compliance Approved",
  contract_generating: "Generating Contract…",
  awaiting_contract_approval: "Awaiting Approval",
  contract_approved: "Contract Approved",
  deploying: "Deploying…",
  deployed: "Deployed",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function getAssetLink(asset: AssetOut): string {
  const s = asset.status;
  if (["contract_generating", "awaiting_contract_approval", "contract_approved"].includes(s))
    return `/assets/${asset.id}/contract`;
  if (["deploying", "deployed"].includes(s))
    return `/assets/${asset.id}/deployment`;
  return `/assets/${asset.id}/review`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setRole(getRole());
    getAssets()
      .then(setAssets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              Asset Dashboard
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
              Track your tokenization submissions
            </p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {role === "reviewer" && (
              <Link
                href="/admin/queue"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Review Queue
              </Link>
            )}
            <Link
              href="/assets/new"
              style={{
                background: "var(--emerald)",
                color: "var(--void)",
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 14,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              + Tokenize Asset
            </Link>
          </div>
        </div>

        {/* Stats row */}
        {assets.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginBottom: 32,
            }}
          >
            {[
              {
                label: "Total",
                value: assets.length,
                color: "var(--text-primary)",
              },
              {
                label: "Active",
                value: assets.filter(
                  (a) => !["deployed", "rejected", "withdrawn", "draft"].includes(a.status)
                ).length,
                color: "var(--amber)",
              },
              {
                label: "Deployed",
                value: assets.filter((a) => a.status === "deployed").length,
                color: "var(--emerald)",
              },
              {
                label: "Rejected",
                value: assets.filter((a) => a.status === "rejected").length,
                color: "var(--danger)",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "20px 24px",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: s.color,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Asset list */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              color: "var(--text-dim)",
            }}
          >
            Loading assets…
          </div>
        ) : assets.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 40,
                marginBottom: 16,
                color: "var(--text-dim)",
              }}
            >
              ◈
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              No assets yet
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-dim)",
                marginBottom: 24,
              }}
            >
              Submit your first equity asset for tokenization
            </p>
            <Link
              href="/assets/new"
              style={{
                background: "var(--emerald)",
                color: "var(--void)",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Tokenize Asset
            </Link>
          </div>
        ) : (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  {["Asset Name", "Company", "Ref #", "Status", "Created", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 20px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-dim)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, i) => (
                  <tr
                    key={asset.id}
                    style={{
                      borderBottom:
                        i < assets.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {asset.name}
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                      }}
                    >
                      {asset.company_name}
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--text-dim)",
                        fontSize: 12,
                        fontFamily: "monospace",
                      }}
                    >
                      {asset.ref_number}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            STATUS_COLORS[asset.status] ?? "var(--text-dim)",
                          background: "var(--surface)",
                          border: `1px solid ${STATUS_COLORS[asset.status] ?? "var(--border)"}`,
                          padding: "3px 10px",
                          borderRadius: 20,
                        }}
                      >
                        {["pdf_processing", "contract_generating", "deploying"].includes(asset.status) && (
                          <span style={{ animation: "spin 1s linear infinite" }}>
                            ⟳
                          </span>
                        )}
                        {STATUS_LABELS[asset.status] ?? asset.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--text-dim)",
                        fontSize: 13,
                      }}
                    >
                      {new Date(asset.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <Link
                        href={getAssetLink(asset)}
                        style={{
                          color: "var(--emerald)",
                          fontSize: 13,
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
