import { lazy, Suspense } from "react";
import { Route, Routes, Link } from "react-router";
import { Layout } from "./components/Layout";
import { Empty, Loading } from "./components/ui";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const LandRegistry = lazy(() => import("./pages/LandRegistry"));
const CreateLandRecord = lazy(() => import("./pages/CreateLandRecord"));
const RecordDetail = lazy(() => import("./pages/RecordDetail"));
const SupplyChain = lazy(() => import("./pages/SupplyChain"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Verify = lazy(() => import("./pages/Verify"));
const Ledger = lazy(() => import("./pages/Ledger"));
const Audit = lazy(() => import("./pages/Audit"));
const Migration = lazy(() => import("./pages/Migration"));
const QuantumLab = lazy(() => import("./pages/QuantumLab"));
const Settings = lazy(() => import("./pages/Settings"));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/land" element={<LandRegistry />} />
        <Route path="/land/new" element={<CreateLandRecord />} />
        <Route path="/records/:id" element={<RecordDetail />} />
        <Route path="/supply-chain" element={<SupplyChain />} />
        <Route path="/supply-chain/:id" element={<ProductDetail />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/migration" element={<Migration />} />
        <Route path="/quantum" element={<QuantumLab />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Empty title="Page not found" description="The page you requested does not exist." action={<Link className="text-brand-400 hover:underline" to="/">Back to dashboard</Link>} />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}
