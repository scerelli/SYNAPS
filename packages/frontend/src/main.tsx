import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTrpcClient } from "@/api/trpc";
import { AuthGuard, GuestGuard } from "@/components/auth-guard";
import { Layout } from "@/components/layout";
import { LoginPage } from "@/pages/login";
import { SetupPage } from "@/pages/register";
import { OnboardingPage } from "@/pages/onboarding";
import { DashboardPage } from "@/pages/dashboard";
import { ReportsPage } from "@/pages/reports";
import { ReportNewPage } from "@/pages/report-new";
import { ReportDetailPage } from "@/pages/report-detail";
import { ProfilePage } from "@/pages/profile";
import { SettingsPage } from "@/pages/settings";
import { ConditionsPage } from "@/pages/conditions";
import { TrackPage } from "@/pages/track";
import { InsightsPage } from "@/pages/insights";
import { Toaster } from "@/components/ui/sonner";
import "./app.css";

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestGuard>
                  <LoginPage />
                </GuestGuard>
              }
            />
            <Route
              path="/setup"
              element={
                <GuestGuard>
                  <SetupPage />
                </GuestGuard>
              }
            />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<AuthGuard />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/new" element={<ReportNewPage />} />
                <Route path="/reports/:id" element={<ReportDetailPage />} />
                <Route path="/conditions" element={<ConditionsPage />} />
                <Route path="/track" element={<TrackPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/sleep" element={<Navigate to="/track?tab=sleep" replace />} />
                <Route path="/diet" element={<Navigate to="/track?tab=diet" replace />} />
                <Route path="/activity" element={<Navigate to="/track?tab=activity" replace />} />
                <Route path="/diary" element={<Navigate to="/track?tab=diary" replace />} />
                <Route path="/graph" element={<Navigate to="/insights?tab=graph" replace />} />
                <Route path="/environment" element={<Navigate to="/insights?tab=environment" replace />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
