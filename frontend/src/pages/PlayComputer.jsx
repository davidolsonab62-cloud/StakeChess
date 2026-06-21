import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import {
  ChevronLeft,
  Trophy,
  Cpu,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Settings,
  Zap,
  Clock,
  Target,
  Play,
} from "lucide-react";
import {
  moveFeedback,
  getSettings,
  saveSettings,
} from "@/utils/soundEffects";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

// Difficulty settings with ELO and Stockfish depth
const DIFFICULTY_LEVELS = [
  { id: "beginner", name: "Beginner", elo: 800, depth: 2, color: "#00FF94", delay: [1000, 1500] },
  { id: "intermediate", name: "Intermediate", elo: 1200, depth: 5, color: "#00C2FF", delay: [800, 1200] },
  { id: "advanced", name: "Advanced", elo: 1600, depth: 10, color: "#D4AF37", delay: [600, 1000] },
  { id: "master", name: "Master", elo: 2000, depth: 15, color: "#FF3B30", delay: [500, 800] },
];

export default function PlayComputer() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState(null);
  const [playerColor, setPlayerColor] = useState("white");
  const [chessInstance, setChessInstance] = useState(() => new Chess());
  const [position, setPosition] = useState("start");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [computerThinking, setComputerThinking] = useState(false);
  
  // Click-to-move state
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);

  // Settings
  const [settings, setSettings] = useState(() => getSettings());
  const [showSettings, setShowSettings] = useState(false);

  const updateSettings = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Get best move from Stockfish via backend
  const getComputerMove = useCallback(async () => {
    if (!difficulty || gameOver) return null;
    
    setComputerThinking(true);
    
    try {
      const response = await axios.post(
        `${API}/computer/move`,
        {
          fen: chessInstance.fen(),
          depth: difficulty.depth,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      
      // Random delay to simulate human thinking
      const [minDelay, maxDelay] = difficulty.delay;
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return response.data.move;
    } catch (error) {
      console.error("Failed to get computer move:", error);
      // Fallback: make a random legal move
      const moves = chessInstance.moves();
      return moves[Math.floor(Math.random() * moves.length)];
    } finally {
      setComputerThinking(false);
    }
  }, [difficulty, gameOver, chessInstance, token]);

  // Make computer move
  const makeComputerMove = useCallback(async () => {
    if (gameOver) return;
    
    const moveStr = await getComputerMove();
    if (!moveStr) return;
    
    try {
      const move = chessInstance.move(moveStr);
      if (move) {
        setPosition(chessInstance.fen());
        setMoveHistory(prev => [...prev, move.san]);
        setLastMove({ from: move.from, to: move.to });
        
        // Play sound
        if (chessInstance.isCheckmate()) {
          moveFeedback('gameEnd', settings);
          setGameOver(true);
          setResult({ 
            winner: chessInstance.turn() === 'w' ? 'black' : 'white', 
            reason: "checkmate" 
          });
        } else if (chessInstance.isDraw()) {
          moveFeedback('gameEnd', settings);
          setGameOver(true);
          setResult({ winner: "draw", reason: "draw" });
        } else if (chessInstance.isCheck()) {
          moveFeedback('check', settings);
        } else if (move.captured) {
          moveFeedback('capture', settings);
        } else {
          moveFeedback('move', settings);
        }
      }
    } catch (error) {
      console.error("Computer move error:", error);
    }
  }, [getComputerMove, chessInstance, gameOver, settings]);

  // Check if it's computer's turn and make move
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    
    const isComputerTurn = 
      (playerColor === "white" && chessInstance.turn() === "b") ||
      (playerColor === "black" && chessInstance.turn() === "w");
    
    if (isComputerTurn && !computerThinking) {
      makeComputerMove();
    }
  }, [gameStarted, gameOver, playerColor, chessInstance.turn(), computerThinking, makeComputerMove]);

  // Start game
  const startGame = (selectedDifficulty, color) => {
    setDifficulty(selectedDifficulty);
    setPlayerColor(color);
    setChessInstance(new Chess());
    setPosition("start");
    setGameOver(false);
    setResult(null);
    setLastMove(null);
    setMoveHistory([]);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setGameStarted(true);
    
    moveFeedback('gameStart', settings);
    toast.success(`Game started vs ${selectedDifficulty.name} (${selectedDifficulty.elo} ELO)`, { duration: 3000 });
    
    // If player is black, computer moves first
    if (color === "black") {
      setTimeout(() => makeComputerMove(), 500);
    }
  };

  // Reset game
  const resetGame = () => {
    setGameStarted(false);
    setDifficulty(null);
    setChessInstance(new Chess());
    setPosition("start");
    setGameOver(false);
    setResult(null);
    setLastMove(null);
    setMoveHistory([]);
  };

  // Execute player move
  const executeMove = (sourceSquare, targetSquare, promotion = "q") => {
    setSelectedSquare(null);
    setPossibleMoves([]);

    if (gameOver || computerThinking) return false;
    
    const isPlayerTurn = 
      (playerColor === "white" && chessInstance.turn() === "w") ||
      (playerColor === "black" && chessInstance.turn() === "b");
    
    if (!isPlayerTurn) {
      toast.error("Wait for computer to move!");
      return false;
    }

    try {
      const move = chessInstance.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion,
      });

      if (move === null) return false;

      setPosition(chessInstance.fen());
      setMoveHistory(prev => [...prev, move.san]);
      setLastMove({ from: sourceSquare, to: targetSquare });

      // Play sound and check game end
      if (chessInstance.isCheckmate()) {
        moveFeedback('gameEnd', settings);
        setGameOver(true);
        setResult({ winner: playerColor, reason: "checkmate" });
      } else if (chessInstance.isDraw()) {
        moveFeedback('gameEnd', settings);
        setGameOver(true);
        setResult({ winner: "draw", reason: "draw" });
      } else if (chessInstance.isCheck()) {
        moveFeedback('check', settings);
      } else if (move.captured) {
        moveFeedback('capture', settings);
      } else {
        moveFeedback('move', settings);
      }

      return true;
    } catch (error) {
      console.error("Move error:", error);
      return false;
    }
  };

  const onPieceDrop = ({ piece, sourceSquare, targetSquare }) => {
    return executeMove(sourceSquare, targetSquare, "q");
  };

  const onSquareClick = ({ piece: clickedPiece, square }) => {
    if (gameOver || computerThinking) return;
    
    const isPlayerTurn = 
      (playerColor === "white" && chessInstance.turn() === "w") ||
      (playerColor === "black" && chessInstance.turn() === "b");
    
    if (!isPlayerTurn) return;

    if (selectedSquare) {
      if (possibleMoves.includes(square)) {
        executeMove(selectedSquare, square, "q");
      } else {
        const piece = chessInstance.get(square);
        const playerPieceColor = playerColor === "white" ? "w" : "b";
        if (piece && piece.color === playerPieceColor) {
          setSelectedSquare(square);
          const moves = chessInstance.moves({ square, verbose: true });
          setPossibleMoves(moves.map(m => m.to));
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      const piece = chessInstance.get(square);
      const playerPieceColor = playerColor === "white" ? "w" : "b";
      if (piece && piece.color === playerPieceColor) {
        setSelectedSquare(square);
        const moves = chessInstance.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to));
      }
    }
  };

  // Custom square styles
  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { backgroundColor: "rgba(212, 175, 55, 0.4)" };
    customSquareStyles[lastMove.to] = { backgroundColor: "rgba(212, 175, 55, 0.6)" };
  }
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: "rgba(0, 194, 255, 0.5)",
      boxShadow: "inset 0 0 0 3px rgba(0, 194, 255, 0.8)",
    };
  }
  possibleMoves.forEach(square => {
    const piece = chessInstance.get(square);
    if (piece) {
      customSquareStyles[square] = {
        ...customSquareStyles[square],
        backgroundColor: "rgba(255, 59, 48, 0.4)",
        boxShadow: "inset 0 0 0 3px rgba(255, 59, 48, 0.6)",
      };
    } else {
      customSquareStyles[square] = {
        ...customSquareStyles[square],
        background: "radial-gradient(circle at center, rgba(0, 255, 148, 0.6) 25%, transparent 25%)",
      };
    }
  });

  const boardOrientation = playerColor;

  // Difficulty selection screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-[#050505]">
        {/* Navigation */}
        <nav className="glass-nav border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => navigate("/lobby")}
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Lobby
                </Button>
                <Link to="/" className="flex items-center gap-2">
                  <img src={LOGO_URL} alt="StakeChess" className="w-8 h-8" />
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Cpu className="w-12 h-12 text-[#D4AF37]" />
            </div>
            <h1 className="font-heading text-3xl text-white mb-2">Play vs Computer</h1>
            <p className="text-white/50">Practice your skills against our AI opponent</p>
          </div>

          {/* Difficulty Selection */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-6 mb-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#D4AF37]" />
              Select Difficulty
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {DIFFICULTY_LEVELS.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setDifficulty(level)}
                  className={`p-4 rounded-sm border transition-all ${
                    difficulty?.id === level.id
                      ? `border-[${level.color}] bg-[${level.color}]/10`
                      : "border-white/10 hover:border-white/20"
                  }`}
                  style={{
                    borderColor: difficulty?.id === level.id ? level.color : undefined,
                    backgroundColor: difficulty?.id === level.id ? `${level.color}10` : undefined,
                  }}
                  data-testid={`difficulty-${level.id}`}
                >
                  <div className="text-left">
                    <p className="text-white font-semibold">{level.name}</p>
                    <p className="text-sm font-mono" style={{ color: level.color }}>
                      {level.elo} ELO
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          {difficulty && (
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-6 mb-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#D4AF37]" />
                Choose Your Color
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => startGame(difficulty, "white")}
                  className="p-6 rounded-sm border border-white/10 hover:border-[#D4AF37]/50 transition-all group"
                  data-testid="play-as-white"
                >
                  <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-sm flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    <span className="text-3xl">♔</span>
                  </div>
                  <p className="text-white font-semibold">Play as White</p>
                  <p className="text-white/50 text-sm">You move first</p>
                </button>
                <button
                  onClick={() => startGame(difficulty, "black")}
                  className="p-6 rounded-sm border border-white/10 hover:border-[#D4AF37]/50 transition-all group"
                  data-testid="play-as-black"
                >
                  <div className="w-16 h-16 mx-auto mb-3 bg-[#1A1A1A] rounded-sm flex items-center justify-center border border-white/20 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <span className="text-3xl text-white">♚</span>
                  </div>
                  <p className="text-white font-semibold">Play as Black</p>
                  <p className="text-white/50 text-sm">Computer moves first</p>
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-white/30 text-sm">
            No stakes • Results don't affect your balance • Practice mode only
          </p>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Navigation */}
      <nav className="glass-nav border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={resetGame}
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                New Game
              </Button>
              <Link to="/" className="flex items-center gap-2">
                <img src={LOGO_URL} alt="StakeChess" className="w-8 h-8" />
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-sm bg-[#0A0A0A] border border-white/10">
                <Cpu className="w-4 h-4" style={{ color: difficulty?.color }} />
                <span className="text-sm font-mono" style={{ color: difficulty?.color }}>
                  {difficulty?.name} ({difficulty?.elo})
                </span>
              </div>

              {/* Settings */}
              <div className="relative">
                <Button
                  onClick={() => setShowSettings(!showSettings)}
                  variant="ghost"
                  size="sm"
                  className={`text-white/70 hover:text-white ${showSettings ? 'bg-white/10' : ''}`}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-sm shadow-lg z-50">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {settings.soundEnabled ? (
                            <Volume2 className="w-4 h-4 text-[#00FF94]" />
                          ) : (
                            <VolumeX className="w-4 h-4 text-white/50" />
                          )}
                          <Label className="text-white/70 text-sm">Sound</Label>
                        </div>
                        <Switch
                          checked={settings.soundEnabled}
                          onCheckedChange={(v) => updateSettings('soundEnabled', v)}
                          className="data-[state=checked]:bg-[#00FF94]"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className={`w-4 h-4 ${settings.vibrationEnabled ? 'text-[#00FF94]' : 'text-white/50'}`} />
                          <Label className="text-white/70 text-sm">Vibration</Label>
                        </div>
                        <Switch
                          checked={settings.vibrationEnabled}
                          onCheckedChange={(v) => updateSettings('vibrationEnabled', v)}
                          className="data-[state=checked]:bg-[#00FF94]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          {/* Chess Board */}
          <div>
            {/* Computer info */}
            <div className={`flex items-center justify-between mb-3 bg-[#0A0A0A] border p-3 rounded-sm ${
              computerThinking ? "border-[#D4AF37]/50" : "border-white/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                  computerThinking ? "bg-[#D4AF37]/20" : "bg-[#121212]"
                }`}>
                  <Cpu className={`w-5 h-5 ${computerThinking ? "text-[#D4AF37] animate-pulse" : "text-white/50"}`} />
                </div>
                <div>
                  <p className="text-white font-semibold">{difficulty?.name} Bot</p>
                  <p className="text-sm font-mono" style={{ color: difficulty?.color }}>
                    {difficulty?.elo} ELO
                  </p>
                </div>
              </div>
              {computerThinking && (
                <span className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-1 rounded-sm animate-pulse">
                  Thinking...
                </span>
              )}
            </div>

            {/* Board */}
            <div className="relative bg-[#0A0A0A] p-4 rounded-sm border border-white/5">
              <Chessboard
                options={{
                  id: "ComputerChessboard",
                  position: position,
                  onPieceDrop: onPieceDrop,
                  onSquareClick: onSquareClick,
                  boardOrientation: boardOrientation,
                  darkSquareStyle: { backgroundColor: "#2D4A2D" },
                  lightSquareStyle: { backgroundColor: "#E8DCC4" },
                  squareStyles: customSquareStyles,
                  boardStyle: { borderRadius: "4px", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
                  animationDurationInMs: 150,
                  allowDragging: !gameOver && !computerThinking,
                }}
              />
            </div>

            {/* Player info */}
            <div className="flex items-center justify-between mt-3 bg-[#0A0A0A] border border-white/5 p-3 rounded-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-[#D4AF37]/20 flex items-center justify-center">
                  <span className="text-[#D4AF37] font-bold">
                    {user?.username?.charAt(0)?.toUpperCase() || "Y"}
                  </span>
                </div>
                <div>
                  <p className="text-white font-semibold">{user?.username || "You"}</p>
                  <p className="text-[#D4AF37] text-sm font-mono">{user?.rating || 1200} ELO</p>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Game Over Modal */}
            {gameOver && (
              <div className="bg-[#0A0A0A] border border-[#D4AF37]/30 rounded-sm p-6 text-center">
                <Trophy className={`w-12 h-12 mx-auto mb-3 ${
                  result?.winner === playerColor ? "text-[#D4AF37]" : "text-white/30"
                }`} />
                <h2 className="text-xl font-bold text-white mb-2">
                  {result?.winner === playerColor 
                    ? "You Won!" 
                    : result?.winner === "draw" 
                    ? "Draw!" 
                    : "Computer Wins"}
                </h2>
                <p className="text-white/50 mb-4 capitalize">{result?.reason}</p>
                <div className="space-y-2">
                  <Button
                    onClick={() => startGame(difficulty, playerColor)}
                    className="w-full bg-[#D4AF37] text-black hover:bg-[#F4C430]"
                    data-testid="play-again-btn"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                  <Button
                    onClick={resetGame}
                    variant="outline"
                    className="w-full border-white/20 text-white hover:bg-white/10"
                  >
                    Change Difficulty
                  </Button>
                </div>
              </div>
            )}

            {/* Move History */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm">
              <div className="p-3 border-b border-white/5">
                <h3 className="text-white font-semibold text-sm">Move History</h3>
              </div>
              <div className="p-3 max-h-[300px] overflow-y-auto">
                {moveHistory.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">No moves yet</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1 text-sm font-mono">
                    {moveHistory.map((move, i) => (
                      <div
                        key={i}
                        className={`px-2 py-1 rounded ${
                          i % 2 === 0 ? "text-white" : "text-white/70"
                        }`}
                      >
                        {i % 2 === 0 && <span className="text-white/30 mr-2">{Math.floor(i/2) + 1}.</span>}
                        {move}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="bg-[#0A0A0A]/50 border border-white/5 rounded-sm p-4">
              <p className="text-white/30 text-xs text-center">
                Practice mode • No stakes • Results don't affect your rating
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
