import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ModeProvider } from "@/contexts/ModeContext";
import { queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { InstallPWA } from "@/components/InstallPWA";
import { useRealtimeMount } from "@/lib/realtime";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const BrowsePage = lazy(() => import("@/pages/BrowsePage"));
const MyParcelsPage = lazy(() => import("@/pages/MyParcelsPage"));
const CreateParcelPage = lazy(() => import("@/pages/CreateParcelPage"));
const ParcelDetailPage = lazy(() => import("@/pages/ParcelDetailPage"));
const MessagesPage = lazy(() => import("@/pages/MessagesPage"));
const ConversationPage = lazy(() => import("@/pages/ConversationPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const EditProfilePage = lazy(() => import("@/pages/EditProfilePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const DeliveriesPage = lazy(() => import("@/pages/DeliveriesPage"));
const RoutesPage = lazy(() => import("@/pages/RoutesPage"));
const CreateRoutePage = lazy(() => import("@/pages/CreateRoutePage"));
const RouteDetailPage = lazy(() => import("@/pages/RouteDetailPage"));
const IncomingPage = lazy(() => import("@/pages/IncomingPage"));
const IncomingParcelDetailPage = lazy(() => import("@/pages/IncomingParcelDetailPage"));
const WalletPage = lazy(() => import("@/pages/WalletPage"));
const DisputesPage = lazy(() => import("@/pages/DisputesPage"));
const ReviewsPage = lazy(() => import("@/pages/ReviewsPage"));
const ConnectionsPage = lazy(() => import("@/pages/ConnectionsPage"));
const SubscriptionsPage = lazy(() => import("@/pages/SubscriptionsPage"));
const PaymentHistoryPage = lazy(() => import("@/pages/PaymentHistoryPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-navy">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-orange">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout() {
  const { user } = useAuth();
  useRealtimeMount();
  if (!user) return null;
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/my-parcels" element={<MyParcelsPage />} />
              <Route path="/create-parcel" element={<CreateParcelPage />} />
              <Route path="/parcels/:id" element={<ParcelDetailPage />} />
              <Route path="/incoming" element={<IncomingPage />} />
              <Route path="/incoming/:id" element={<IncomingParcelDetailPage />} />
              <Route path="/deliveries" element={<DeliveriesPage />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/routes/create" element={<CreateRoutePage />} />
              <Route path="/routes/:id" element={<RouteDetailPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/conversations/:id" element={<ConversationPage />} />
              <Route path="/parcels/:parcelId/chat" element={<ConversationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/edit" element={<EditProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/disputes" element={<DisputesPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/connections" element={<ConnectionsPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/payment-history" element={<PaymentHistoryPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="*" element={<Navigate to="/browse" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <BottomNav />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ModeProvider>
              <BrowserRouter basename="/app">
                <div className="flex flex-col h-full bg-surface dark:bg-navy">
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route
                        path="/*"
                        element={
                          <ProtectedRoute>
                            <AppLayout />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Suspense>
                </div>
                <InstallPWA />
                <Toaster
                  position="top-right"
                  toastOptions={{
                    classNames: {
                      toast: "dark:bg-navy-light dark:text-white dark:border-white/10",
                      error: "dark:bg-red-950 dark:border-red-800",
                      success: "dark:bg-green-950 dark:border-green-800",
                    },
                  }}
                />
              </BrowserRouter>
            </ModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
