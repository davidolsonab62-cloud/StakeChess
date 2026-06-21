import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import axios from "axios";
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
} from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser, token, logout } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !userId || userId === currentUser?.user_id;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const targetId = userId || currentUser?.user_id;
        const [userRes, gamesRes] = await Promise.all([
          axios.get(`${API}/users/${targetId}`),
          axios.get(`${API}/users/${targetId}/games`),
        ]);
        setProfileUser(userRes.data);
        setGames(gamesRes.data);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchProfile();
    }
  }, [userId, currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-16 h-16 spinner" />
      </div>
    );
  }

  const displayUser = profileUser || currentUser;
  const winRate =
    displayUser?.games_played > 0
      ? ((displayUser?.wins / displayUser?.games_played) * 100).toFixed(1)
      : 0;

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Navigation */}
      <nav className="glass-nav border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/lobby">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <Link to="/" className="flex items-center gap-3">
                <img src={LOGO_URL} alt="StakeChess" className="w-10 h-10" />
                <span className="font-heading text-xl text-white">
                  Stake<span className="text-[#D4AF37]">Chess</span>
                </span>
              </Link>
            </div>
            {isOwnProfile && (
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white"
              >
                Logout
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-[#D4AF37]/20 rounded-sm flex items-center justify-center">
              <span className="text-[#D4AF37] text-4xl font-heading font-bold">
                {displayUser?.username?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="text-center md:text-left">
              <h1
                className="font-heading text-3xl text-white mb-2"
                data-testid="profile-username"
              >
                {displayUser?.username}
              </h1>
              <p className="text-white/50">{displayUser?.email}</p>
              {displayUser?.is_admin && (
                <span className="inline-block mt-2 px-3 py-1 bg-[#D4AF37]/20 text-[#D4AF37] text-xs uppercase tracking-wider rounded-sm">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm text-center">
            <Trophy className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
            <p className="text-3xl font-bold text-white font-mono">
              {displayUser?.rating || 1200}
            </p>
            <p className="text-white/50 text-sm uppercase tracking-wider">
              Rating
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm text-center">
            <Clock className="w-8 h-8 text-[#00C2FF] mx-auto mb-2" />
            <p className="text-3xl font-bold text-white font-mono">
              {displayUser?.games_played || 0}
            </p>
            <p className="text-white/50 text-sm uppercase tracking-wider">
              Games
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm text-center">
            <TrendingUp className="w-8 h-8 text-[#00FF94] mx-auto mb-2" />
            <p className="text-3xl font-bold text-[#00FF94] font-mono">
              {displayUser?.wins || 0}
            </p>
            <p className="text-white/50 text-sm uppercase tracking-wider">
              Wins
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-sm text-center">
            <Target className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <p className="text-3xl font-bold text-[#FFD700] font-mono">
              {winRate}%
            </p>
            <p className="text-white/50 text-sm uppercase tracking-wider">
              Win Rate
            </p>
          </div>
        </div>

        {/* Wallet Balance (own profile only) */}
        {isOwnProfile && displayUser?.wallet_balance && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Wallet Balance
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#121212] p-4 rounded-sm">
                <p className="text-white/50 text-sm mb-1">USDT</p>
                <p className="text-green-400 font-mono text-xl font-bold">
                  ${displayUser.wallet_balance.USDT?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div className="bg-[#121212] p-4 rounded-sm">
                <p className="text-white/50 text-sm mb-1">BTC</p>
                <p className="text-orange-400 font-mono text-xl font-bold">
                  {displayUser.wallet_balance.BTC?.toFixed(6) || "0.000000"}
                </p>
              </div>
              <div className="bg-[#121212] p-4 rounded-sm">
                <p className="text-white/50 text-sm mb-1">ETH</p>
                <p className="text-purple-400 font-mono text-xl font-bold">
                  {displayUser.wallet_balance.ETH?.toFixed(6) || "0.000000"}
                </p>
              </div>
            </div>
            <Link to="/wallet" className="mt-4 inline-block">
              <Button
                variant="outline"
                className="bg-transparent border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Manage Wallet
              </Button>
            </Link>
          </div>
        )}

        {/* Recent Games */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-sm">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white">Recent Games</h2>
          </div>
          {games.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No games played yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {games.map((game) => {
                const isWhite =
                  game.white_player?.user_id === displayUser?.user_id;
                const opponent = isWhite
                  ? game.black_player
                  : game.white_player;
                const didWin = game.winner_id === displayUser?.user_id;
                const isDraw = game.result === "draw";

                return (
                  <div
                    key={game.game_id}
                    className="p-4 flex items-center justify-between"
                    data-testid={`game-history-${game.game_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                          didWin
                            ? "bg-[#00FF94]/20"
                            : isDraw
                            ? "bg-white/10"
                            : "bg-[#FF3B30]/20"
                        }`}
                      >
                        {didWin ? (
                          <TrendingUp className="w-5 h-5 text-[#00FF94]" />
                        ) : isDraw ? (
                          <span className="text-white/50">=</span>
                        ) : (
                          <TrendingDown className="w-5 h-5 text-[#FF3B30]" />
                        )}
                      </div>
                      <div>
                        <p className="text-white">
                          vs {opponent?.username || "Unknown"}
                        </p>
                        <p className="text-white/30 text-sm">
                          {game.time_control} • {game.game_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          didWin
                            ? "text-[#00FF94]"
                            : isDraw
                            ? "text-white/50"
                            : "text-[#FF3B30]"
                        }`}
                      >
                        {didWin ? "Win" : isDraw ? "Draw" : "Loss"}
                      </p>
                      {game.stake_amount > 0 && (
                        <p className="text-white/30 text-sm font-mono">
                          {game.stake_amount} {game.stake_currency}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
