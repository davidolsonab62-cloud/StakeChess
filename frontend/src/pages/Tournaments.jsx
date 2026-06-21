import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import {
  Trophy,
  Users,
  Clock,
  Coins,
  ChevronLeft,
  Zap,
  Timer,
  Target,
  Calendar,
} from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

function CountdownTimer({ targetTime }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date(targetTime);
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Starting...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return <span className="font-mono">{timeLeft}</span>;
}

export default function Tournaments() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchTournaments();
    const interval = setInterval(fetchTournaments, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await axios.get(`${API}/tournaments`);
      setTournaments(response.data);
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (tournamentId) => {
    setJoining(true);
    try {
      await axios.post(
        `${API}/tournaments/${tournamentId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Successfully joined tournament!");
      fetchTournaments();
      setSelectedTournament(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to join tournament");
    } finally {
      setJoining(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "arena":
        return <Zap className="w-5 h-5 text-[#FFD700]" />;
      case "swiss":
        return <Target className="w-5 h-5 text-[#00C2FF]" />;
      default:
        return <Trophy className="w-5 h-5 text-[#D4AF37]" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "upcoming":
        return <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30">Upcoming</Badge>;
      case "active":
        return <Badge className="bg-[#00FF94]/20 text-[#00FF94] border-[#00FF94]/30 animate-pulse">Live</Badge>;
      case "completed":
        return <Badge className="bg-white/10 text-white/50 border-white/20">Completed</Badge>;
      default:
        return null;
    }
  };

  const isAlreadyJoined = (tournament) => {
    return tournament.players?.some(p => p.user_id === user?.user_id);
  };

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
                  Lobby
                </Button>
              </Link>
              <Link to="/" className="flex items-center gap-3">
                <img src={LOGO_URL} alt="StakeChess" className="w-10 h-10" />
                <span className="font-heading text-xl text-white">
                  Stake<span className="text-[#D4AF37]">Chess</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-[#0A0A0A] px-4 py-2 rounded-sm border border-white/5">
                <Coins className="w-4 h-4 text-[#D4AF37]" />
                <span className="font-mono text-sm text-white">
                  ${user?.wallet_balance?.USDT?.toFixed(2) || "0.00"}
                </span>
              </div>
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="font-heading text-4xl text-white mb-2" data-testid="tournaments-title">
            <span className="gradient-gold">Tournaments</span>
          </h1>
          <p className="text-white/50">Compete for prizes in automated 24/7 tournaments</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 spinner" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-12 text-center">
            <Trophy className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-white text-xl mb-2">No Tournaments Available</h3>
            <p className="text-white/50">Check back soon for upcoming tournaments!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {tournaments.map((tournament) => (
              <div
                key={tournament.tournament_id}
                className="bg-[#0A0A0A] border border-white/5 rounded-sm overflow-hidden card-hover"
                data-testid={`tournament-card-${tournament.tournament_id}`}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent p-4 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(tournament.tournament_type)}
                      <div>
                        <h3 className="text-white font-semibold text-lg">{tournament.name}</h3>
                        <p className="text-white/50 text-sm capitalize">{tournament.tournament_type} Tournament</p>
                      </div>
                    </div>
                    {getStatusBadge(tournament.status)}
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#121212] p-3 rounded-sm">
                      <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Time Control
                      </p>
                      <p className="text-white font-mono font-bold">{tournament.time_control}</p>
                    </div>
                    <div className="bg-[#121212] p-3 rounded-sm">
                      <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3" /> Entry Fee
                      </p>
                      <p className="text-[#D4AF37] font-mono font-bold">
                        {tournament.entry_fee} {tournament.entry_currency}
                      </p>
                    </div>
                    <div className="bg-[#121212] p-3 rounded-sm">
                      <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Players
                      </p>
                      <p className="text-white font-mono">
                        <span className="text-[#00FF94]">{tournament.current_players}</span>
                        <span className="text-white/30">/{tournament.max_players}</span>
                      </p>
                    </div>
                    <div className="bg-[#121212] p-3 rounded-sm">
                      <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Prize Pool
                      </p>
                      <p className="text-[#00FF94] font-mono font-bold">
                        {tournament.prize_pool.toFixed(2)} {tournament.entry_currency}
                      </p>
                    </div>
                  </div>

                  {/* Countdown / Status */}
                  {tournament.status === "upcoming" && (
                    <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-3 rounded-sm text-center">
                      <p className="text-white/50 text-xs mb-1">Starts in</p>
                      <p className="text-[#D4AF37] text-xl font-bold">
                        <CountdownTimer targetTime={tournament.start_time} />
                      </p>
                    </div>
                  )}

                  {tournament.status === "active" && (
                    <div className="bg-[#00FF94]/10 border border-[#00FF94]/30 p-3 rounded-sm text-center">
                      <p className="text-[#00FF94] font-bold animate-pulse">Tournament in Progress!</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setSelectedTournament(tournament)}
                      variant="outline"
                      className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5"
                      data-testid={`view-tournament-btn-${tournament.tournament_id}`}
                    >
                      View Details
                    </Button>
                    {tournament.status === "upcoming" && !isAlreadyJoined(tournament) && (
                      <Button
                        onClick={() => handleJoin(tournament.tournament_id)}
                        className="flex-1 bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider btn-scale"
                        data-testid={`join-tournament-btn-${tournament.tournament_id}`}
                      >
                        Join
                      </Button>
                    )}
                    {isAlreadyJoined(tournament) && (
                      <Button
                        disabled
                        className="flex-1 bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/30"
                      >
                        Joined
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tournament Details Dialog */}
      <Dialog open={!!selectedTournament} onOpenChange={() => setSelectedTournament(null)}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              {selectedTournament && getTypeIcon(selectedTournament.tournament_type)}
              {selectedTournament?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedTournament && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#121212] p-4 rounded-sm">
                  <p className="text-white/50 text-sm mb-1">Time Control</p>
                  <p className="text-white font-mono text-lg">{selectedTournament.time_control}</p>
                </div>
                <div className="bg-[#121212] p-4 rounded-sm">
                  <p className="text-white/50 text-sm mb-1">Duration</p>
                  <p className="text-white font-mono text-lg">{selectedTournament.duration_minutes} min</p>
                </div>
                <div className="bg-[#121212] p-4 rounded-sm">
                  <p className="text-white/50 text-sm mb-1">Entry Fee</p>
                  <p className="text-[#D4AF37] font-mono text-lg font-bold">
                    {selectedTournament.entry_fee} {selectedTournament.entry_currency}
                  </p>
                </div>
                <div className="bg-[#121212] p-4 rounded-sm">
                  <p className="text-white/50 text-sm mb-1">Prize Pool</p>
                  <p className="text-[#00FF94] font-mono text-lg font-bold">
                    {selectedTournament.prize_pool.toFixed(2)} {selectedTournament.entry_currency}
                  </p>
                </div>
              </div>

              <div className="bg-[#121212] p-4 rounded-sm">
                <p className="text-white/50 text-sm mb-2">Prize Distribution</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#FFD700]">🥇 1st Place</span>
                    <span className="font-mono">50% of pool</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#C0C0C0]">🥈 2nd Place</span>
                    <span className="font-mono">30% of pool</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#CD7F32]">🥉 3rd Place</span>
                    <span className="font-mono">20% of pool</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] p-4 rounded-sm">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-white/50 text-sm">Players</p>
                  <span className="text-white/30 text-sm">
                    {selectedTournament.current_players}/{selectedTournament.max_players}
                  </span>
                </div>
                <div className="w-full bg-[#0A0A0A] rounded-full h-2">
                  <div
                    className="bg-[#D4AF37] h-2 rounded-full transition-all"
                    style={{
                      width: `${(selectedTournament.current_players / selectedTournament.max_players) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {selectedTournament.status === "upcoming" && !isAlreadyJoined(selectedTournament) && (
                <Button
                  onClick={() => handleJoin(selectedTournament.tournament_id)}
                  disabled={joining}
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider btn-scale"
                >
                  {joining ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 spinner" />
                      Joining...
                    </span>
                  ) : (
                    `Join Tournament (${selectedTournament.entry_fee} ${selectedTournament.entry_currency})`
                  )}
                </Button>
              )}

              {isAlreadyJoined(selectedTournament) && (
                <div className="bg-[#00FF94]/10 border border-[#00FF94]/30 p-3 rounded-sm text-center">
                  <p className="text-[#00FF94]">You're registered for this tournament!</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
