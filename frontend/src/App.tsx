import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { ConnectivityBanner } from '@/components/ConnectivityBanner'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomePage } from '@/pages/HomePage'
import { ChatPage } from '@/pages/ChatPage'
import { CropRecommendationPage } from '@/pages/CropRecommendationPage'
import { FertilizerRecommendationPage } from '@/pages/FertilizerRecommendationPage'
import { WeatherPage } from '@/pages/WeatherPage'
import { DiseaseDetectionPage } from '@/pages/DiseaseDetectionPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hideNavFooter = ['/login', '/register'].includes(location.pathname)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {!hideNavFooter && <Navbar />}
      {!hideNavFooter && <ConnectivityBanner />}
      <main className="flex-1">{children}</main>
      {!hideNavFooter && <Footer />}
    </div>
  )
}

export function App() {
  return (
    <LanguageProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/crop-recommendation" element={<CropRecommendationPage />} />
            <Route path="/fertilizer-recommendation" element={<FertilizerRecommendationPage />} />
            <Route path="/disease-detection" element={<DiseaseDetectionPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  )
}
