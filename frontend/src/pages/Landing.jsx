import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import {
  Trophy,
  Coins,
  Shield,
  Users,
  Clock,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <Coins className="w-8 h-8 text-[#D4AF37]" />,
      title: "Crypto Staking",
      description: "Stake USDT, BTC, or ETH on your matches. Winner takes all minus a small 2% arbiter fee.",
    },
    {
      icon: <Shield className="w-8 h-8 text-[#00FF94]" />,
      title: "Secure Escrow",
      description: "Funds are locked in escrow until the game ends. Fair and transparent payouts.",
    },
    {
      icon: <Trophy className="w-8 h-8 text-[#FFD700]" />,
      title: "ELO Ratings",
      description: "Compete and climb the rankings. Your skill determines your rating.",
    },
    {
      icon: <Clock className="w-8 h-8 text-[#00C2FF]" />,
      title: "Real-time Play",
      description: "WebSocket-powered gameplay. Instant move sync with game timers.",
    },
    {
      icon: <Users className="w-8 h-8 text-[#FF3B30]" />,
      title: "Matchmaking",
      description: "Find opponents at your skill level. Blitz, Rapid, or Classical.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] noise-overlay">
      {/* Navigation */}
      <nav className="glass-nav border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
              <img src={LOGO_URL} alt="StakeChess" className="w-10 h-10" />
              <span className="font-heading text-xl text-white">
                Stake<span className="text-[#D4AF37]">Chess</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/leaderboard"
                className="text-white/70 hover:text-[#D4AF37] animate-underline transition-colors"
                data-testid="nav-leaderboard"
              >
                Leaderboard
              </Link>
              {user ? (
                <>
                  <Link
                    to="/lobby"
                    className="text-white/70 hover:text-[#D4AF37] animate-underline transition-colors"
                    data-testid="nav-lobby"
                  >
                    Play Now
                  </Link>
                  <Link
                    to="/wallet"
                    className="text-white/70 hover:text-[#D4AF37] animate-underline transition-colors"
                    data-testid="nav-wallet"
                  >
                    Wallet
                  </Link>
                  <Link
                    to="/profile"
                    className="text-white/70 hover:text-[#D4AF37] animate-underline transition-colors"
                    data-testid="nav-profile"
                  >
                    Profile
                  </Link>
                  {user.is_admin && (
                    <Link
                      to="/admin"
                      className="text-white/70 hover:text-[#D4AF37] animate-underline transition-colors"
                      data-testid="nav-admin"
                    >
                      Admin
                    </Link>
                  )}
                  <Button
                    onClick={logout}
                    variant="ghost"
                    className="text-white/70 hover:text-white"
                    data-testid="logout-btn"
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-white/70 hover:text-[#D4AF37] animate-underline transition-colors"
                    data-testid="nav-login"
                  >
                    Login
                  </Link>
                  <Button
                    onClick={() => navigate("/register")}
                    className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-widest px-6 py-2 rounded-sm btn-scale hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                    data-testid="nav-register-btn"
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-white/10 pt-4">
              <div className="flex flex-col gap-4">
                <Link
                  to="/leaderboard"
                  className="text-white/70 hover:text-[#D4AF37]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Leaderboard
                </Link>
                {user ? (
                  <>
                    <Link
                      to="/lobby"
                      className="text-white/70 hover:text-[#D4AF37]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Play Now
                    </Link>
                    <Link
                      to="/wallet"
                      className="text-white/70 hover:text-[#D4AF37]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Wallet
                    </Link>
                    <Link
                      to="/profile"
                      className="text-white/70 hover:text-[#D4AF37]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-white/70 hover:text-white"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="text-white/70 hover:text-[#D4AF37]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="text-[#D4AF37]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1
                className="font-heading font-black tracking-tight text-4xl sm:text-5xl lg:text-6xl uppercase text-white mb-6"
                data-testid="hero-title"
              >
                Stake.{" "}
                <span className="gradient-gold">Play.</span>{" "}
                <span className="text-[#00FF94]">Win.</span>
              </h1>
              <p className="text-lg text-white/60 mb-8 max-w-lg">
                The premier real-time chess platform where skill meets stakes.
                Challenge opponents, wager crypto, and prove you're the grandmaster.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={() => navigate(user ? "/lobby" : "/register")}
                  className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-widest px-8 py-6 rounded-sm btn-scale hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] text-lg"
                  data-testid="hero-cta-btn"
                >
                  {user ? "Enter Lobby" : "Start Playing"}
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  onClick={() => navigate("/leaderboard")}
                  variant="outline"
                  className="bg-transparent border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37] uppercase tracking-widest px-8 py-6 rounded-sm"
                  data-testid="hero-leaderboard-btn"
                >
                  View Leaderboard
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/20 to-transparent blur-3xl" />
              <img
                src={LOGO_URL}
                alt="StakeChess"
                className="w-full max-w-md mx-auto gold-glow-strong relative z-10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-heading font-bold tracking-tight text-3xl md:text-4xl text-white text-center mb-4">
            Why <span className="gradient-gold">StakeChess</span>?
          </h2>
          <p className="text-white/50 text-center mb-16 max-w-2xl mx-auto">
            Built for competitive players who want more than just bragging rights
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-[#0A0A0A] border border-white/5 p-8 rounded-sm card-hover group"
                data-testid={`feature-card-${index}`}
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-white/50">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-heading font-bold tracking-tight text-3xl md:text-4xl text-white mb-6">
            Ready to <span className="gradient-gold">dominate</span>?
          </h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto">
            Join thousands of players competing for crypto rewards. Create your account and get $100 USDT demo balance to start.
          </p>
          <Button
            onClick={() => navigate(user ? "/lobby" : "/register")}
            className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-widest px-10 py-6 rounded-sm btn-scale hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] text-lg"
            data-testid="cta-btn"
          >
            {user ? "Play Now" : "Create Free Account"}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={LOGO_URL} alt="StakeChess" className="w-6 h-6" />
              <span className="text-white/50 text-sm">© 2025 StakeChess</span>
            </div>
            <p className="text-white/30 text-sm font-mono">
              SIMULATED CRYPTO • FOR DEMO PURPOSES ONLY
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
