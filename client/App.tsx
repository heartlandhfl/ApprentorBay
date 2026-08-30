import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ApplicationsPage } from './routes/ApplicationsPage';
import { HomePage } from './routes/HomePage';
import { JourneyPage } from './routes/JourneyPage';
import { LearnerProfilePage } from './routes/LearnerProfilePage';
import { LoginPage } from './routes/LoginPage';
import { MentorProfilePage } from './routes/MentorProfilePage';
import { MessagesInboxPage } from './routes/MessagesInboxPage';
import { MessagesPage } from './routes/MessagesPage';
import { RequireAdmin } from './routes/RequireAdmin';
import { RequireAuth } from './routes/RequireAuth';
import { SignupPage } from './routes/SignupPage';
import { SystemPage } from './routes/SystemPage';
import { VerificationPage } from './routes/VerificationPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/learners/:id" element={<LearnerProfilePage />} />
          <Route path="/mentors/:id" element={<MentorProfilePage />} />
          <Route
            path="/admin/verification"
            element={
              <RequireAdmin>
                <VerificationPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/dashboard/applications"
            element={
              <RequireAuth role="mentor">
                <ApplicationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/messages"
            element={
              <RequireAuth>
                <MessagesInboxPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/messages/:relationshipId"
            element={
              <RequireAuth>
                <MessagesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/journey/:relationshipId"
            element={
              <RequireAuth>
                <JourneyPage />
              </RequireAuth>
            }
          />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
