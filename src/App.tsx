import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Privacy from "./pages/Privacy.tsx";
import Security from "./pages/Security.tsx";
import { AccountProvider } from "./components/account/AccountProvider.tsx";

const Projects = lazy(() => import('./pages/Projects.tsx'));
const Project = lazy(() => import('./pages/Project.tsx'));
const SavedScan = lazy(() => import('./pages/SavedScan.tsx'));
const AccountComplete = lazy(() => import('./pages/AccountComplete.tsx'));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AccountProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<div className="container py-24 text-sm text-muted-foreground">Loading ShipSeal…</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId" element={<Project />} />
              <Route path="/projects/:projectId/scans/:scanId" element={<SavedScan />} />
              <Route path="/account/complete" element={<AccountComplete />} />
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
);

export default App;
