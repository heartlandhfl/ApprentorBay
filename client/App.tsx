import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './routes/HomePage';
import { SystemPage } from './routes/SystemPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
