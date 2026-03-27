"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { getComplianceQueue, ComplianceItem } from "@/lib/api";
import { isLoggedIn, getRole } from "@/lib/auth";

const REVIEW_TYPE_LABELS: Record<string, string> = {
  extraction_review: "AI Extraction Review",
  contract_review: "Contract Approval",
};

export default function QueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const role = getRole();
    if (role !== "reviewer" && role !== "intermediary") {
      router.replace("/dashboard");
      return;
    }

    getComplianceQueue()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Compliance Review Queue
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
            Pending items requiring your review
          </p>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              color: "var(--text-dim)",
            }}
          >
            Loading queue…
          </div>
        ) : items.length === 0 ? (
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
                fontSize: 32,
                color: "var(--text-dim)",
                marginBottom: 12,
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Queue is empty
            </div>
            <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
              No pending items require review
            </p>
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
                  {[
                    "Asset",
                    "Review Type",
                    "Status",
                    "Submitted",
                    "",
                  ].map((h) => (
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom:
                        i < items.length - 1
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
                      {item.asset_name}
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                      }}
                    >
                      {REVIEW_TYPE_LABELS[item.review_type] ?? item.review_type}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            item.status === "pending"
                              ? "var(--amber)"
                              : item.status === "approved"
                                ? "var(--emerald)"
                                : "var(--danger)",
                          background: "var(--surface)",
                          border: `1px solid ${
                            item.status === "pending"
                              ? "var(--amber)"
                              : item.status === "approved"
                                ? "var(--emerald)"
                                : "var(--danger)"
                          }`,
                          padding: "3px 10px",
                          borderRadius: 20,
                        }}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--text-dim)",
                        fontSize: 13,
                      }}
                    >
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td
                      style={{ padding: "16px 20px", textAlign: "right" }}
                    >
                      <button
                        onClick={() =>
                          router.push(`/admin/review/${item.id}`)
                        }
                        style={{
                          background:
                            item.status === "pending"
                              ? "var(--emerald)"
                              : "var(--surface)",
                          color:
                            item.status === "pending"
                              ? "var(--void)"
                              : "var(--text-secondary)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {item.status === "pending" ? "Review →" : "View"}
                      </button>
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
