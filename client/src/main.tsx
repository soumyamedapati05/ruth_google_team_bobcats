import React, { type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles.css";
import { AuthProvider, useAuth } from "./lib/auth";
import { landingFor } from "./components/LoginForm";
import { StudentLogin, PartnerLogin, Landing } from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import Add from "./pages/Add";
import PartnerListings from "./pages/PartnerListings";
import PartnerProfile from "./pages/PartnerProfile";
import { LightLayout, RoomLayout } from "./components/Chrome";

function Guard({ role, children }: { role: "student" | "partner"; children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="page muted">Loading…</div>;
  if (!me) return <Navigate to={role === "student" ? "/student/login" : "/partner/login"} replace />;
  if (me.role !== role) return <Navigate to={landingFor(me)} replace />;
  if (role === "student" && !me.onboarded && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function Home() {
  const { me, loading } = useAuth();
  if (loading) return <div className="page muted">Loading…</div>;
  return me ? <Navigate to={landingFor(me)} replace /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<LightLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/partner/login" element={<PartnerLogin />} />
            <Route path="/partner/listings" element={<Guard role="partner"><PartnerListings /></Guard>} />
            <Route path="/partner/add" element={<Guard role="partner"><Add /></Guard>} />
            <Route path="/partner/profile" element={<Guard role="partner"><PartnerProfile /></Guard>} />
          </Route>
          <Route element={<RoomLayout />}>
            <Route path="/onboarding" element={<Guard role="student"><Onboarding /></Guard>} />
            <Route path="/matches" element={<Guard role="student"><Matches /></Guard>} />
            <Route path="/profile" element={<Guard role="student"><Profile /></Guard>} />
          </Route>
          <Route path="/login" element={<Navigate to="/student/login" replace />} />
          <Route path="/add" element={<Navigate to="/partner/add" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
