import { AuthProvider } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import DashboardLayout from './pages/DashboardLayout';
import VoiceCallPage from './pages/VoiceCallPage';
import TestConsolePage from './pages/TestConsolePage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DashboardLayout />} />
            <Route path="/call" element={<VoiceCallPage />} />
            <Route path="/test" element={<TestConsolePage />} />
          </Routes>
        </BrowserRouter>
      </CallProvider>
    </AuthProvider>
  );
}

export default App;
