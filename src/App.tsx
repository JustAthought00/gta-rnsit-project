import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import { Home as HomeIcon, Code, Calendar, Users, Globe, GraduationCap } from "lucide-react";
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

const MobileNav = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith('/auth') || pathname.startsWith('/oauth/consent')) return null;

  const isActive = (path: string) =>
    pathname === path ||
    pathname.startsWith(path + '/') ||
    (path === '/skills' && pathname.startsWith('/skill/')) ||
    (path === '/activities' && pathname.startsWith('/activity/')) ||
    (path === '/people' && pathname.startsWith('/user/'));

  const items = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/skills', label: 'Skills', icon: Code },
    { path: '/activities', label: 'Activities', icon: Calendar },
    { path: '/people', label: 'People', icon: Users },
    { path: '/communities', label: 'Communities', icon: Globe },
    { path: '/teachers', label: 'Faculty', icon: GraduationCap },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-stretch justify-around">
        {items.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] font-medium transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Icon className={`h-5 w-5 ${active ? 'electric-glow' : ''}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

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
              {/* Global Floating Home Button (desktop only — mobile has a bottom nav) */}
              <div className="hidden md:flex fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50">
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
              
              <div className="pb-16 md:pb-0">
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
              </div>
              <MobileNav />
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
