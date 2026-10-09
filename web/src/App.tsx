import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/Shell";
import { Empty, Loading } from "./components/ui";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";

const Overview = lazy(() => import("./pages/Overview"));
const Land = lazy(() => import("./pages/Land"));
const RecordDetail = lazy(() => import("./pages/RecordDetail"));
const SupplyChain = lazy(() => import("./pages/SupplyChain"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Verify = lazy(() => import("./pages/Verify"));
const Ledger = lazy(() => import("./pages/Ledger"));
const PostQuantum = lazy(() => import("./pages/PostQuantum"));
const QuantumLab = lazy(() => import("./pages/QuantumLab"));
const Audit = lazy(() => import("./pages/Audit"));
const Settings = lazy(() => import("./pages/Settings"));
const Certificates = lazy(() => import("./pages/Certificates"));
const LiveDemo = lazy(() => import("./pages/LiveDemo"));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<Auth mode="signin" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="/forgot" element={<Auth mode="forgot" />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="land" element={<Land />} />
          <Route path="records/:id" element={<RecordDetail />} />
          <Route path="supply-chain" element={<SupplyChain />} />
          <Route path="supply-chain/:id" element={<ProductDetail />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="demo" element={<LiveDemo />} />
          <Route path="verify" element={<Verify />} />
          <Route path="verify/:id" element={<Verify />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="post-quantum" element={<PostQuantum />} />
          <Route path="quantum" element={<QuantumLab />} />
          <Route path="audit" element={<Audit />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Empty title="Page not found" description="The page you requested does not exist." action={<Link className="underline" to="/app">Back to overview</Link>} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
