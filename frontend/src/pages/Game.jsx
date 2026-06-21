import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import io from "socket.io-client";
import {
  Flag,
  Clock,
  MessageSquare,
  Send,
  ChevronLeft,
  Trophy,
  X,
  Zap,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Smartphone,
  Settings,
} from "lucide-react";
import {
  moveFeedback,
  getSettings,
  saveSettings,
} from "@/utils/soundEffects";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const LOGO_URL = "https://customer-assets.emergentagent.com/job_178a8217-4229-40c1-991d-9721d9feaa79/artifacts/fw6vx6e7_7B379E95-255D-4728-84D0-6AAF030954E8.png";

export default function Game() {
  const { gameId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [chessInstance, setChessInstance] = useState(() => new Chess());
  const [position, setPosition] = useState("start");
  const [loading, setLoading] = useState(true);
  const [playerColor, setPlayerColor] = useState(null);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [moveStartTime, setMoveStartTime] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Click-to-move state
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  
  // Threefold repetition tracking
  const [positionHistory, setPositionHistory] = useState([]);

  // Sound and vibration settings
  const [settings, setSettings] = useState(() => getSettings());
  const [showSettings, setShowSettings] = useState(false);

  // Update settings handler
  const updateSettings = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // Fetch game data
  const fetchGame = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}`);
      const gameData = response.data;
      setGame(gameData);

      // Set player color
      if (gameData.white_player?.user_id === user?.user_id) {
        setPlayerColor("white");
      } else if (gameData.black_player?.user_id === user?.user_id) {
        setPlayerColor("black");
      } else {
        // Spectator mode
        setPlayerColor("spectator");
      }

      // Load position
      const chess = new Chess();
      if (gameData.fen && gameData.fen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        chess.load(gameData.fen);
      }
      setChessInstance(chess);
      setPosition(chess.fen());
      setMoveHistory(gameData.moves || []);
      setCurrentMoveIndex((gameData.moves || []).length - 1);

      // Set times
      setWhiteTime(gameData.white_time);
      setBlackTime(gameData.black_time);

      // Set last move for highlighting
      if (gameData.moves && gameData.moves.length > 0) {
        const lastMoveStr = gameData.moves[gameData.moves.length - 1];
        if (lastMoveStr && lastMoveStr.length >= 4) {
          setLastMove({
            from: lastMoveStr.substring(0, 2),
            to: lastMoveStr.substring(2, 4)
          });
        }
      }

      // Check if game is over
      if (gameData.status === "completed") {
        setGameOver(true);
        setResult({
          winner: gameData.result,
          reason: gameData.end_reason,
        });
      }

      // Set move start time for timing tracking
      if (gameData.status === "active") {
        setMoveStartTime(Date.now());
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load game:", error);
      toast.error("Failed to load game");
      navigate("/lobby");
    }
  }, [gameId, user, navigate]);

  // Initialize socket with robust reconnection for real-time sync
  useEffect(() => {
    // Configure Socket.IO with polling fallback for proxy environments
    socketRef.current = io(BACKEND_URL, {
      // Start with polling (more reliable through proxies), upgrade to websocket
      transports: ["polling", "websocket"],
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Path for socket.io
      path: "/socket.io/",
    });

    socketRef.current.on("connect", () => {
      console.log("🔌 Socket connected:", socketRef.current.id, "Transport:", socketRef.current.io.engine.transport.name);
      setSocketConnected(true);
      // Join game room on connect/reconnect
      socketRef.current.emit("join_game", { game_id: gameId });
      console.log("📤 Emitted join_game event for:", gameId);
      toast.success("Connected to game server", { duration: 2000 });
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocketConnected(false);
      toast.error("Disconnected from game server", { duration: 2000 });
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setSocketConnected(false);
    });

    socketRef.current.on("reconnect", (attemptNumber) => {
      console.log("Reconnected after", attemptNumber, "attempts");
      // Rejoin game room and sync state
      socketRef.current.emit("join_game", { game_id: gameId });
      fetchGame(); // Resync game state on reconnection
      toast.success("Reconnected to game", { duration: 2000 });
    });

    socketRef.current.on("reconnect_attempt", (attemptNumber) => {
      console.log("Reconnection attempt:", attemptNumber);
    });

    socketRef.current.on("joined_game", (data) => {
      console.log("Joined game room:", data.game_id);
    });

    // Handle game state sync on reconnection
    socketRef.current.on("game_sync", (data) => {
      if (data.game_id === gameId && !isReplayMode) {
        console.log("Syncing game state:", data);
        const chess = new Chess();
        chess.load(data.fen);
        setChessInstance(chess);
        setPosition(data.fen);
        setMoveHistory(data.moves || []);
        setCurrentMoveIndex((data.moves?.length || 0) - 1);
        
        // Update game status
        setGame(prev => ({
          ...prev,
          fen: data.fen,
          current_turn: data.current_turn,
          status: data.status
        }));
        
        // Set last move highlight if there are moves
        if (data.moves && data.moves.length > 0) {
          const lastMoveStr = data.moves[data.moves.length - 1];
          if (lastMoveStr && lastMoveStr.length >= 4) {
            setLastMove({
              from: lastMoveStr.substring(0, 2),
              to: lastMoveStr.substring(2, 4)
            });
          }
        }
      }
    });

    socketRef.current.on("move_made", (data) => {
      console.log("🎯 move_made event received from socket:", data, "gameId:", gameId, "isReplayMode:", isReplayMode);
      if (data.game_id === gameId && !isReplayMode) {
        console.log("✅ Processing move_made - updating board state");
        const chess = new Chess();
        chess.load(data.fen);
        setChessInstance(chess);
        setPosition(data.fen);
        setMoveHistory(prev => [...prev, data.move]);
        setCurrentMoveIndex(prev => prev + 1);
        
        // Update game state
        setGame((prev) => ({
          ...prev,
          fen: data.fen,
          current_turn: data.current_turn,
        }));

        // Set last move highlight
        if (data.move && data.move.length >= 4) {
          setLastMove({
            from: data.move.substring(0, 2),
            to: data.move.substring(2, 4)
          });
        }

        // Reset move start time
        setMoveStartTime(Date.now());

        // Check for game end and play sounds
        if (chess.isCheckmate()) {
          const winner = chess.turn() === "w" ? "black" : "white";
          setGameOver(true);
          setResult({ winner, reason: "checkmate" });
          moveFeedback('gameEnd', settings);
        } else if (chess.isDraw()) {
          setGameOver(true);
          setResult({ winner: "draw", reason: "draw" });
          moveFeedback('gameEnd', settings);
        } else if (chess.isCheck()) {
          moveFeedback('check', settings);
          toast("Check!", { icon: "♔" });
        } else {
          // Normal move or capture sound
          const lastMoveObj = chess.history({ verbose: true }).pop();
          if (lastMoveObj?.captured) {
            moveFeedback('capture', settings);
          } else {
            moveFeedback('move', settings);
          }
        }
      }
    });

    // Handle game started - when opponent joins
    socketRef.current.on("game_started", (data) => {
      if (data.game_id === gameId) {
        console.log("Game started event received:", data);
        setGame(data);
        setMoveStartTime(Date.now());
        
        // Play opponent joined sound and vibrate
        moveFeedback('opponentJoined', settings);
        
        toast.success("Opponent joined! Game starting...", { 
          duration: 3000,
          icon: "🎮"
        });
        
        // Refresh game data to get latest state
        fetchGame();
      }
    });

    // Handle player joined - auto-update when new player joins
    socketRef.current.on("player_joined", (data) => {
      if (data.game_id === gameId) {
        console.log("Player joined event:", data);
        
        // Play notification sound and vibrate
        moveFeedback('opponentJoined', settings);
        
        toast.success(`${data.username} joined the game!`, { 
          duration: 3000,
          icon: "👋"
        });
        
        // Fetch latest game state immediately
        fetchGame();
      }
    });

    // Handle game ended - resignation, checkmate, draw
    socketRef.current.on("game_ended", (data) => {
      if (data.game_id === gameId) {
        console.log("Game ended event:", data);
        setGameOver(true);
        setResult({
          winner: data.result,
          reason: data.reason,
        });
        
        // Play game end sound
        moveFeedback('gameEnd', settings);
        
        // Show appropriate toast
        if (data.reason === "resignation") {
          toast.info(`Game ended by resignation`, { duration: 4000 });
        } else if (data.reason === "threefold_repetition") {
          toast.info("Draw by threefold repetition!", { duration: 4000 });
        }
      }
    });

    // Handle threefold repetition draw
    socketRef.current.on("draw_declared", (data) => {
      if (data.game_id === gameId) {
        console.log("Draw declared:", data);
        setGameOver(true);
        setResult({ winner: "draw", reason: data.reason || "draw" });
        toast.info(`Draw: ${data.reason}`, { duration: 4000 });
      }
    });

    socketRef.current.on("chat_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socketRef.current.on("time_sync", (data) => {
      setWhiteTime(data.white_time);
      setBlackTime(data.black_time);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_game", { game_id: gameId });
        socketRef.current.disconnect();
      }
      // Clear current game ID when leaving
      localStorage.removeItem("currentGameId");
    };
  }, [gameId, isReplayMode, fetchGame]);

  // Polling-based sync as fallback when socket is not connected
  // This ensures real-time updates even without WebSocket
  const pollingRef = useRef(null);
  
  useEffect(() => {
    // Only poll when game is active and socket is not connected
    if (game?.status === "active" && !gameOver && !isReplayMode) {
      // Clear any existing poll
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      
      // Poll every 1 second for opponent moves if socket disconnected
      pollingRef.current = setInterval(async () => {
        if (!socketConnected) {
          try {
            const res = await axios.get(`${API}/games/${gameId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            const gameData = res.data;
            
            // Only update if FEN has changed (opponent made a move)
            if (gameData.fen !== position) {
              console.log("Polling detected move, syncing...");
              const chess = new Chess();
              chess.load(gameData.fen);
              setChessInstance(chess);
              setPosition(gameData.fen);
              setMoveHistory(gameData.moves || []);
              setCurrentMoveIndex((gameData.moves?.length || 0) - 1);
              setGame(gameData);
              
              // Set last move highlight
              if (gameData.moves && gameData.moves.length > 0) {
                const lastMoveStr = gameData.moves[gameData.moves.length - 1];
                if (lastMoveStr && lastMoveStr.length >= 4) {
                  setLastMove({
                    from: lastMoveStr.substring(0, 2),
                    to: lastMoveStr.substring(2, 4)
                  });
                }
              }
              
              // Check for game end
              if (chess.isCheckmate()) {
                const winner = chess.turn() === "w" ? "black" : "white";
                setGameOver(true);
                setResult({ winner, reason: "checkmate" });
              } else if (chess.isDraw()) {
                setGameOver(true);
                setResult({ winner: "draw", reason: "draw" });
              }
            }
          } catch (error) {
            console.error("Polling error:", error);
          }
        }
      }, 1000); // Poll every second
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [game?.status, gameOver, isReplayMode, socketConnected, position, gameId, token]);

  // Auto-refresh game state periodically while socket-connected
  useEffect(() => {
    if (game?.status !== "active" || gameOver || isReplayMode || !socketConnected) {
      return;
    }

    const autoRefreshInterval = setInterval(() => {
      fetchGame();
    }, 5000);

    return () => clearInterval(autoRefreshInterval);
  }, [game?.status, gameOver, isReplayMode, socketConnected, fetchGame]);

  // Fetch game on mount
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Timer logic - Fixed: White starts first, black only after white's first move
  useEffect(() => {
    if (game?.status !== "active" || gameOver || isReplayMode) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const currentTurn = chessInstance.turn(); // 'w' or 'b'
      const totalMoves = moveHistory.length;
      
      // White's timer runs when it's white's turn
      if (currentTurn === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            endGame("black", "timeout");
            return 0;
          }
          return prev - 1;
        });
      } 
      // Black's timer ONLY runs after white has made at least 1 move (totalMoves >= 1)
      else if (currentTurn === 'b' && totalMoves >= 1) {
        setBlackTime((prev) => {
          if (prev <= 1) {
            endGame("white", "timeout");
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game?.status, gameOver, isReplayMode, chessInstance, moveHistory.length]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get position key for threefold repetition (FEN without move counters)
  const getPositionKey = (fen) => {
    // FEN format: position activeColor castling enPassant halfmove fullmove
    // For repetition, we only care about: position activeColor castling enPassant
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  };

  // Check for threefold repetition
  const checkThreefoldRepetition = (newPositionHistory) => {
    const positionCounts = {};
    for (const pos of newPositionHistory) {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      if (positionCounts[pos] >= 3) {
        return true;
      }
    }
    return false;
  };

  // Core move execution function - used by both drag-drop and click-to-move
  const executeMove = (sourceSquare, targetSquare, promotion = "q") => {
    // Clear selection
    setSelectedSquare(null);
    setPossibleMoves([]);

    // Prevent moves in replay mode
    if (isReplayMode) {
      toast.error("Exit replay mode to make moves");
      return false;
    }
    
    // Prevent moves if game not active
    if (gameOver || game?.status !== "active") {
      console.log("Game not active:", game?.status);
      return false;
    }
    
    // Prevent moves if not your turn
    const isWhiteTurn = chessInstance.turn() === "w";
    if ((isWhiteTurn && playerColor !== "white") || (!isWhiteTurn && playerColor !== "black")) {
      toast.error("Not your turn!");
      return false;
    }

    // Prevent spectators from moving
    if (playerColor === "spectator") {
      toast.error("You are a spectator");
      return false;
    }

    if (!targetSquare || sourceSquare === targetSquare) {
      return false;
    }

    try {
      // Calculate move time
      const moveTime = moveStartTime ? (Date.now() - moveStartTime) / 1000 : 0;
      
      // Make move on local chess instance
      const move = chessInstance.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion,
      });

      if (move === null) {
        console.log("Invalid move");
        return false;
      }

      const newFen = chessInstance.fen();
      console.log("Move made:", move.lan, "New FEN:", newFen);

      // Track position for threefold repetition
      const posKey = getPositionKey(newFen);
      const newPositionHistory = [...positionHistory, posKey];
      setPositionHistory(newPositionHistory);

      // Check for threefold repetition
      if (checkThreefoldRepetition(newPositionHistory)) {
        console.log("Threefold repetition detected!");
        endGame("draw", "threefold_repetition");
        // Emit threefold event via socket
        socketRef.current?.emit("threefold_repetition", {
          game_id: gameId,
          fen: newFen
        });
      }

      // Update local state immediately
      setPosition(newFen);
      setMoveHistory(prev => [...prev, move.lan]);
      setCurrentMoveIndex(prev => prev + 1);
      setLastMove({ from: sourceSquare, to: targetSquare });
      setMoveStartTime(Date.now());

      // Update game state
      setGame(prev => ({
        ...prev,
        fen: newFen,
        current_turn: chessInstance.turn() === "w" ? "white" : "black"
      }));

      // Send move to server
      axios.post(
        `${API}/games/${gameId}/move`,
        {
          game_id: gameId,
          move: move.lan,
          fen: newFen,
          move_time: moveTime
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      ).then(() => {
        console.log("Move sent to server");
      }).catch((error) => {
        console.error("Failed to send move:", error);
        toast.error("Failed to send move to server");
      });

      // Emit via socket for real-time sync - only if connected
      if (socketRef.current && socketConnected) {
        console.log("Emitting game_move via socket:", move.lan);
        socketRef.current.emit("game_move", {
          game_id: gameId,
          move: move.lan,
          fen: newFen,
          current_turn: chessInstance.turn() === "w" ? "white" : "black"
        });
      } else {
        console.warn("Socket not connected, game_move not emitted. Relying on polling and REST API.");
      }

      // Play appropriate sound and haptic feedback
      if (chessInstance.isCheckmate()) {
        moveFeedback('gameEnd', settings);
        endGame(playerColor, "checkmate");
      } else if (chessInstance.isDraw()) {
        moveFeedback('gameEnd', settings);
        endGame("draw", "draw");
      } else if (chessInstance.isCheck()) {
        moveFeedback('check', settings);
        toast("Check!", { icon: "♔" });
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

  // react-chessboard v5.10.0 passes { piece, sourceSquare, targetSquare } object
  const onPieceDrop = ({ piece, sourceSquare, targetSquare }) => {
    return executeMove(sourceSquare, targetSquare, "q");
  };

  // Handle square click for click-to-move
  // react-chessboard v5.10.0 passes { piece, square } object
  const onSquareClick = ({ piece: clickedPiece, square }) => {
    // Prevent interaction in replay mode or if game is over
    if (isReplayMode || gameOver || game?.status !== "active") {
      return;
    }

    // Prevent spectators
    if (playerColor === "spectator") {
      return;
    }

    // Check if it's the player's turn
    const isWhiteTurn = chessInstance.turn() === "w";
    const isMyTurnNow = (isWhiteTurn && playerColor === "white") || (!isWhiteTurn && playerColor === "black");
    
    if (!isMyTurnNow) {
      if (selectedSquare) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
      return;
    }

    // If a square is already selected
    if (selectedSquare) {
      // Try to move to the clicked square
      if (possibleMoves.includes(square)) {
        executeMove(selectedSquare, square, "q");
      } else {
        // Check if clicking on own piece to reselect
        const piece = chessInstance.get(square);
        if (piece && ((piece.color === 'w' && playerColor === "white") || (piece.color === 'b' && playerColor === "black"))) {
          // Select new piece
          setSelectedSquare(square);
          const moves = chessInstance.moves({ square, verbose: true });
          setPossibleMoves(moves.map(m => m.to));
        } else {
          // Deselect
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      // No square selected, check if clicking on own piece
      const piece = chessInstance.get(square);
      if (piece && ((piece.color === 'w' && playerColor === "white") || (piece.color === 'b' && playerColor === "black"))) {
        setSelectedSquare(square);
        const moves = chessInstance.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to));
      }
    }
  };

  // Handle right-click to deselect
  // react-chessboard v5.10.0 passes { piece, square } object
  const onSquareRightClick = ({ piece, square }) => {
    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  const endGame = async (winner, reason) => {
    if (gameOver) return;

    try {
      await axios.post(
        `${API}/games/${gameId}/end`,
        { result: winner, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("Failed to end game:", error);
    }

    setGameOver(true);
    setResult({ winner, reason });
    // Clear current game ID when game ends
    localStorage.removeItem("currentGameId");
  };

  const handleResign = async () => {
    if (!window.confirm("Are you sure you want to resign? You will lose the game.")) {
      return;
    }

    try {
      await axios.post(
        `${API}/games/${gameId}/resign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.info("You resigned");
    } catch (error) {
      toast.error("Failed to resign");
    }
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;

    socketRef.current?.emit("chat_message", {
      game_id: gameId,
      message: chatInput,
      username: user?.username,
    });

    setChatInput("");
  };

  // Replay functions
  const enterReplayMode = () => {
    setIsReplayMode(true);
    setCurrentMoveIndex(moveHistory.length - 1);
  };

  const exitReplayMode = () => {
    setIsReplayMode(false);
    // Restore to current game position
    const chess = new Chess();
    moveHistory.forEach(move => chess.move(move));
    setChessInstance(chess);
    setPosition(chess.fen());
    setCurrentMoveIndex(moveHistory.length - 1);
  };

  const goToMove = (index) => {
    if (index < -1 || index >= moveHistory.length) return;
    
    const chess = new Chess();
    for (let i = 0; i <= index; i++) {
      if (moveHistory[i]) {
        chess.move(moveHistory[i]);
      }
    }
    setPosition(chess.fen());
    setCurrentMoveIndex(index);
    
    // Update last move highlight
    if (index >= 0 && moveHistory[index]) {
      const move = moveHistory[index];
      if (move.length >= 4) {
        setLastMove({
          from: move.substring(0, 2),
          to: move.substring(2, 4)
        });
      }
    } else {
      setLastMove(null);
    }
  };

  const goToStart = () => goToMove(-1);
  const goToEnd = () => goToMove(moveHistory.length - 1);
  const goBack = () => goToMove(currentMoveIndex - 1);
  const goForward = () => goToMove(currentMoveIndex + 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-16 h-16 spinner" />
      </div>
    );
  }

  const currentTurn = chessInstance.turn();
  const isMyTurn =
    (currentTurn === "w" && playerColor === "white") ||
    (currentTurn === "b" && playerColor === "black");

  const opponent = playerColor === "white" ? game?.black_player : game?.white_player;
  const myPlayer = playerColor === "white" ? game?.white_player : game?.black_player;

  // Custom square styles for highlighting
  const customSquareStyles = {};
  
  // Last move highlight (gold)
  if (lastMove) {
    customSquareStyles[lastMove.from] = {
      backgroundColor: "rgba(212, 175, 55, 0.4)",
    };
    customSquareStyles[lastMove.to] = {
      backgroundColor: "rgba(212, 175, 55, 0.6)",
    };
  }
  
  // Selected square highlight (blue)
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: "rgba(0, 194, 255, 0.5)",
      boxShadow: "inset 0 0 0 3px rgba(0, 194, 255, 0.8)",
    };
  }
  
  // Possible moves highlight (green dots or circles)
  possibleMoves.forEach(square => {
    const piece = chessInstance.get(square);
    if (piece) {
      // Capture square - red tint with ring
      customSquareStyles[square] = {
        ...customSquareStyles[square],
        backgroundColor: "rgba(255, 59, 48, 0.4)",
        boxShadow: "inset 0 0 0 3px rgba(255, 59, 48, 0.6)",
      };
    } else {
      // Empty square - green dot indicator
      customSquareStyles[square] = {
        ...customSquareStyles[square],
        background: customSquareStyles[square]?.backgroundColor 
          ? `radial-gradient(circle at center, rgba(0, 255, 148, 0.6) 25%, transparent 25%), ${customSquareStyles[square].backgroundColor}`
          : "radial-gradient(circle at center, rgba(0, 255, 148, 0.6) 25%, transparent 25%)",
      };
    }
  });

  // Determine board orientation
  const boardOrientation = playerColor === "black" ? "black" : "white";

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
                data-testid="back-to-lobby-btn"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Lobby
              </Button>
              <Link to="/" className="flex items-center gap-2">
                <img src={LOGO_URL} alt="StakeChess" className="w-8 h-8" />
              </Link>
            </div>

            {/* Stake Amount Display */}
            {game?.stake_amount > 0 && (
              <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/10 border border-[#D4AF37]/50 px-6 py-2 rounded-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#D4AF37]" />
                  <span className="font-mono text-[#D4AF37] text-lg font-bold">
                    POT: {(game.stake_amount * 2).toFixed(2)} {game.stake_currency}
                  </span>
                </div>
              </div>
            )}

            {/* Replay Mode Indicator */}
            {isReplayMode && (
              <div className="bg-[#00C2FF]/20 border border-[#00C2FF]/50 px-4 py-1 rounded-sm">
                <span className="text-[#00C2FF] text-sm">Replay Mode</span>
              </div>
            )}

            {/* Connection Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-sm ${
              socketConnected 
                ? "bg-[#00FF94]/10 border border-[#00FF94]/30" 
                : "bg-[#D4AF37]/10 border border-[#D4AF37]/30"
            }`}>
              <div className={`w-2 h-2 rounded-full ${socketConnected ? "bg-[#00FF94] animate-pulse" : "bg-[#D4AF37] animate-pulse"}`} />
              <span className={`text-xs font-mono ${socketConnected ? "text-[#00FF94]" : "text-[#D4AF37]"}`}>
                {socketConnected ? "LIVE" : "SYNC"}
              </span>
            </div>

            {/* Settings Button */}
            <div className="relative">
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="ghost"
                size="sm"
                className={`text-white/70 hover:text-white ${showSettings ? 'bg-white/10' : ''}`}
                data-testid="game-settings-btn"
              >
                <Settings className="w-4 h-4" />
              </Button>
              
              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-sm shadow-lg z-50">
                  <div className="p-4 border-b border-white/10">
                    <h3 className="text-white font-semibold text-sm">Game Settings</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Sound Toggle */}
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
                    
                    {/* Vibration Toggle */}
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
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        <div className="grid lg:grid-cols-[1fr,320px] gap-4 md:gap-6">
          {/* Main Game Area */}
          <div>
            {/* Opponent info */}
            <div className={`flex items-center justify-between mb-3 bg-[#0A0A0A] border p-3 md:p-4 rounded-sm transition-all ${
              !isMyTurn && game?.status === "active" && !isReplayMode ? "border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-white/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-sm flex items-center justify-center ${
                  !isMyTurn && game?.status === "active" && !isReplayMode ? "bg-[#D4AF37]/20" : "bg-[#121212]"
                }`}>
                  <span className={`font-bold text-lg ${
                    !isMyTurn && game?.status === "active" && !isReplayMode ? "text-[#D4AF37]" : "text-white/50"
                  }`}>
                    {opponent?.username?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm md:text-base">
                      {opponent?.username || "Waiting..."}
                    </p>
                    {!isMyTurn && game?.status === "active" && !isReplayMode && (
                      <span className="text-[10px] md:text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-sm uppercase tracking-wider animate-pulse">
                        Thinking
                      </span>
                    )}
                  </div>
                  <p className="text-[#D4AF37] text-xs md:text-sm font-mono font-bold">
                    {opponent?.rating || 1200} ELO
                  </p>
                </div>
              </div>
              <div
                className={`font-mono text-xl md:text-2xl font-bold px-3 md:px-4 py-2 rounded-sm transition-all ${
                  !isMyTurn && game?.status === "active" && !isReplayMode
                    ? "bg-[#D4AF37] text-black"
                    : "bg-[#121212] text-white/50"
                } ${(playerColor === "white" ? blackTime : whiteTime) < 30 ? "timer-low" : ""}`}
                data-testid="opponent-timer"
              >
                {formatTime(playerColor === "white" ? blackTime : whiteTime)}
              </div>
            </div>

            {/* Chess Board */}
            <div
              className="relative bg-[#0A0A0A] p-2 md:p-4 rounded-sm border border-white/5"
              data-testid="chess-board-container"
            >
              <Chessboard
                options={{
                  id: "PlayableChessboard",
                  position: position,
                  onPieceDrop: onPieceDrop,
                  onSquareClick: onSquareClick,
                  onSquareRightClick: onSquareRightClick,
                  boardOrientation: boardOrientation,
                  // Improved colors for better piece visibility
                  darkSquareStyle: { 
                    backgroundColor: "#2D4A2D",  // Deep forest green
                  },
                  lightSquareStyle: { 
                    backgroundColor: "#E8DCC4",  // Warm cream/beige
                  },
                  squareStyles: customSquareStyles,
                  boardStyle: {
                    borderRadius: "4px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  },
                  // Fast animation for bullet/blitz - 150ms is snappy
                  animationDuration: 150,
                  arePiecesDraggable: !isReplayMode && !gameOver && game?.status === "active" && playerColor !== "spectator",
                }}
              />

              {/* Game Over Overlay */}
              {gameOver && !isReplayMode && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center p-8">
                    <Trophy
                      className={`w-16 h-16 mx-auto mb-4 ${
                        result?.winner === playerColor
                          ? "text-[#D4AF37]"
                          : result?.winner === "draw"
                          ? "text-white/50"
                          : "text-[#FF3B30]"
                      }`}
                    />
                    <h2
                      className={`font-heading text-3xl mb-2 ${
                        result?.winner === playerColor
                          ? "text-[#00FF94] glitch-text"
                          : result?.winner === "draw"
                          ? "text-white"
                          : "text-[#FF3B30]"
                      }`}
                      data-testid="game-result-title"
                    >
                      {result?.winner === playerColor
                        ? "Victory!"
                        : result?.winner === "draw"
                        ? "Draw"
                        : "Defeat"}
                    </h2>
                    <p className="text-white/50 mb-4 capitalize">
                      by {result?.reason}
                    </p>
                    {game?.stake_amount > 0 && result?.winner === playerColor && (
                      <p className="text-[#00FF94] font-mono text-lg mb-4">
                        +{(game.stake_amount * 2 * 0.98).toFixed(2)}{" "}
                        {game.stake_currency}
                      </p>
                    )}
                    <div className="flex gap-3 justify-center">
                      <Button
                        onClick={enterReplayMode}
                        variant="outline"
                        className="bg-transparent border-white/20 text-white hover:bg-white/10"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Replay
                      </Button>
                      <Button
                        onClick={() => navigate("/lobby")}
                        className="bg-[#D4AF37] text-black hover:bg-[#F4C430] font-bold uppercase tracking-wider"
                        data-testid="back-to-lobby-result-btn"
                      >
                        Back to Lobby
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Player info */}
            <div className={`flex items-center justify-between mt-3 bg-[#0A0A0A] border p-3 md:p-4 rounded-sm transition-all ${
              isMyTurn && game?.status === "active" && !isReplayMode ? "border-[#00FF94]/50 shadow-[0_0_15px_rgba(0,255,148,0.2)]" : "border-white/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-sm flex items-center justify-center ${
                  isMyTurn && game?.status === "active" && !isReplayMode ? "bg-[#00FF94]/20" : "bg-[#D4AF37]/20"
                }`}>
                  <span className={`font-bold text-lg ${
                    isMyTurn && game?.status === "active" && !isReplayMode ? "text-[#00FF94]" : "text-[#D4AF37]"
                  }`}>
                    {user?.username?.charAt(0)?.toUpperCase() || "Y"}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm md:text-base">
                      {user?.username} (You)
                    </p>
                    {isMyTurn && game?.status === "active" && !isReplayMode && (
                      <span className="text-[10px] md:text-xs bg-[#00FF94]/20 text-[#00FF94] px-2 py-0.5 rounded-sm uppercase tracking-wider">
                        Your Turn
                      </span>
                    )}
                  </div>
                  <p className="text-[#D4AF37] text-xs md:text-sm font-mono font-bold">
                    {myPlayer?.rating || user?.rating || 1200} ELO
                  </p>
                </div>
              </div>
              <div
                className={`font-mono text-xl md:text-2xl font-bold px-3 md:px-4 py-2 rounded-sm transition-all ${
                  isMyTurn && game?.status === "active" && !isReplayMode
                    ? "bg-[#00FF94] text-black"
                    : "bg-[#121212] text-white/50"
                } ${(playerColor === "white" ? whiteTime : blackTime) < 30 ? "timer-low" : ""}`}
                data-testid="player-timer"
              >
                {formatTime(playerColor === "white" ? whiteTime : blackTime)}
              </div>
            </div>

            {/* Game Actions */}
            {!gameOver && game?.status === "active" && !isReplayMode && (
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={handleResign}
                  variant="outline"
                  className="bg-transparent border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30]/10 hover:border-[#FF3B30]"
                  data-testid="resign-btn"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Resign
                </Button>
                <Button
                  onClick={() => setShowChat(!showChat)}
                  variant="outline"
                  className="bg-transparent border-white/10 text-white hover:bg-white/5 lg:hidden"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat
                </Button>
              </div>
            )}

            {/* Replay Controls */}
            {(isReplayMode || gameOver) && moveHistory.length > 0 && (
              <div className="mt-4 bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">Game Replay</h3>
                  {isReplayMode && (
                    <Button
                      onClick={exitReplayMode}
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Exit Replay
                    </Button>
                  )}
                  {!isReplayMode && gameOver && (
                    <Button
                      onClick={enterReplayMode}
                      size="sm"
                      className="bg-[#D4AF37] text-black hover:bg-[#F4C430]"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start Replay
                    </Button>
                  )}
                </div>
                {isReplayMode && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Button
                        onClick={goToStart}
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-white/10 text-white hover:bg-white/10"
                      >
                        <Rewind className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={goBack}
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-white/10 text-white hover:bg-white/10"
                        disabled={currentMoveIndex < 0}
                      >
                        <SkipBack className="w-4 h-4" />
                      </Button>
                      <span className="text-white/50 font-mono text-sm px-3">
                        {currentMoveIndex + 1} / {moveHistory.length}
                      </span>
                      <Button
                        onClick={goForward}
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-white/10 text-white hover:bg-white/10"
                        disabled={currentMoveIndex >= moveHistory.length - 1}
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={goToEnd}
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-white/10 text-white hover:bg-white/10"
                      >
                        <FastForward className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="w-full bg-[#121212] rounded-full h-2">
                      <div
                        className="bg-[#D4AF37] h-2 rounded-full transition-all"
                        style={{ width: `${moveHistory.length > 0 ? ((currentMoveIndex + 1) / moveHistory.length) * 100 : 0}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Waiting for opponent */}
            {game?.status === "waiting" && (
              <div className="mt-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4 rounded-sm text-center">
                <div className="w-8 h-8 spinner mx-auto mb-2" />
                <p className="text-[#D4AF37]">Waiting for opponent to join...</p>
                {game?.stake_amount > 0 && (
                  <p className="text-white/50 text-sm mt-2">
                    Stake: {game.stake_amount} {game.stake_currency} locked in escrow
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Game Info Card */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">Match Info</h3>
                <span className={`text-xs px-2 py-1 rounded-sm ${
                  game?.status === "active" ? "status-active" : 
                  game?.status === "waiting" ? "status-waiting" : "status-completed"
                }`}>
                  {game?.status?.toUpperCase()}
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/50 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Time Control
                  </span>
                  <span className="text-white font-mono">{game?.time_control}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Game Type</span>
                  <span className="text-white capitalize">{game?.game_type}</span>
                </div>
                {game?.stake_amount > 0 && (
                  <>
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-white/50">Your Stake</span>
                        <span className="text-[#D4AF37] font-mono font-bold">
                          {game.stake_amount} {game.stake_currency}
                        </span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-white/50">Total Pot</span>
                        <span className="text-white font-mono">
                          {(game.stake_amount * 2).toFixed(2)} {game.stake_currency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Winner Gets</span>
                        <span className="text-[#00FF94] font-mono font-bold">
                          {(game.stake_amount * 2 * 0.98).toFixed(2)} {game.stake_currency}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Move History */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-sm">
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Move History</h3>
                <span className="text-white/30 text-xs">{moveHistory.length} moves</span>
              </div>
              <ScrollArea className="h-40 md:h-48 p-3">
                <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                  {moveHistory.map((move, index) => (
                    <div
                      key={index}
                      onClick={() => isReplayMode && goToMove(index)}
                      className={`px-2 py-1 rounded-sm cursor-pointer transition-colors ${
                        index === currentMoveIndex
                          ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                          : index % 2 === 0 ? "bg-[#121212] hover:bg-[#1a1a1a]" : "hover:bg-[#121212]"
                      }`}
                    >
                      {index % 2 === 0 && (
                        <span className="text-white/30 mr-2">
                          {Math.floor(index / 2) + 1}.
                        </span>
                      )}
                      <span className={index === currentMoveIndex ? "text-[#D4AF37]" : "text-white"}>
                        {move}
                      </span>
                    </div>
                  ))}
                </div>
                {moveHistory.length === 0 && (
                  <p className="text-white/30 text-center py-4 text-sm">
                    No moves yet
                  </p>
                )}
              </ScrollArea>
            </div>

            {/* Chat */}
            <div className={`bg-[#0A0A0A] border border-white/5 rounded-sm ${showChat ? "block" : "hidden lg:block"}`}>
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Game Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="lg:hidden text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ScrollArea className="h-32 md:h-40 p-3">
                <div className="space-y-2">
                  {messages.map((msg, index) => (
                    <div key={index} className="text-sm">
                      <span className="text-[#D4AF37] font-semibold">{msg.username}:</span>{" "}
                      <span className="text-white/80">{msg.message}</span>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p className="text-white/30 text-center py-4 text-sm">No messages yet</p>
                  )}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-white/5">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type a message..."
                    className="bg-[#121212] border-white/10 text-white text-sm h-9"
                    data-testid="chat-input"
                  />
                  <Button
                    onClick={sendMessage}
                    size="sm"
                    className="bg-[#D4AF37] text-black hover:bg-[#F4C430] h-9 px-3"
                    data-testid="send-chat-btn"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
