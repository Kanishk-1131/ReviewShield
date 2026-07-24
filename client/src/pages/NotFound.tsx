import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
        <ShieldCheck className="h-6 w-6 text-white" />
      </div>
      <h1 className="font-display text-3xl font-bold text-ink-900">404 - Page not found</h1>
      <p className="max-w-sm text-sm text-ink-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/">
        <Button>Back to Home</Button>
      </Link>
    </div>
  );
}
