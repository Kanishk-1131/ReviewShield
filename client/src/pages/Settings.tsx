import TopBar from "../components/layout/TopBar";
import Badge from "../components/ui/Badge";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar title="Settings" subtitle="Manage your account and workspace." />

      <div className="space-y-6 p-6">
        <div className="card p-5">
          <p className="mb-4 text-sm font-bold text-ink-900">Account</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-ink-50 pb-3">
              <span className="text-ink-400">Name</span>
              <span className="font-medium text-ink-800">{user?.name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink-50 pb-3">
              <span className="text-ink-400">Email</span>
              <span className="font-medium text-ink-800">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink-50 pb-3">
              <span className="text-ink-400">Role</span>
              <Badge tone="brand">{user?.role}</Badge>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-ink-400">Plan</span>
              <Badge tone={user?.plan === "enterprise" ? "success" : "neutral"}>{user?.plan}</Badge>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <p className="mb-1 text-sm font-bold text-ink-900">Model Version</p>
          <p className="text-sm text-ink-500">TF-IDF Vectorizer + Logistic Regression &middot; v1.0</p>
        </div>
      </div>
    </div>
  );
}
