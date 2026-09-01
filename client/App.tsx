import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { USER_ROLE } from '@apprentorbay/shared';
import { TermsGate } from './components/TermsGate';
import { AuthProvider } from './lib/auth';
import { TermsPage } from './routes/TermsPage';
import { AdminPage } from './routes/AdminPage';
import { ApplicationsPage } from './routes/ApplicationsPage';
import { HomePage } from './routes/HomePage';
import { HowItWorksPage } from './routes/HowItWorksPage';
import { MentorsPage } from './routes/MentorsPage';
import { JourneyPage } from './routes/JourneyPage';
import { LearnerProfilePage } from './routes/LearnerProfilePage';
import { LoginPage } from './routes/LoginPage';
import { MentorProfilePage } from './routes/MentorProfilePage';
import { MessagesInboxPage } from './routes/MessagesInboxPage';
import { MessagesPage } from './routes/MessagesPage';
import { RequireAdmin } from './routes/RequireAdmin';
import { RequireAuth } from './routes/RequireAuth';
import { SignupPage } from './routes/SignupPage';
import { VerificationPage } from './routes/VerificationPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TermsGate>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/learners/:id" element={<LearnerProfilePage />} />
          <Route path="/mentors" element={<MentorsPage />} />
          <Route path="/mentors/:id" element={<MentorProfilePage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
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
              <RequireAuth role={USER_ROLE.mentor}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TermsGate>
      </BrowserRouter>
    </AuthProvider>
  );
}
