import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useState, useCallback } from "react";
import SplashScreen from "./components/SplashScreen";
import Home from "./components/Home";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import SkillDetail from "./components/SkillDetail";
import ActivityDetail from "./components/ActivityDetail";
import ProjectDetail from "./components/ProjectDetail";
import AllSkills from "./components/AllSkills";
import AllActivities from "./components/AllActivities";
import People from "./components/People";
import UserProfile from "./components/UserProfile";
import EditProfile from "./components/EditProfile";
import Teachers from "./components/Teachers";
import TeacherDashboard from "./components/TeacherDashboard";
import Communities from "./components/Communities";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    if (sessionStorage.getItem("hasSeenGtaIntro") === "true") return false;
    return true;
  });
  // The app content mounts underneath the splash right as the fade-out begins,
  // so the fade reveals the real app instead of a blank page.
  const [appMounted, setAppMounted] = useState(() => sessionStorage.getItem("hasSeenGtaIntro") === "true");

  const handleEnterApp = useCallback(() => {
    sessionStorage.setItem("hasSeenGtaIntro", "true");
    setShowSplash(false);
  }, []);

  const handleFadeStart = useCallback(() => setAppMounted(true), []);

  return (
    <>
      {appMounted && (
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              {/* Global Floating Home Button */}
              <div className="flex fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50">
                <Link to="/">
                  <div 
                    className="bg-background/40 backdrop-blur-xl border border-primary/30 p-4 rounded-full shadow-[0_0_15px_rgba(0,255,255,0.15)] hover:shadow-[0_0_30px_rgba(0,255,255,0.4)] hover:bg-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-center justify-center group"
                    title="Return Home"
                  >
                    <img
                      src="/gta-logo.jpg"
                      alt="GTA"
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover group-hover:scale-110 transition-transform"
                    />
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
                <Route path="/teachers" element={<Teachers />} />
                <Route path="/manage" element={<TeacherDashboard />} />
                <Route path="/communities" element={<Communities />} />
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
      )}
      {showSplash && (
        <SplashScreen
          onEnterApp={handleEnterApp}
          onFadeStart={() => setAppMounted(true)}
        />
      )}
    </>
  );
};

export default App;