import { Navigate, Outlet } from "react-router";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/api/trpc";

export function AuthGuard() {
  const session = authClient.useSession();
  const hasUsers = trpc.auth.hasUsers.useQuery();
  const profile = trpc.profile.get.useQuery(undefined, {
    enabled: !!session.data?.session,
    retry: false,
  });

  if (session.isPending || hasUsers.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session.data?.session) {
    if (hasUsers.data && !hasUsers.data.hasUsers) {
      return <Navigate to="/setup" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (profile.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (profile.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Error loading profile: {profile.error.message}</p>
      </div>
    );
  }

  if (!profile.data) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const hasUsers = trpc.auth.hasUsers.useQuery();

  if (session.isPending || hasUsers.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (session.data?.session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
