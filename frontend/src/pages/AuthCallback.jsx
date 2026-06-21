import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use ref to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Extract session_id from URL hash
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);

      if (!sessionIdMatch) {
        toast.error("Invalid authentication response");
        navigate("/login");
        return;
      }

      const sessionId = sessionIdMatch[1];

      try {
        // Exchange session_id for user data
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        const userData = response.data;
        
        // Store token (using session_token concept)
        localStorage.setItem("token", sessionId);
        
        // Update auth context
        updateUser(userData);

        toast.success("Welcome to StakeChess!");
        
        // Clean URL and redirect
        window.history.replaceState(null, "", "/lobby");
        navigate("/lobby", { replace: true, state: { user: userData } });
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error("Authentication failed. Please try again.");
        navigate("/login");
      }
    };

    processAuth();
  }, [navigate, updateUser]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 spinner mx-auto mb-4" />
        <p className="text-white/70">Completing sign in...</p>
      </div>
    </div>
  );
}
