import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import Home from "./components/Home";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import SkillDetail from "./components/SkillDetail";
import ActivityDetail from "./components/ActivityDetail";
import AllSkills from "./components/AllSkills";
import AllActivities from "./components/AllActivities";
import People from "./components/People";
import UserProfile from "./components/UserProfile";
import EditProfile from "./components/EditProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    setShowSplash(true);
  }, []);

  const handleEnterApp = () => {
    localStorage.setItem('hasSeenApp', 'true');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onEnterApp={handleEnterApp} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Global Floating Home Button */}
          <div className="fixed bottom-6 right-6 z-50">
            <Link to="/">
              <div 
                className="bg-background/80 backdrop-blur-md border-2 border-primary/50 p-1 rounded-full shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.6)] hover:scale-110 transition-all cursor-pointer flex items-center justify-center group"
                title="Go to Home"
              >
                <img src="/gta-logo.jpg" alt="GTA Home" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover opacity-90 group-hover:opacity-100" />
              </div>
            </Link>
          </div>
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/oauth/consent" element={<OAuthConsent />} />
            <Route path="/skills" element={<AllSkills />} />
            <Route path="/activities" element={<AllActivities />} />
            <Route path="/people" element={<People />} />
            <Route path="/skill/:skillId" element={<SkillDetail />} />
            <Route path="/activity/:activityId" element={<ActivityDetail />} />
            <Route path="/project/:projectId" element={<ProjectDetail />} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
