import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API, useAuth } from "@/App";
import axios from "axios";
import { Trophy, Medal, Target, ChevronLeft, Crown } from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

export default function Leaderboard() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("rating");

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/leaderboard?sort_by=${sortBy}`);
      setPlayers(response.data);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-[#FFD700]" />;
      case 2:
        return <Medal className="w-6 h-6 text-[#C0C0C0]" />;
      case 3:
        return <Medal className="w-6 h-6 text-[#CD7F32]" />;
      default:
        return (
          <span className="text-white/30 font-mono text-lg w-6 text-center">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Navigation */}
      <nav className="glass-nav border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={user ? "/lobby" : "/"}>
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
            {!user && (
              <Link to="/login">
                <Button className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1
            className="font-heading text-4xl text-white mb-2"
            data-testid="leaderboard-title"
          >
            <span className="gradient-gold">Leaderboard</span>
          </h1>
          <p className="text-white/50">The best players on StakeChess</p>
        </div>

        <Tabs
          defaultValue="rating"
          value={sortBy}
          onValueChange={setSortBy}
          className="mb-8"
        >
          <TabsList className="bg-[#0A0A0A] border border-white/5 w-full grid grid-cols-3">
            <TabsTrigger
              value="rating"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              data-testid="tab-rating"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Rating
            </TabsTrigger>
            <TabsTrigger
              value="wins"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              data-testid="tab-wins"
            >
              <Target className="w-4 h-4 mr-2" />
              Wins
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
              data-testid="tab-games"
            >
              <Medal className="w-4 h-4 mr-2" />
              Games
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 spinner" />
          </div>
        ) : (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-sm overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-white/50 text-sm uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Rating</div>
              <div className="col-span-2 text-center">W/L/D</div>
              <div className="col-span-2 text-center">Games</div>
            </div>

            {/* Players */}
            <div className="divide-y divide-white/5">
              {players.map((player, index) => {
                const rank = index + 1;
                const isCurrentUser = player.user_id === user?.user_id;

                return (
                  <div
                    key={player.user_id}
                    className={`grid grid-cols-12 gap-4 p-4 items-center ${
                      isCurrentUser ? "bg-[#D4AF37]/10" : ""
                    } ${rank <= 3 ? "bg-gradient-to-r from-transparent to-transparent" : ""}`}
                    data-testid={`leaderboard-row-${rank}`}
                  >
                    <div className="col-span-1 flex justify-center">
                      {getRankIcon(rank)}
                    </div>
                    <div className="col-span-5">
                      <Link
                        to={user ? `/profile/${player.user_id}` : "#"}
                        className="flex items-center gap-3 group"
                      >
                        <div
                          className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                            rank === 1
                              ? "bg-[#FFD700]/20"
                              : rank === 2
                              ? "bg-[#C0C0C0]/20"
                              : rank === 3
                              ? "bg-[#CD7F32]/20"
                              : "bg-[#121212]"
                          }`}
                        >
                          <span
                            className={`font-bold ${
                              rank === 1
                                ? "text-[#FFD700]"
                                : rank === 2
                                ? "text-[#C0C0C0]"
                                : rank === 3
                                ? "text-[#CD7F32]"
                                : "text-white/50"
                            }`}
                          >
                            {player.username?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white group-hover:text-[#D4AF37] transition-colors">
                            {player.username}
                            {isCurrentUser && (
                              <span className="text-[#D4AF37] text-xs ml-2">
                                (You)
                              </span>
                            )}
                          </p>
                        </div>
                      </Link>
                    </div>
                    <div className="col-span-2 text-center">
                      <span
                        className={`font-mono font-bold ${
                          rank === 1
                            ? "text-[#FFD700]"
                            : rank === 2
                            ? "text-[#C0C0C0]"
                            : rank === 3
                            ? "text-[#CD7F32]"
                            : "text-white"
                        }`}
                      >
                        {player.rating}
                      </span>
                    </div>
                    <div className="col-span-2 text-center font-mono text-sm">
                      <span className="text-[#00FF94]">{player.wins}</span>
                      <span className="text-white/30">/</span>
                      <span className="text-[#FF3B30]">{player.losses}</span>
                      <span className="text-white/30">/</span>
                      <span className="text-white/50">{player.draws}</span>
                    </div>
                    <div className="col-span-2 text-center text-white/50 font-mono">
                      {player.games_played}
                    </div>
                  </div>
                );
              })}
            </div>

            {players.length === 0 && (
              <div className="p-12 text-center">
                <Trophy className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/50">No players yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
