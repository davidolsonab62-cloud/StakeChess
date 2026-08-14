import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { Copy, RotateCcw, Zap, Layers } from "lucide-react";

const INITIAL_FEN = "start";
const PIECE_PALETTE = [
  { label: "White King", value: "wK" },
  { label: "White Queen", value: "wQ" },
  { label: "White Rook", value: "wR" },
  { label: "White Bishop", value: "wB" },
  { label: "White Knight", value: "wN" },
  { label: "White Pawn", value: "wP" },
  { label: "Black King", value: "bK" },
  { label: "Black Queen", value: "bQ" },
  { label: "Black Rook", value: "bR" },
  { label: "Black Bishop", value: "bB" },
  { label: "Black Knight", value: "bN" },
  { label: "Black Pawn", value: "bP" },
];

const SQUARES = [
  "a8","b8","c8","d8","e8","f8","g8","h8",
  "a7","b7","c7","d7","e7","f7","g7","h7",
  "a6","b6","c6","d6","e6","f6","g6","h6",
  "a5","b5","c5","d5","e5","f5","g5","h5",
  "a4","b4","c4","d4","e4","f4","g4","h4",
  "a3","b3","c3","d3","e3","f3","g3","h3",
  "a2","b2","c2","d2","e2","f2","g2","h2",
  "a1","b1","c1","d1","e1","f1","g1","h1",
];

function buildChess() {
  return new Chess();
}

function countPiecesFromFen(fen) {
  const chess = new Chess();
  const loaded = fen === "start" ? chess.reset() : chess.load(fen);
  if (!loaded && fen !== "start") {
    return {};
  }

  const counts = {};
  SQUARES.forEach((square) => {
    const piece = chess.get(square);
    if (piece) {
      const code = `${piece.color}${piece.type.toUpperCase()}`;
      counts[code] = (counts[code] || 0) + 1;
    }
  });
  return counts;
}

export default function BoardEditor() {
  const navigate = useNavigate();
  useAuth();
  const chessRef = useRef(buildChess());
  const boardWrapperRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(420);
  const [boardPosition, setBoardPosition] = useState(INITIAL_FEN);
  const [originalPosition, setOriginalPosition] = useState(INITIAL_FEN);
  const [moveHistory, setMoveHistory] = useState([]);
  const [fenInput, setFenInput] = useState("");
  const removedCounts = useMemo(() => {
    const original = countPiecesFromFen(originalPosition);
    const current = countPiecesFromFen(boardPosition);
    const counts = {};

    PIECE_PALETTE.forEach((piece) => {
      const originalCount = original[piece.value] || 0;
      const currentCount = current[piece.value] || 0;
      counts[piece.value] = Math.max(0, originalCount - currentCount);
    });

    return counts;
  }, [originalPosition, boardPosition]);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState("white");

  const loadBoard = useCallback((fen, keepOriginal = false) => {
    const chess = buildChess();
    const loaded = fen === "start" ? chess.reset() : chess.load(fen);
    if (!loaded && fen !== "start") {
      return false;
    }
    chessRef.current = chess;
    setBoardPosition(chess.fen());
    if (!keepOriginal) {
      setOriginalPosition(chess.fen());
    }
    setSelectedPiece(null);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setAnalysis(null);
    setMoveHistory([]);
    return true;
  }, []);

  const updateCurrentBoard = useCallback((chess) => {
    chessRef.current = chess;
    setBoardPosition(chess.fen());
    setSelectedSquare(null);
    setPossibleMoves([]);
    setAnalysis(null);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      const wrapperWidth = boardWrapperRef.current?.clientWidth || window.innerWidth;
      const newWidth = Math.min(Math.max(wrapperWidth, 260), 520);
      setBoardWidth(newWidth);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const draggingPieceRef = useRef(null);

  const handlePieceDrag = useCallback(({ piece, square }) => {
    draggingPieceRef.current = { piece, square };
  }, []);

  const clearDraggingPiece = useCallback(() => {
    draggingPieceRef.current = null;
  }, []);

  useEffect(() => {
    const removeIfOverPalette = (clientX, clientY) => {
      if (!draggingPieceRef.current) return;

      const target = document.elementFromPoint(clientX, clientY);
      const paletteButton = target?.closest?.("button[data-piece]");
      if (paletteButton) {
        const { square: sourceSquare } = draggingPieceRef.current;
        const chess = new Chess(chessRef.current.fen());
        chess.remove(sourceSquare);
        updateCurrentBoard(chess);
      }
      clearDraggingPiece();
    };

    // Some touch browsers fire pointercancel instead of pointerup once a
    // gesture is interpreted as a scroll, so we still need to resolve the
    // drop (or at least clear drag state) in that case.
    const handlePointerUp = (event) => removeIfOverPalette(event.clientX, event.clientY);
    const handlePointerCancel = (event) => {
      if (event.clientX || event.clientY) {
        removeIfOverPalette(event.clientX, event.clientY);
      } else {
        clearDraggingPiece();
      }
    };
    const handleTouchEnd = (event) => {
      const touch = event.changedTouches?.[0];
      if (touch) removeIfOverPalette(touch.clientX, touch.clientY);
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    window.addEventListener("touchend", handleTouchEnd, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("touchend", handleTouchEnd, true);
    };
  }, [clearDraggingPiece, updateCurrentBoard]);

  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!sourceSquare) {
      return false;
    }

    if (targetSquare == null) {
      const chess = new Chess(chessRef.current.fen());
      chess.remove(sourceSquare);
      updateCurrentBoard(chess);
      clearDraggingPiece();
      return true;
    }

    const chess = new Chess(chessRef.current.fen());
    const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!move) {
      clearDraggingPiece();
      return false;
    }
    updateCurrentBoard(chess);
    setMoveHistory((prev) => [...prev, move.san]);
    clearDraggingPiece();
    return true;
  }, [clearDraggingPiece, updateCurrentBoard]);

  const placePiece = useCallback(
    (pieceCode, square) => {
      if (!pieceCode || !square) return;
      const chess = new Chess(chessRef.current.fen());
      const color = pieceCode[0] === "w" ? "w" : "b";
      const type = pieceCode[1].toLowerCase();
      chess.put({ type, color }, square);
      updateCurrentBoard(chess);
      setSelectedPiece(null);
      setSelectedSquare(null);
    },
    [updateCurrentBoard]
  );

  const handlePaletteClick = useCallback(
    (pieceCode) => {
      if (selectedSquare) {
        placePiece(pieceCode, selectedSquare);
        return;
      }
      setSelectedPiece(pieceCode);
    },
    [selectedSquare, placePiece]
  );

  const getSquareFromPointer = useCallback((event) => {
    const board = boardWrapperRef.current?.querySelector(".Chessboard");
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const fileIndex = Math.floor((x / rect.width) * 8);
    const rankIndex = Math.floor((y / rect.height) * 8);
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
    const square = `${files[fileIndex]}${ranks[rankIndex]}`;
    return square;
  }, []);

  const handleBoardDrop = useCallback(
    (event) => {
      event.preventDefault();
      const pieceCode = event.dataTransfer?.getData("text/plain");
      const square = getSquareFromPointer(event);
      if (pieceCode && square) {
        placePiece(pieceCode, square);
      }
    },
    [getSquareFromPointer, placePiece]
  );

  const handlePaletteDrop = useCallback(
    (event, pieceCode) => {
      event.preventDefault();
      const draggedPiece = event.dataTransfer?.getData("text/plain");
      const sourceSquare = event.dataTransfer?.getData("text/square");

      if (sourceSquare && draggedPiece === pieceCode) {
        const chess = new Chess(chessRef.current.fen());
        chess.remove(sourceSquare);
        updateCurrentBoard(chess);
        return;
      }

      if (draggedPiece) {
        setSelectedPiece(draggedPiece);
        if (selectedSquare) {
          placePiece(draggedPiece, selectedSquare);
        }
        return;
      }

      handlePaletteClick(pieceCode);
    },
    [handlePaletteClick, selectedSquare, placePiece, updateCurrentBoard]
  );

  const handlePaletteDragStart = useCallback((event, pieceCode) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", pieceCode);
    event.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleSquareClick = useCallback(
    ({ piece: clickedPiece, square }) => {
      if (selectedPiece) {
        placePiece(selectedPiece, square);
        return;
      }

      const chess = new Chess(chessRef.current.fen());

      if (selectedSquare) {
        if (square === selectedSquare) {
          setSelectedSquare(null);
          setPossibleMoves([]);
          return;
        }

        const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
        if (move) {
          updateCurrentBoard(chess);
          setMoveHistory((prev) => [...prev, move.san]);
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
        return;
      }

      if (clickedPiece) {
        setSelectedSquare(square);
        const moves = chess.moves({ square, verbose: true });
        setPossibleMoves(moves.map((m) => m.to));
      }
    },
    [selectedPiece, selectedSquare, updateCurrentBoard]
  );

  const handleSquareRightClick = useCallback(({ square }) => {
    if (selectedPiece) {
      setSelectedPiece(null);
      return;
    }

    const chess = new Chess(chessRef.current.fen());
    chess.remove(square);
    updateCurrentBoard(chess);
  }, [updateCurrentBoard]);

  const handleResetBoard = useCallback(() => loadBoard(originalPosition, true), [loadBoard, originalPosition]);
  const handleClearBoard = useCallback(() => {
    const chess = buildChess();
    chess.clear();
    updateCurrentBoard(chess);
    setMoveHistory([]);
  }, [updateCurrentBoard]);

  const handleSetFen = useCallback(() => {
    if (!fenInput.trim()) {
      toast.error("Enter a FEN string to load.");
      return;
    }
    const chess = new Chess();
    const loaded = fenInput.trim() === "start" ? chess.reset() : chess.load(fenInput.trim());
    if (!loaded) {
      toast.error("Invalid FEN. Please check the format and try again.");
      return;
    }
    chessRef.current = chess;
    setBoardPosition(chess.fen());
    setOriginalPosition(chess.fen());
    setSelectedPiece(null);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setAnalysis(null);
    setMoveHistory([]);
    setFenInput("");
  }, [fenInput]);

  const handleCopyFen = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(boardPosition);
      toast.success("Current FEN copied to clipboard");
    } catch (error) {
      toast.error("Could not copy FEN. Try again manually.");
    }
  }, [boardPosition]);

  const practiceUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/play-computer?fen=${encodeURIComponent(boardPosition)}`;
  }, [boardPosition]);

  const handleGoToPractice = useCallback(() => {
    navigate(`/play-computer?fen=${encodeURIComponent(boardPosition)}`);
  }, [navigate, boardPosition]);

  const handleCopyPracticeLink = useCallback(async () => {
    if (!practiceUrl) return;
    try {
      await navigator.clipboard.writeText(practiceUrl);
      toast.success("Practice URL copied to clipboard");
    } catch (error) {
      toast.error("Could not copy practice link. Try again manually.");
    }
  }, [practiceUrl]);

  const handleAnalyzePosition = useCallback(async () => {
    const fen = chessRef.current.fen();
    if (!fen) {
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const response = await axios.post(`${API}/computer/move`, {
        fen,
        depth: 12,
        analysis: true,
        multi_pv: 3,
      });
      setAnalysis(response.data);
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || "Failed to analyze position.";
      setAnalysisError(message);
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const squareStyles = useMemo(() => {
    const styles = {};
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(16, 185, 129, 0.25)" };
    }
    possibleMoves.forEach((square) => {
      styles[square] = { backgroundColor: "rgba(59, 130, 246, 0.2)" };
    });
    return styles;
  }, [selectedSquare, possibleMoves]);

  return (
    <div className="sc-page max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)" }}>
            Board editor
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Rearrange pieces, create a custom position, and analyze it with Stockfish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/lobby")} className="font-semibold">
            Back to dashboard
          </Button>
          <Button variant="outline" onClick={handleResetBoard} className="font-semibold">
            Reset board
          </Button>
          <Button variant="outline" onClick={handleClearBoard} className="font-semibold">
            Clear board
          </Button>
          <Button variant="outline" onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))} className="font-semibold">
            <RotateCcw className="w-4 h-4 mr-2" /> Flip board
          </Button>
          <Button size="sm" onClick={handleGoToPractice} className="font-semibold">
            Next
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div
          ref={boardWrapperRef}
          className="rounded-2xl border border-hair bg-surface-1 p-4 shadow-sm"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleBoardDrop}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-text-secondary uppercase tracking-[0.2em]">Board editor</p>
              <h2 className="text-lg font-semibold">Drag, drop, or click to move</h2>
            </div>
            <div className="text-xs text-text-secondary">
              Orientation: {boardOrientation === "white" ? "White" : "Black"}
            </div>
          </div>
          <div className="mb-4" style={{ touchAction: "none" }}>
            <Chessboard
              id="BoardEditorChessboard"
              position={boardPosition}
              boardOrientation={boardOrientation}
              onPieceDrop={handlePieceDrop}
              onPieceDrag={handlePieceDrag}
              onSquareClick={handleSquareClick}
              onSquareRightClick={handleSquareRightClick}
              customSquareStyles={squareStyles}
              arePiecesDraggable={true}
              boardWidth={boardWidth}
            />
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-sm text-text-secondary mb-2">Piece palette</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PIECE_PALETTE.map((piece) => (
                  <button
                    key={piece.value}
                    type="button"
                    draggable
                    data-piece={piece.value}
                    onDragStart={(event) => handlePaletteDragStart(event, piece.value)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handlePaletteDrop(event, piece.value)}
                    onMouseEnter={() => handlePaletteHover(piece.value)}
                    onMouseLeave={() => handlePaletteLeave(piece.value)}
                    onClick={() => handlePaletteClick(piece.value)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${selectedPiece === piece.value ? "border-brand bg-brand-dim text-brand" : "border-transparent bg-white text-text-primary"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{piece.label}</span>
                      {removedCounts[piece.value] > 0 && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-secondary">
                          {removedCounts[piece.value]}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedPiece(null)} className="font-semibold">
                  Clear selection
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyFen} className="font-semibold">
                  <Copy className="w-4 h-4 mr-2" /> Copy FEN
                </Button>
              </div>
              {selectedPiece && (
                <div className="mt-3 rounded-2xl border border-brand bg-brand-dim p-3 text-sm text-brand">
                  Selected piece: {PIECE_PALETTE.find((piece) => piece.value === selectedPiece)?.label || selectedPiece}. Click a square or drop it onto the board to place it.
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <Label htmlFor="editorFen" className="text-sm font-medium text-text-secondary">
                Load a FEN string
              </Label>
              <Textarea
                id="editorFen"
                value={fenInput}
                onChange={(event) => setFenInput(event.target.value)}
                placeholder="Enter FEN or use current position from the board above"
                rows={3}
                className="mt-2"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={handleSetFen} className="font-semibold">
                  Load FEN
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFenInput(chessRef.current.fen())} className="font-semibold">
                  Use current board FEN
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-hair bg-surface-1 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-text-secondary uppercase tracking-[0.2em]">Analysis</p>
                <h2 className="text-lg font-semibold">Stockfish suggestions</h2>
              </div>
              <Button size="sm" onClick={handleAnalyzePosition} className="font-semibold" disabled={analysisLoading}>
                <Zap className="w-4 h-4 mr-2" /> {analysisLoading ? "Analyzing…" : "Analyze"}
              </Button>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Use the board editor to set up any position, then request the best moves and evaluation.
            </p>

            <div className="grid gap-3">
              {analysisError && (
                <div className="rounded-2xl bg-danger-dim border border-danger p-3 text-sm text-danger">
                  {analysisError}
                </div>
              )}

              {analysis ? (
                <div className="rounded-2xl bg-white border border-hair p-4 text-sm text-text-primary">
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Best move</p>
                    <p className="text-2xl font-semibold mt-1">{analysis.move || "N/A"}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span>Depth</span>
                      <span>{analysis.depth ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Evaluation</span>
                      <span>
                        {analysis.evaluation?.type === "cp"
                          ? `${analysis.evaluation.value / 100 >= 0 ? "+" : ""}${(analysis.evaluation.value / 100).toFixed(2)}`
                          : analysis.evaluation?.type === "mate"
                          ? `Mate ${analysis.evaluation.value}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Top moves</span>
                      <span>{Array.isArray(analysis.top_moves) ? analysis.top_moves.length : 0}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-surface-2 border border-dashed border-hair p-4 text-sm text-text-secondary">
                  No analysis yet. Set up the board and tap Analyze.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-hair bg-surface-1 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-text-secondary uppercase tracking-[0.2em]">Position</p>
                <h2 className="text-lg font-semibold">Current FEN</h2>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyFen} className="font-semibold">
                <Copy className="w-4 h-4 mr-2" /> Copy
              </Button>
            </div>
            <Textarea value={boardPosition} readOnly rows={4} className="text-xs" />
            <p className="mt-3 text-xs text-text-secondary">
              Right-click a square to remove the piece. Use the piece palette to place pieces and drag to move them.
            </p>
          </div>

          {analysis && Array.isArray(analysis.top_moves) && analysis.top_moves.length > 0 && (
            <div className="rounded-2xl border border-hair bg-surface-1 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary uppercase tracking-[0.2em]">Top moves</p>
                  <h2 className="text-lg font-semibold">Next options</h2>
                </div>
                <Layers className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="grid gap-2">
                {analysis.top_moves.slice(0, 5).map((move, index) => (
                  <div key={`${move.move || move}-${index}`} className="rounded-xl border border-hair bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{index + 1}. {move.move || move}</span>
                      <span className="text-xs text-text-secondary">
                        {move.evaluation || move.score || move.Eval || "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
