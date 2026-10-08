import { Route, Routes, Link } from "react-router";
import { Layout } from "./components/Layout";
import { Empty } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import LandRegistry from "./pages/LandRegistry";
import CreateLandRecord from "./pages/CreateLandRecord";
import RecordDetail from "./pages/RecordDetail";
import SupplyChain from "./pages/SupplyChain";
import ProductDetail from "./pages/ProductDetail";
import Verify from "./pages/Verify";
import Ledger from "./pages/Ledger";
import Audit from "./pages/Audit";
import Migration from "./pages/Migration";
import QuantumLab from "./pages/QuantumLab";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Layout>
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
    </Layout>
  );
}
