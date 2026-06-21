import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import io from "socket.io-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import {
  Plus,
  Users,
  Clock,
  Coins,
  Trophy,
  ChevronRight,
  Zap,
  Timer,
  RefreshCw,
  Calendar,
  Cpu,
} from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

const TIME_CONTROLS = [
  { value: "1+0", label: "1 min", type: "bullet" },
  { value: "3+0", label: "3 min", type: "blitz" },
  { value: "5+0", label: "5 min", type: "blitz" },
  { value: "10+0", label: "10 min", type: "rapid" },
  { value: "15+10", label: "15+10", type: "rapid" },
  { value: "30+0", label: "30 min", type: "classical" },
];

const CURRENCIES = [
  { value: "USDT", symbol: "$", color: "text-green-400" },
  { value: "BTC", symbol: "₿", color: "text-orange-400" },
  { value: "ETH", symbol: "Ξ", color: "text-purple-400" },
];

export default function Lobby() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joiningGame, setJoiningGame] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(null);
  const [showReturnBanner, setShowReturnBanner] = useState(false);

  // Create game form
  const [timeControl, setTimeControl] = useState("10+0");
  const [stakeAmount, setStakeAmount] = useState("0");
  const [stakeCurrency, setStakeCurrency] = useState("USDT");
  const [gameType, setGameType] = useState("rapid");
  const [creating, setCreating] = useState(false);

  const socketRef = useRef(null);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Check for active game on mount
  useEffect(() => {
    const savedGameId = localStorage.getItem("currentGameId");
    if (savedGameId) {
      setCurrentGameId(savedGameId);
      setShowReturnBanner(true);
    }
  }, []);

  // Socket.IO auto-refresh when games update
  useEffect(() => {
    socketRef.current = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      path: "/socket.io/",
    });

    socketRef.current.on("connect", () => {
      console.log("🔌 Socket connected to lobby");
    });

    // Listen for when opponent joins (game_started event)
    socketRef.current.on("game_started", (data) => {
      console.log("⚡ Game started event received:", data);
      // Auto-navigate to the game
      navigate(`/game/${data.game_id}`);
    });

    // Listen for player joined event
    socketRef.current.on("player_joined", (data) => {
      console.log("👤 Player joined event:", data);
      // Refresh games list
      fetchGames();
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected from lobby");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [navigate, BACKEND_URL]);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API}/games?status=waiting`);
      setGames(response.data);
    } catch (error) {
      console.error("Failed to fetch games:", error);
    } finally {
      setLoading(false);
    }
  };

  const createGame = async () => {
    setCreating(true);
    try {
      const response = await axios.post(
        `${API}/games`,
        {
          time_control: timeControl,
          stake_amount: parseFloat(stakeAmount) || 0,
          stake_currency: stakeCurrency,
          game_type: gameType,
          is_private: false,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Game created! Waiting for opponent...");
      setCreateDialogOpen(false);
      // Store game ID so user can return to it if they navigate away
      localStorage.setItem("currentGameId", response.data.game_id);
      setCurrentGameId(response.data.game_id);
      navigate(`/game/${response.data.game_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create game");
    } finally {
      setCreating(false);
    }
  };

  const joinGame = async (gameId) => {
    setJoiningGame(gameId);
    try {
      const response = await axios.post(
        `${API}/games/${gameId}/join`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Joined game! Starting...");
      // Store game ID so user can return to it if they navigate away
      localStorage.setItem("currentGameId", gameId);
      setCurrentGameId(gameId);
      navigate(`/game/${gameId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to join game");
    } finally {
      setJoiningGame(null);
    }
  };

  const getGameTypeIcon = (type) => {
    switch (type) {
      case "bullet":
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case "blitz":
        return <Timer className="w-4 h-4 text-orange-400" />;
      case "rapid":
        return <Clock className="w-4 h-4 text-blue-400" />;
      default:
        return <Clock className="w-4 h-4 text-purple-400" />;
    }
  };

  const getCurrencyColor = (currency) => {
    const curr = CURRENCIES.find((c) => c.value === currency);
    return curr?.color || "text-white";
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Return to current match banner */}
      {showReturnBanner && currentGameId && (
        <div className="bg-[#1a4d3e] border-b border-[#00FF94]/30 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#00FF94] rounded-full animate-pulse" />
              <p className="text-white">You have an active game in progress</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/game/${currentGameId}`)}
                className="bg-[#00FF94] text-black hover:bg-[#00ff94]/90 font-bold"
              >
                Return to Game
              </Button>
              <Button
                onClick={() => {
                  setShowReturnBanner(false);
                  localStorage.removeItem("currentGameId");
                }}
                variant="ghost"
                className="text-white/50 hover:text-white"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}
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

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 bg-[#0A0A0A] px-4 py-2 rounded-sm border border-white/5">
                <Coins className="w-4 h-4 text-[#D4AF37]" />
                <span className="font-mono text-sm text-white">
                  ${user?.wallet_balance?.USDT?.toFixed(2) || "0.00"}
                </span>
              </div>
              <Link
                to="/wallet"
                className="text-white/70 hover:text-[#D4AF37] text-sm"
              >
                Wallet
              </Link>
              <Link
                to="/profile"
                className="text-white/70 hover:text-[#D4AF37] text-sm"
              >
                Profile
              </Link>
              {user?.is_admin && (
                <Link
                  to="/admin"
                  className="text-white/70 hover:text-[#D4AF37] text-sm"
                >
                  Admin
                </Link>
              )}
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="font-heading text-3xl text-white mb-2"
              data-testid="lobby-title"
            >
              Game Lobby
            </h1>
            <p className="text-white/50">Find an opponent or create a new game</p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link to="/play-computer">
              <Button
                variant="outline"
                className="bg-transparent border-[#00C2FF]/30 text-[#00C2FF] hover:bg-[#00C2FF]/10 hover:border-[#00C2FF]"
                data-testid="play-computer-btn"
              >
                <Cpu className="w-4 h-4 mr-2" />
                Play vs Computer
              </Button>
            </Link>
            <Link to="/tournaments">
              <Button
                variant="outline"
                className="bg-transparent border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]"
                data-testid="tournaments-btn"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Tournaments
              </Button>
            </Link>
            <Button
              onClick={fetchGames}
              variant="outline"
              className="bg-transparent border-white/10 text-white hover:bg-white/5"
              data-testid="refresh-games-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider px-6 btn-scale"
                  data-testid="create-game-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Game
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading text-xl">
                    Create New Game
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  <div className="space-y-2">
                    <Label className="text-white/70">Time Control</Label>
                    <Select value={timeControl} onValueChange={setTimeControl}>
                      <SelectTrigger
                        className="bg-[#121212] border-white/10 text-white"
                        data-testid="time-control-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121212] border-white/10">
                        {TIME_CONTROLS.map((tc) => (
                          <SelectItem
                            key={tc.value}
                            value={tc.value}
                            className="text-white hover:bg-white/10"
                          >
                            <span className="flex items-center gap-2">
                              {getGameTypeIcon(tc.type)}
                              {tc.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/70">Stake Amount</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0"
                        className="bg-[#121212] border-white/10 text-white font-mono"
                        data-testid="stake-amount-input"
                      />
                      <Select
                        value={stakeCurrency}
                        onValueChange={setStakeCurrency}
                      >
                        <SelectTrigger
                          className="bg-[#121212] border-white/10 text-white w-28"
                          data-testid="stake-currency-select"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121212] border-white/10">
                          {CURRENCIES.map((c) => (
                            <SelectItem
                              key={c.value}
                              value={c.value}
                              className="text-white hover:bg-white/10"
                            >
                              <span className={c.color}>{c.value}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-white/30 text-xs">
                      Balance: {user?.wallet_balance?.[stakeCurrency]?.toFixed(4) || 0}{" "}
                      {stakeCurrency}
                    </p>
                  </div>

                  {parseFloat(stakeAmount) > 0 && (
                    <div className="bg-[#121212] p-4 rounded-sm border border-white/5">
                      <p className="text-white/50 text-sm mb-2">Pot breakdown:</p>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/50">Your stake:</span>
                          <span className="text-white">
                            {parseFloat(stakeAmount).toFixed(2)} {stakeCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Total pot:</span>
                          <span className="text-white">
                            {(parseFloat(stakeAmount) * 2).toFixed(2)} {stakeCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Winner receives:</span>
                          <span className="text-[#00FF94]">
                            {(parseFloat(stakeAmount) * 2 * 0.98).toFixed(2)}{" "}
                            {stakeCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Arbiter fee (2%):</span>
                          <span className="text-white/30">
                            {(parseFloat(stakeAmount) * 2 * 0.02).toFixed(2)}{" "}
                            {stakeCurrency}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={createGame}
                    disabled={creating}
                    className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider btn-scale"
                    data-testid="confirm-create-game-btn"
                  >
                    {creating ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 spinner" />
                        Creating...
                      </span>
                    ) : (
                      "Create Game"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* User Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
              Rating
            </p>
            <p className="text-2xl font-bold text-[#D4AF37] font-mono">
              {user?.rating || 1200}
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
              Games
            </p>
            <p className="text-2xl font-bold text-white font-mono">
              {user?.games_played || 0}
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
              Win Rate
            </p>
            <p className="text-2xl font-bold text-[#00FF94] font-mono">
              {user?.games_played > 0
                ? ((user?.wins / user?.games_played) * 100).toFixed(0)
                : 0}
              %
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
              Balance
            </p>
            <p className="text-2xl font-bold text-white font-mono">
              ${user?.wallet_balance?.USDT?.toFixed(2) || "0.00"}
            </p>
          </div>
        </div>

        {/* Available Games */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg text-white font-semibold">Available Games</h2>
          <span className="text-white/30 text-sm">{games.length} games</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 spinner" />
          </div>
        ) : games.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-12 text-center">
            <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-white text-lg mb-2">No games available</h3>
            <p className="text-white/50 mb-6">
              Be the first to create a game and wait for challengers!
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider"
            >
              Create Game
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {games.map((game) => (
              <div
                key={game.game_id}
                className="bg-[#0A0A0A] border border-white/5 rounded-sm p-5 card-hover flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                data-testid={`game-card-${game.game_id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#121212] rounded-sm flex items-center justify-center">
                    {getGameTypeIcon(game.game_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">
                        {game.white_player?.username || "Unknown"}
                      </span>
                      <span className="text-white/30 text-sm font-mono">
                        ({game.white_player?.rating || 1200})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-white/50 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {game.time_control}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="text-white/50 capitalize">
                        {game.game_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  {game.stake_amount > 0 ? (
                    <div className="bg-[#121212] px-4 py-2 rounded-sm border border-[#D4AF37]/20">
                      <p className="text-white/50 text-xs mb-1">Stake</p>
                      <p
                        className={`font-mono font-bold ${getCurrencyColor(
                          game.stake_currency
                        )}`}
                      >
                        {game.stake_amount} {game.stake_currency}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#121212] px-4 py-2 rounded-sm">
                      <p className="text-white/30 text-sm">Free Play</p>
                    </div>
                  )}

                  <Button
                    onClick={() => joinGame(game.game_id)}
                    disabled={
                      joiningGame === game.game_id ||
                      game.white_player?.user_id === user?.user_id
                    }
                    className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider px-6 btn-scale"
                    data-testid={`join-game-btn-${game.game_id}`}
                  >
                    {joiningGame === game.game_id ? (
                      <div className="w-4 h-4 spinner" />
                    ) : game.white_player?.user_id === user?.user_id ? (
                      "Your Game"
                    ) : (
                      <>
                        Join <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
