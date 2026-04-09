import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import CoursesPage from "@/pages/courses";
import CourseDetailPage from "@/pages/course-detail";
import DashboardPage from "@/pages/dashboard";
import MyCoursesPage from "@/pages/my-courses";
import LearnPage from "@/pages/learn";
import AffiliatePage from "@/pages/affiliate";
import PaymentsPage from "@/pages/payments-page";
import NotificationsPage from "@/pages/notifications-page";

import AdminDashboard from "@/pages/admin/index";
import AdminCoursesPage from "@/pages/admin/courses";
import AdminCourseEditPage from "@/pages/admin/course-edit";
import AdminUsersPage from "@/pages/admin/users";
import AdminAffiliatesPage from "@/pages/admin/affiliates";
import AdminPayoutsPage from "@/pages/admin/payouts";
import AdminCouponsPage from "@/pages/admin/coupons";
import AdminOrdersPage from "@/pages/admin/orders";
import AdminEnrollmentsPage from "@/pages/admin/enrollments";
import AdminPaymentGatewaysPage from "@/pages/admin/payment-gateways";
import AdminSettingsPage from "@/pages/admin/settings";
import CheckoutPage from "@/pages/checkout";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsOfServicePage from "@/pages/terms-of-service";
import CookiePolicyPage from "@/pages/cookie-policy";
import RefundPolicyPage from "@/pages/refund-policy";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <AppLayout><Home /></AppLayout>} />
      <Route path="/login" component={() => <Login />} />
      <Route path="/register" component={() => <Register />} />
      <Route path="/forgot-password" component={() => <ForgotPassword />} />
      <Route path="/courses" component={() => <AppLayout><CoursesPage /></AppLayout>} />
      <Route path="/courses/:id" component={() => <AppLayout><CourseDetailPage /></AppLayout>} />

      <Route path="/dashboard" component={() => <AppLayout><ProtectedRoute><DashboardPage /></ProtectedRoute></AppLayout>} />
      <Route path="/my-courses" component={() => <AppLayout><ProtectedRoute><MyCoursesPage /></ProtectedRoute></AppLayout>} />
      <Route path="/learn/:courseId" component={() => <ProtectedRoute><LearnPage /></ProtectedRoute>} />
      <Route path="/affiliate" component={() => <AppLayout><ProtectedRoute><AffiliatePage /></ProtectedRoute></AppLayout>} />
      <Route path="/payments" component={() => <AppLayout><ProtectedRoute><PaymentsPage /></ProtectedRoute></AppLayout>} />
      <Route path="/notifications" component={() => <AppLayout><ProtectedRoute><NotificationsPage /></ProtectedRoute></AppLayout>} />

      <Route path="/privacy-policy" component={() => <AppLayout><PrivacyPolicyPage /></AppLayout>} />
      <Route path="/terms-of-service" component={() => <AppLayout><TermsOfServicePage /></AppLayout>} />
      <Route path="/cookie-policy" component={() => <AppLayout><CookiePolicyPage /></AppLayout>} />
      <Route path="/refund-policy" component={() => <AppLayout><RefundPolicyPage /></AppLayout>} />

      <Route path="/admin" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/courses" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminCoursesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/courses/:id/edit" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminCourseEditPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/users" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminUsersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/affiliates" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminAffiliatesPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/payouts" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminPayoutsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/coupons" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminCouponsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/orders" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminOrdersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/enrollments" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminEnrollmentsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/payment-gateways" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminPaymentGatewaysPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/checkout/:id" component={() => <AppLayout><CheckoutPage /></AppLayout>} />
      <Route path="/admin/settings" component={() => <ProtectedRoute adminOnly><AdminLayout><AdminSettingsPage /></AdminLayout></ProtectedRoute>} />

      <Route component={() => <AppLayout><NotFound /></AppLayout>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
