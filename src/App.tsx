import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import { AccountProvider } from "./components/account/AccountProvider.tsx";
import { ThemeProvider } from "./components/theme/ThemeProvider.tsx";
import { SurfaceState } from "./components/agentready/SurfaceState.tsx";

const Projects = lazy(() => import('./pages/Projects.tsx'));
const Project = lazy(() => import('./pages/Project.tsx'));
const SavedScan = lazy(() => import('./pages/SavedScan.tsx'));
const AccountComplete = lazy(() => import('./pages/AccountComplete.tsx'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess.tsx'));
const Privacy = lazy(() => import('./pages/Privacy.tsx'));
const Security = lazy(() => import('./pages/Security.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AccountProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<main className="container py-24"><SurfaceState tone="loading" title="Opening ShipSeal" description="Preparing this surface." /></main>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<Project />} />
                <Route path="/projects/:projectId/scans/:scanId" element={<SavedScan />} />
                <Route path="/account/complete" element={<AccountComplete />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/security" element={<Security />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AccountProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
