import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Vesting from "./pages/Vesting";
import Migrate from "./pages/Migrate";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="vesting" element={<Vesting />} />
        <Route path="migrate" element={<Migrate />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
