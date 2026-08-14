import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import {
  ArrowLeft,
  Share2,
  MessageSquare,
  Zap,
  RefreshCw,
  Play,
  ChevronLeft,
  Rewind,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const DEFAULT_PGN_PLACEHOLDER = `[Event "My Game"]\n[White "Alice"]\n[Black "Bob"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6...`;

function encodePGNParam(value) {
  try {
    const encoded = btoa(unescape(encodeURIComponent(value)));
    return encodeURIComponent(encoded);
  } catch (error) {
    return encodeURIComponent(value);
  }
}

function decodePGNParam(value) {
  if (!value) {
    return "";
  }

  try {
    const decoded = decodeURIComponent(value);
    try {
      // Try base64 decode first
      const text = decodeURIComponent(escape(atob(decoded)));
      return text;
    } catch (err) {
      return decoded;
    }
  } catch (error) {
    try {
      return atob(value);
    } catch {
      return value;
    }
  }
}

function parsePGNHeaders(pgn) {
  const tags = {};
  const regex = /^\[(\w+)\s+"([^"]*)"\]$/gm;
  let match;
  while ((match = regex.exec(pgn)) !== null) {
    tags[match[1]] = match[2];
  }
  return tags;
}

export default function ImportPGN() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const encodedPGNParam = searchParams.get("pgn") || "";

  const [pgn, setPgn] = useState("");
  const [loadError, setLoadError] = useState("");
  const [parsed, setParsed] = useState(false);
  const [metadata, setMetadata] = useState({});
  const [moveHistory, setMoveHistory] = useState([]);
  const [positions, setPositions] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [position, setPosition] = useState("start");
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [shareUrl, setShareUrl] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [boardWidth, setBoardWidth] = useState(420);
  // Measures the board wrapper's actual content width so the replay board
  // never overflows narrow screens (it used to render at a fixed 420px).
  const boardWrapperRef = useRef(null);

  useEffect(() => {
    const node = boardWrapperRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setBoardWidth(Math.max(200, Math.floor(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chatKey = useMemo(() => {
    if (!pgn) return "import_pgn_chat_default";
    let hash = 0;
    for (let i = 0; i < pgn.length; i += 1) {
      hash = (hash + pgn.charCodeAt(i) * (i + 1)) % 1000000000;
    }
    return `import_pgn_chat_${hash}`;
  }, [pgn]);

  const handleParse = useCallback(
    (source, skipError = false) => {
      if (!source || !source.trim()) {
        setLoadError("PGN text is empty.");
        return false;
      }

      setLoadError("");
      setAnalysis(null);
      setAnalysisError(null);

      const chess = new Chess();

      try {
        if (typeof chess.loadPgn === "function") {
          chess.loadPgn(source);
        } else if (typeof chess.load_pgn === "function") {
          chess.load_pgn(source);
        } else {
          throw new Error("PGN parser not available");
        }
      } catch (error) {
        if (!skipError) {
          setLoadError("Unable to parse PGN. Check the format and try again.");
        }
        return false;
      }

      const sanitizedTags = parsePGNHeaders(source);
      const history = chess.history({ verbose: false });
      const replay = new Chess();
      const positionsList = [replay.fen()];

      history.forEach((move) => {
        replay.move(move);
        positionsList.push(replay.fen());
      });

      setMetadata({
        event: sanitizedTags.Event || "Imported Game",
        site: sanitizedTags.Site || "PGN",
        white: sanitizedTags.White || "White",
        black: sanitizedTags.Black || "Black",
        date: sanitizedTags.Date || "Unknown",
        result: sanitizedTags.Result || "*",
      });
      setMoveHistory(history);
      setPositions(positionsList);
      setCurrentMoveIndex(history.length - 1);
      setPosition(positionsList[positionsList.length - 1] || "start");
      setParsed(true);
      return true;
    },
    []
  );

  useEffect(() => {
    if (!encodedPGNParam) {
      return;
    }

    const decoded = decodePGNParam(encodedPGNParam);
    if (!decoded) {
      setLoadError("Unable to decode PGN from the shared URL.");
      return;
    }

    setPgn(decoded);
    handleParse(decoded, true);
  }, [encodedPGNParam, handleParse]);

  useEffect(() => {
    const raw = localStorage.getItem(chatKey);
    if (raw) {
      try {
        setChatMessages(JSON.parse(raw));
      } catch {
        setChatMessages([]);
      }
    } else {
      setChatMessages([]);
    }
  }, [chatKey]);

  useEffect(() => {
    localStorage.setItem(chatKey, JSON.stringify(chatMessages));
  }, [chatKey, chatMessages]);

  useEffect(() => {
    if (!parsed) {
      setShareUrl("");
      return;
    }
    const encoded = encodePGNParam(pgn);
    setShareUrl(`${window.location.origin}${window.location.pathname}?pgn=${encoded}`);
  }, [parsed, pgn]);

  const clearImport = useCallback(() => {
    setPgn("");
    setParsed(false);
    setLoadError("");
    setMetadata({});
    setMoveHistory([]);
    setPositions([]);
    setCurrentMoveIndex(-1);
    setPosition("start");
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

  const setPositionByIndex = useCallback(
    (index) => {
      const clamped = Math.max(-1, Math.min(index, moveHistory.length - 1));
      setCurrentMoveIndex(clamped);
      setPosition(positions[clamped + 1] || positions[0] || "start");
    },
    [moveHistory.length, positions]
  );

  const handleAnalyzePosition = async () => {
    if (!position || position === "start") {
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const response = await axios.post(`${API}/computer/move`, {
        fen: position,
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
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) {
      toast.error("No shareable game yet. Load a PGN first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard");
    } catch (error) {
      toast.error("Unable to copy link. Please copy it manually.");
    }
  };

  const handleSendMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        username: user?.username || "You",
        message: trimmed,
        timestamp: new Date().toISOString(),
      },
    ]);
    setChatInput("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/lobby")}
              className="inline-flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back to dashboard
            </Button>
            <h1 className="text-2xl font-bold">Import PGN</h1>
          </div>
          <p className="text-sm text-text-secondary max-w-2xl">
            Paste a PGN from your game or opening study to replay every move, analyze positions, chat with your session, and generate a shareable link.
          </p>
        </div>
        {parsed && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAnalyzePosition} disabled={analysisLoading} className="font-semibold">
              {analysisLoading ? "Analyzing…" : "Analyze current position"}
            </Button>
            <Button variant="outline" onClick={handleCopyShareLink} className="font-semibold">
              <Share2 className="w-4 h-4 mr-2" /> Copy share link
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">PGN Input</h2>
              <p className="text-sm text-text-secondary">Paste your PGN text here and click Load to start replaying.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>PGN Text</Label>
            <Textarea
              rows={10}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={DEFAULT_PGN_PLACEHOLDER}
            />
            {loadError && <p className="text-sm text-red-600">{loadError}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                className="font-semibold"
                onClick={() => {
                  const ok = handleParse(pgn);
                  if (!ok) return;
                  const encoded = encodePGNParam(pgn);
                  navigate(`/game/imported-pgn-${Date.now()}?review=true&pgn=${encoded}`);
                }}
              >
                Load PGN
              </Button>
              <Button variant="outline" onClick={clearImport}>
                Clear
              </Button>
              {shareUrl && (
                <Button variant="outline" onClick={handleCopyShareLink}>
                  <Share2 className="w-4 h-4 mr-2" /> Copy link
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Game Summary</h2>
            <div className="grid gap-3">
              <div className="text-sm text-text-secondary">Event: {metadata.event || "N/A"}</div>
              <div className="text-sm text-text-secondary">White: {metadata.white || "N/A"}</div>
              <div className="text-sm text-text-secondary">Black: {metadata.black || "N/A"}</div>
              <div className="text-sm text-text-secondary">Date: {metadata.date || "N/A"}</div>
              <div className="text-sm text-text-secondary">Result: {metadata.result || "N/A"}</div>
              <div className="text-sm text-text-secondary">Moves: {moveHistory.length}</div>
            </div>
          </div>

          {shareUrl && (
            <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold">Shareable URL</h2>
                <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                  Copy
                </Button>
              </div>
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
                style={{ background: "var(--surface-2)" }}
              />
            </div>
          )}
        </div>
      </div>

      {parsed && (
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Replay Board</h2>
                  <p className="text-sm text-text-secondary">Use the controls to step through the imported game.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPositionByIndex(-1)}>
                    <Rewind className="w-4 h-4 mr-2" /> Start
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPositionByIndex(currentMoveIndex - 1)} disabled={currentMoveIndex < 0}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPositionByIndex(currentMoveIndex + 1)} disabled={currentMoveIndex >= moveHistory.length - 1}>
                    Forward <Play className="w-4 h-4 ml-2" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPositionByIndex(moveHistory.length - 1)}>
                    End <RefreshCw className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-center">
                <div ref={boardWrapperRef} className="w-full max-w-[420px] rounded-xl border border-hair bg-surface-2 p-3 box-border">
                  <Chessboard
                    options={{
                      id: "ImportPgnReplayBoard",
                      position: position,
                      arePiecesDraggable: false,
                      boardWidth: boardWidth,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-hair bg-surface-2 p-4">
                <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
                  <span>Move {currentMoveIndex + 2} / {moveHistory.length + 1}</span>
                  <span>{position}</span>
                </div>
                <ScrollArea className="h-40">
                  <div className="grid gap-2 font-mono text-sm">
                    {moveHistory.map((move, index) => (
                      <button
                        key={`${move}-${index}`}
                        type="button"
                        onClick={() => setPositionByIndex(index)}
                        className={`w-full text-left rounded-lg p-2 transition ${index === currentMoveIndex ? "bg-brand text-white" : "bg-surface-2 text-text-primary hover:bg-surface-3"}`}
                      >
                        <span className="font-semibold">{Math.floor(index / 2) + 1}.</span> {move}
                      </button>
                    ))}
                    {moveHistory.length === 0 && (
                      <div className="text-text-secondary">No moves found in this PGN.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Position Analysis</h2>
                  <p className="text-sm text-text-secondary">Ask Stockfish for the best move on the current board.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleAnalyzePosition} disabled={analysisLoading}>
                  {analysisLoading ? "Analyzing…" : "Refresh"}
                </Button>
              </div>

              {analysisError && <p className="text-sm text-red-600 mb-3">{analysisError}</p>}

              {analysis ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-surface-2 p-3 border border-hair">
                      <p className="text-text-secondary text-xs uppercase tracking-[0.16em]">Best move</p>
                      <p className="text-lg font-semibold mt-2">{analysis.move || "N/A"}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-2 p-3 border border-hair">
                      <p className="text-text-secondary text-xs uppercase tracking-[0.16em]">Depth</p>
                      <p className="text-lg font-semibold mt-2">{analysis.depth ?? "N/A"}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-surface-2 p-3 border border-hair">
                    <p className="text-text-secondary text-xs uppercase tracking-[0.16em]">Evaluation</p>
                    <p className="text-lg font-semibold mt-2">
                      {analysis.evaluation?.type === "cp"
                        ? `${(analysis.evaluation.value / 100).toFixed(2)} `
                        : analysis.evaluation?.type === "mate"
                        ? `Mate ${analysis.evaluation.value}`
                        : "N/A"}
                    </p>
                  </div>

                  {Array.isArray(analysis.top_moves) && analysis.top_moves.length > 0 && (
                    <div className="rounded-2xl bg-surface-2 p-3 border border-hair">
                      <p className="text-text-secondary text-xs uppercase tracking-[0.16em] mb-2">Top candidate moves</p>
                      <div className="grid gap-2">
                        {analysis.top_moves.slice(0, 4).map((item, index) => (
                          <div key={index} className="flex items-center justify-between rounded-lg bg-surface-1 p-2 border border-hair">
                            <span>{item.move || item.Move || item.uci || "-"}</span>
                            <span className="text-text-secondary text-xs">
                              {item.Eval || item.score || item.evaluation || ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Analyze the current board to see the best engine suggestion and evaluation.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Session Chat</h2>
                  <p className="text-sm text-text-secondary">Messages are saved locally for this imported game session.</p>
                </div>
                <div className="rounded-full bg-surface-2 px-3 py-1 text-xs text-text-secondary">
                  {chatMessages.length} messages
                </div>
              </div>
              <ScrollArea className="h-72 rounded-2xl border border-hair bg-surface-2 p-3">
                <div className="space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="rounded-2xl bg-surface-1 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3 text-sm text-text-secondary mb-2">
                        <span className="font-semibold text-text-primary">{msg.username}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-text-primary whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <div className="text-text-secondary">Start the conversation by sending a message.</div>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-4 space-y-3">
                <Textarea
                  rows={3}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Write a chat note for this game..."
                />
                <Button onClick={handleSendMessage} className="w-full font-semibold">
                  <MessageSquare className="w-4 h-4 mr-2" /> Post message
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
