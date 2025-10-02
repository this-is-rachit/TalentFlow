import { Routes, Route, Navigate } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import DevBar from './components/DevBar'
import Navbar from './components/Navbar'          
import JobsPage from './features/jobs/JobsPage.jsx'
import JobDetail from './features/jobs/JobDetail.jsx'
import CandidatesPage from './features/candidates/CandidatesPage.jsx'
import CandidateProfile from './features/candidates/CandidateProfile.jsx'
import CandidatesKanban from './features/candidates/CandidatesKanban.jsx'
import AssessmentBuilder from './features/assessments/AssessmentBuilder.jsx'
import AssessmentFillPage from './features/assessments/AssessmentFillPage.jsx'
import './index.css'                           

export default function App() {
  return (
    <ToastProvider>
      <Navbar />
      <main className="page" style={{ paddingBlock: '24px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/jobs" replace />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/candidates/board" element={<CandidatesKanban />} />
          <Route path="/candidates/:id" element={<CandidateProfile />} />
          <Route path="/assessments/:jobId" element={<AssessmentBuilder />} />
          <Route path="/assessments/:jobId/fill" element={<AssessmentFillPage />} />
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
      <DevBar />
    </ToastProvider>
  )
}
