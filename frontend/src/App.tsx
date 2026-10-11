import { Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider';
import { RootLayout } from './layouts/RootLayout';
import { AboutPage } from './pages/AboutPage';
import { ExplorePage } from './pages/ExplorePage';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlannerPage } from './pages/PlannerPage';
import { ProgressPage } from './pages/ProgressPage';
import { QuestDetailPage } from './pages/QuestDetailPage';
import { QuestsPage } from './pages/QuestsPage';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="plan" element={<PlannerPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="quests/:questId" element={<QuestDetailPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
