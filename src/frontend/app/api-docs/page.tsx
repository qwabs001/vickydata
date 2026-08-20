"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

/* ────── Types ────── */
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type Endpoint = {
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  auth: boolean;
  requestBody?: string;
  responseBody?: string;
  params?: string;
};

type Section = {
  id: string;
  title: string;
  icon: string;
  description: string;
  endpoints: Endpoint[];
};

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://vickydata.com").replace(/\/$/, "");
const API_BASE_URL = `${APP_URL}/api`;

/* ────── API Sections ────── */
const sections: Section[] = [
  {
    id: "auth",
    title: "Authentication",
    icon: "🔐",
    description: "Create accounts and manage authentication tokens.",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/signup",
        title: "Register",
        description: "Create a new user account.",
        auth: false,
        requestBody: `{
  "username": "johndoe",
  "phoneNumber": "0241234567",
  "password": "securepassword",
  "referralCode": "optional-referral-code"
}`,
        responseBody: `{
  "user": {
    "id": "clx...",
    "username": "johndoe",
    "phoneNumber": "0241234567",
    "role": "CUSTOMER"
  }
}`
      },
      {
        method: "POST",
        path: "/api/auth/login",
        title: "Login",
        description: "Authenticate and get user credentials.",
        auth: false,
        requestBody: `{
  "username": "johndoe",
  "password": "securepassword"
}`,
        responseBody: `{
  "user": {
    "id": "clx...",
    "username": "johndoe",
    "phoneNumber": "0241234567",
    "role": "CUSTOMER"
  }
}`
      },
      {
        method: "POST",
        path: "/api/auth/reset-password",
        title: "Reset Password",
        description: "Reset password using username and phone number verification.",
        auth: false,
        requestBody: `{
  "username": "johndoe",
  "phoneNumber": "0241234567",
  "newPassword": "newsecurepassword"
}`,
        responseBody: `{
  "message": "Password updated."
}`
      }
    ]
  },
  {
    id: "networks",
    title: "Networks",
    icon: "📡",
    description: "List available mobile networks.",
    endpoints: [
      {
        method: "GET",
        path: "/api/networks",
        title: "List Networks",
        description: "Get all active mobile networks.",
        auth: false,
        responseBody: `[
  {
    "id": "clx...",
    "name": "MTN",
    "displayName": "MTN",
    "logoUrl": "/images/networks/MTN-Logo.png",
    "sortOrder": 1
  },
  {
    "id": "clx...",
    "name": "TELECEL",
    "displayName": "Telecel",
    "logoUrl": "/images/networks/Telecel.webp",
    "sortOrder": 2
  }
]`
      }
    ]
  },
  {
    id: "plans",
    title: "Data Plans",
    icon: "📦",
    description: "Browse available data plans and pricing.",
    endpoints: [
      {
        method: "GET",
        path: "/api/data-plans?scope=public",
        title: "List All Plans",
        description: "Get all active data plans across all networks.",
        auth: false,
        params: `scope=public      (required) Show active plans only
networkId=xxx     (optional) Filter by network ID
featured=true     (optional) Show featured plans only
limit=10          (optional) Limit results`,
        responseBody: `[
  {
    "id": "clx...",
    "name": "1GB",
    "dataAmount": "1GB",
    "price": 4.00,
    "validity": "30 days",
    "networkId": "clx...",
    "network": {
      "id": "clx...",
      "name": "MTN",
      "displayName": "MTN"
    }
  }
]`
      },
      {
        method: "GET",
        path: "/api/data-plans/by-network?networkId=xxx",
        title: "Plans by Network",
        description: "Get data plans for a specific network.",
        auth: false,
        params: `networkId=xxx     (required) The network ID`,
        responseBody: `[
  {
    "id": "clx...",
    "name": "1GB",
    "dataAmount": "1GB",
    "price": 4.00,
    "validity": "30 days"
  }
]`
      }
    ]
  },
  {
    id: "orders",
    title: "Orders",
    icon: "🛒",
    description: "Create and manage data bundle orders.",
    endpoints: [
      {
        method: "POST",
        path: "/api/orders",
        title: "Create Order",
        description: "Place a new data bundle order.",
        auth: true,
        requestBody: `{
  "userId": "clx...",
  "networkId": "clx...",
  "dataPlanId": "clx...",
  "recipientNumber": "0241234567",
  "rewardToUse": 0,
  "useWallet": false
}`,
        responseBody: `{
  "order": {
    "id": "clx...",
    "orderNumber": "ORD-20260212-XXXXX",
    "amount": 4.00,
    "status": "PENDING",
    "recipientNumber": "0241234567",
    "network": { "name": "MTN" },
    "dataPlan": { "name": "1GB", "dataAmount": "1GB" }
  }
}`
      },
      {
        method: "POST",
        path: "/api/orders/quick-order",
        title: "Quick Order",
        description: "Create account and place order in a single request.",
        auth: false,
        requestBody: `{
  "username": "johndoe",
  "phoneNumber": "0241234567",
  "password": "securepassword",
  "networkId": "clx...",
  "dataPlanId": "clx...",
  "recipientNumber": "0241234567",
  "referralCode": "optional"
}`,
        responseBody: `{
  "order": {
    "id": "clx...",
    "orderNumber": "ORD-20260212-XXXXX",
    "amount": 4.00,
    "status": "PENDING"
  },
  "user": {
    "id": "clx...",
    "username": "johndoe"
  }
}`
      },
      {
        method: "GET",
        path: "/api/orders?userId=xxx",
        title: "List Orders",
        description: "Get all orders for a specific user.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `[
  {
    "id": "clx...",
    "orderNumber": "ORD-20260212-XXXXX",
    "amount": 4.00,
    "status": "COMPLETED",
    "recipientNumber": "0241234567",
    "createdAt": "2026-02-12T10:00:00.000Z",
    "network": { "name": "MTN" },
    "dataPlan": { "name": "1GB" }
  }
]`
      },
      {
        method: "GET",
        path: "/api/orders/:id",
        title: "Get Order",
        description: "Get order details by ID.",
        auth: true,
        responseBody: `{
  "id": "clx...",
  "orderNumber": "ORD-20260212-XXXXX",
  "amount": 4.00,
  "status": "COMPLETED",
  "recipientNumber": "0241234567",
  "network": { "name": "MTN" },
  "dataPlan": { "name": "1GB", "dataAmount": "1GB" },
  "user": { "id": "clx...", "username": "johndoe" }
}`
      }
    ]
  },
  {
    id: "payments",
    title: "Payments",
    icon: "💳",
    description: "Initialize and verify payments for orders.",
    endpoints: [
      {
        method: "POST",
        path: "/api/payments/initialize",
        title: "Initialize Payment",
        description: "Start a Moolre hosted checkout for an order, wallet top-up, or agent upgrade.",
        auth: true,
        requestBody: `{
  "userId": "clx...",
  "amount": 10,
  "currency": "GHS",
  "ref": "ORDER-clx-1741852000",
  "type": "order",
  "networkId": "clx_network",
  "dataPlanId": "clx_plan",
  "recipientNumber": "0241234567"
}`,
        responseBody: `{
  "paymentUrl": "https://pos.moolre.com/checkout/xxx",
  "reference": "MOOLRE-xxx"
}`
      },
      {
        method: "POST",
        path: "/api/payments/verify",
        title: "Verify Payment",
        description: "Confirm a completed Moolre payment and process the linked order or wallet top-up.",
        auth: true,
        requestBody: `{
  "reference": "MOOLRE-xxx"
}`,
        responseBody: `{
  "status": "completed",
  "type": "order",
  "orderId": "clx...",
  "orderNumber": "ORD-20260313-XXXXX"
}`
      }
    ]
  },
  {
    id: "wallet",
    title: "Wallet",
    icon: "👛",
    description: "Manage user wallet balance and transactions.",
    endpoints: [
      {
        method: "GET",
        path: "/api/wallet/balance?userId=xxx",
        title: "Get Balance",
        description: "Get current wallet balance.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `{
  "totalAdded": 50.00,
  "totalSpent": 20.00,
  "currentBalance": 30.00
}`
      },
      {
        method: "GET",
        path: "/api/wallet/transactions?userId=xxx",
        title: "Transaction History",
        description: "Get wallet transaction history.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `[
  {
    "id": "clx...",
    "type": "CREDIT",
    "amount": 50.00,
    "balanceBefore": 0,
    "balanceAfter": 50.00,
    "description": "Wallet top-up",
    "createdAt": "2026-02-12T10:00:00.000Z"
  }
]`
      },
      {
        method: "POST",
        path: "/api/wallet/add",
        title: "Add Funds",
        description: "Add funds to wallet after payment verification.",
        auth: true,
        requestBody: `{
  "userId": "clx...",
  "amount": 50.00
}`,
        responseBody: `{
  "transaction": {
    "id": "clx...",
    "amount": 50.00,
    "balanceBefore": 0,
    "balanceAfter": 50.00
  }
}`
      }
    ]
  },
  {
    id: "rewards",
    title: "Rewards",
    icon: "🎁",
    description: "Track referral rewards and withdrawal.",
    endpoints: [
      {
        method: "GET",
        path: "/api/rewards/balance?userId=xxx",
        title: "Rewards Balance",
        description: "Get current rewards balance.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `{
  "totalEarned": 5.00,
  "totalSpent": 0,
  "totalWithdrawn": 0,
  "currentBalance": 5.00
}`
      },
      {
        method: "GET",
        path: "/api/rewards/transactions?userId=xxx",
        title: "Rewards History",
        description: "Get rewards transaction history.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `[
  {
    "id": "clx...",
    "type": "EARNED",
    "amount": 0.50,
    "description": "Referral cashback (0.5%) from johndoe",
    "createdAt": "2026-02-12T10:00:00.000Z"
  }
]`
      },
      {
        method: "POST",
        path: "/api/rewards/withdraw",
        title: "Withdraw Rewards",
        description: "Submit a withdrawal request for rewards.",
        auth: true,
        requestBody: `{
  "userId": "clx...",
  "amount": 5.00,
  "phoneNumber": "0241234567"
}`,
        responseBody: `{
  "withdrawal": {
    "id": "clx...",
    "amount": 5.00,
    "status": "PENDING"
  }
}`
      }
    ]
  },
  {
    id: "profile",
    title: "Profile",
    icon: "👤",
    description: "Manage user profile information.",
    endpoints: [
      {
        method: "GET",
        path: "/api/profile?userId=xxx",
        title: "Get Profile",
        description: "Get user profile details.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `{
  "id": "clx...",
  "username": "johndoe",
  "phoneNumber": "0241234567",
  "role": "CUSTOMER",
  "createdAt": "2026-02-12T10:00:00.000Z"
}`
      },
      {
        method: "PATCH",
        path: "/api/profile",
        title: "Update Profile",
        description: "Update user profile information.",
        auth: true,
        requestBody: `{
  "userId": "clx...",
  "username": "newname",
  "phoneNumber": "0241234567"
}`,
        responseBody: `{
  "user": {
    "id": "clx...",
    "username": "newname",
    "phoneNumber": "0241234567"
  }
}`
      }
    ]
  },
  {
    id: "referrals",
    title: "Referrals",
    icon: "🔗",
    description: "Get referral links and track referred users.",
    endpoints: [
      {
        method: "GET",
        path: "/api/referrals/link?userId=xxx",
        title: "Get Referral Link",
        description: "Get unique referral link for sharing.",
        auth: true,
        params: `userId=xxx        (required) The user ID`,
        responseBody: `{
  "referralCode": "abc123",
  "referralLink": "${APP_URL}?ref=abc123"
}`
      }
    ]
  },
  {
    id: "webhooks",
    title: "Webhooks (API Clients)",
    icon: "📩",
    description: "Simple setup for external websites to receive live order status updates.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/webhooks",
        title: "Subscribe Webhook",
        description:
          "Create a webhook subscription. Use header X-API-KEY: YOUR_PUBLIC_KEY. Callback URL must be HTTPS.",
        auth: true,
        requestBody: `{
  "url": "https://your-site.com/api/vickydata/webhook",
  "events": ["order.updated"],
  "secret": "your_webhook_secret"
}`,
        responseBody: `{
  "id": "wh_123",
  "url": "https://your-site.com/api/vickydata/webhook",
  "events": ["order.updated"],
  "enabled": true,
  "created_at": "2026-02-20T12:00:00.000Z"
}`
      },
      {
        method: "GET",
        path: "/api/v1/webhooks",
        title: "List Webhooks",
        description: "Get all active webhook subscriptions for the API key owner.",
        auth: true,
        responseBody: `{
  "webhooks": [
    {
      "id": "wh_123",
      "url": "https://your-site.com/api/vickydata/webhook",
      "events": ["order.updated"],
      "enabled": true,
      "created_at": "2026-02-20T12:00:00.000Z",
      "updated_at": "2026-02-20T12:00:00.000Z"
    }
  ]
}`
      },
      {
        method: "DELETE",
        path: "/api/v1/webhooks/:id",
        title: "Delete Webhook",
        description: "Delete a webhook subscription by ID.",
        auth: true,
        responseBody: `{
  "ok": true
}`
      },
      {
        method: "POST",
        path: "Webhook callback payload",
        title: "What Your Site Receives",
        description:
          "Your callback endpoint receives this JSON plus headers: X-Webhook-Signature, X-Webhook-Event, X-Webhook-Id.",
        auth: false,
        responseBody: `{
  "event": "order.updated",
  "order_id": "ord_123",
  "client_order_id": "client_456",
  "status": "success",
  "amount": 4.2,
  "currency": "GHS",
  "timestamp": "2026-02-20T12:00:00.000Z",
  "signature": "hmac_signature_here"
}`
      }
    ]
  }
];

/* ────── Method Badge ────── */
const methodColors: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700"
};

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${methodColors[method]}`}>
      {method}
    </span>
  );
}

/* ────── Code Block ────── */
function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between rounded-t-xl bg-slate-800 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[11px] font-semibold text-slate-400 hover:text-white"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-xl bg-slate-900 p-4 text-[13px] leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ────── Endpoint Card ────── */
function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <MethodBadge method={endpoint.method} />
        <code className="flex-1 text-sm font-medium text-slate-700">{endpoint.path}</code>
        {endpoint.auth && (
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-600">
            Auth
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-slate-400 transition ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3">
          <p className="text-sm text-slate-600">{endpoint.description}</p>
          {endpoint.params && (
            <CodeBlock code={endpoint.params} label="Query Parameters" />
          )}
          {endpoint.requestBody && (
            <CodeBlock code={endpoint.requestBody} label="Request Body" />
          )}
          {endpoint.responseBody && (
            <CodeBlock code={endpoint.responseBody} label="Response" />
          )}
        </div>
      )}
    </div>
  );
}

/* ────── Main Page ────── */
export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("auth");
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        endpoints: s.endpoints.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.path.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q)
        )
      }))
      .filter((s) => s.endpoints.length > 0);
  }, [search]);

  const currentSection = filteredSections.find((s) => s.id === activeSection) ?? filteredSections[0];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* ── Header ── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <Link href="/" className="text-lg font-black text-[#0f172a]">
              VickyData
            </Link>
            <span className="ml-3 rounded-full bg-[#2563eb] px-3 py-0.5 text-[11px] font-bold text-white">
              API Docs
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              v1.0
            </span>
            <Link
              href="/"
              className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* ── Intro ── */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-[#0f172a]">API Reference</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            VickyData provides a RESTful API for integrating data bundle purchases, wallet management, and
            rewards into your applications. All responses are JSON.
          </p>
        </div>

        {/* ── Base URL Card ── */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Base URL</h3>
              <code className="mt-2 block rounded-xl bg-slate-900 px-4 py-3 text-sm text-emerald-400">
                {API_BASE_URL}
              </code>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Authentication</h3>
              <p className="mt-2 text-sm text-slate-500">
                App endpoints use <code className="rounded bg-slate-100 px-1 text-xs">x-user-id</code>. External API endpoints
                under <code className="rounded bg-slate-100 px-1 text-xs">/api/v1</code> use
                <code className="ml-1 rounded bg-slate-100 px-1 text-xs">X-API-KEY</code>. Endpoints marked with
                <span className="mx-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-600">Auth</span>
                require authentication.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-[#f8fafc] p-4">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Request Headers</h4>
            <pre className="mt-2 text-[13px] text-slate-600">{`Content-Type: application/json
Accept: application/json
x-user-id: YOUR_USER_ID
X-API-KEY: YOUR_PUBLIC_KEY`}</pre>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* ── Sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-1">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filteredSections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    activeSection === s.id
                      ? "bg-[#2563eb] font-semibold text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span>{s.title}</span>
                  <span className={`ml-auto rounded-full px-1.5 text-[10px] font-bold ${
                    activeSection === s.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                  }`}>
                    {s.endpoints.length}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Mobile Nav ── */}
          <div className="lg:hidden">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search endpoints..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {filteredSections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeSection === s.id
                      ? "bg-[#2563eb] text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Content ── */}
          <main>
            {currentSection ? (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#0f172a]">
                    <span className="mr-2">{currentSection.icon}</span>
                    {currentSection.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{currentSection.description}</p>
                </div>
                <div className="space-y-4">
                  {currentSection.endpoints.map((ep, i) => (
                    <EndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <p className="text-sm text-slate-500">No endpoints match your search.</p>
              </div>
            )}
          </main>
        </div>

        {/* ── Error Codes ── */}
        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Error Codes</h2>
          <p className="mt-1 text-sm text-slate-500">Standard HTTP status codes used across all endpoints.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <th className="pb-3 pr-6">Code</th>
                  <th className="pb-3 pr-6">Status</th>
                  <th className="pb-3">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-6"><code className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">200</code></td>
                  <td className="py-3 pr-6">OK</td>
                  <td className="py-3">Request was successful.</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-6"><code className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">201</code></td>
                  <td className="py-3 pr-6">Created</td>
                  <td className="py-3">Resource was created successfully.</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-6"><code className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">400</code></td>
                  <td className="py-3 pr-6">Bad Request</td>
                  <td className="py-3">Invalid request body or missing required fields.</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-6"><code className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">401</code></td>
                  <td className="py-3 pr-6">Unauthorized</td>
                  <td className="py-3">Missing or invalid authentication.</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-6"><code className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">404</code></td>
                  <td className="py-3 pr-6">Not Found</td>
                  <td className="py-3">The requested resource was not found.</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-6"><code className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">409</code></td>
                  <td className="py-3 pr-6">Conflict</td>
                  <td className="py-3">Resource already exists (e.g. duplicate username).</td>
                </tr>
                <tr>
                  <td className="py-3 pr-6"><code className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">500</code></td>
                  <td className="py-3 pr-6">Server Error</td>
                  <td className="py-3">An unexpected error occurred on the server.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Rate Limits ── */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Rate Limiting</h2>
          <p className="mt-2 text-sm text-slate-500">
            API requests are rate-limited to ensure fair usage. If you exceed the limit, you will receive a
            <code className="mx-1 rounded bg-slate-100 px-1 text-xs">429 Too Many Requests</code> response.
            Please implement exponential backoff in your retry logic.
          </p>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} VickyData. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
