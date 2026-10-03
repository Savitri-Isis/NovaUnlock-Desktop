import { useEffect } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./renderer/Dashboard";
import DeviceConnect from "./renderer/DeviceConnect";
import DFU from "./renderer/DFU";
import Recovery from "./renderer/Recovery";
import Firmware from "./renderer/Firmware";
import DeviceInfo from "./renderer/DeviceInfo";
import Settings from "./renderer/Settings";
import Master from "./renderer/Master";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { DeviceDetector } from "./lib/usb/DeviceDetector";

export default function App() {
  const Router =
    typeof window !== "undefined" && window.location.protocol === "file:"
      ? HashRouter
      : BrowserRouter;

  useEffect(() => {
    void DeviceDetector.checkLibimobiledevice();
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <div className="flex h-screen bg-background text-foreground">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/master" element={<Master />} />
              <Route path="/connect" element={<DeviceConnect />} />
              <Route path="/dfu" element={<DFU />} />
              <Route path="/recovery" element={<Recovery />} />
              <Route path="/firmware" element={<Firmware />} />
              <Route path="/device-info" element={<DeviceInfo />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
