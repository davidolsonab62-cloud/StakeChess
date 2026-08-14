import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/App";
import { ArrowLeft, Clock, Pause, Play, RotateCcw } from "lucide-react";

const DEFAULT_MINUTES = 5;

const formatCountdown = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function ChessClock() {
  useAuth();
  const navigate = useNavigate();
  const [whiteDuration, setWhiteDuration] = useState(DEFAULT_MINUTES);
  const [blackDuration, setBlackDuration] = useState(DEFAULT_MINUTES);
  const [whiteTimeRemaining, setWhiteTimeRemaining] = useState(DEFAULT_MINUTES * 60);
  const [blackTimeRemaining, setBlackTimeRemaining] = useState(DEFAULT_MINUTES * 60);
  const [activeClock, setActiveClock] = useState("white");
  const [clockRunning, setClockRunning] = useState(false);
  const [clockWinner, setClockWinner] = useState(null);
  const intervalRef = useRef(null);

  const resetClock = useCallback(() => {
    setClockRunning(false);
    setWhiteTimeRemaining(whiteDuration * 60);
    setBlackTimeRemaining(blackDuration * 60);
    setClockWinner(null);
    setActiveClock("white");
  }, [whiteDuration, blackDuration]);

  const startPauseClock = useCallback(() => {
    if (clockWinner) return;
    setClockRunning((prev) => !prev);
  }, [clockWinner]);

  const handleTimeClick = useCallback(
    (side) => {
      if (clockWinner) return;
      setActiveClock(side);
    },
    [clockWinner]
  );

  useEffect(() => {
    if (!clockRunning || clockWinner) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setWhiteTimeRemaining((prev) => {
        if (activeClock !== "white" || clockWinner) return prev;
        if (prev <= 1) {
          setClockWinner("black");
          setClockRunning(false);
          return 0;
        }
        return prev - 1;
      });

      setBlackTimeRemaining((prev) => {
        if (activeClock !== "black" || clockWinner) return prev;
        if (prev <= 1) {
          setClockWinner("white");
          setClockRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [clockRunning, activeClock, clockWinner]);

  useEffect(() => {
    setWhiteTimeRemaining(whiteDuration * 60);
  }, [whiteDuration]);

  useEffect(() => {
    setBlackTimeRemaining(blackDuration * 60);
  }, [blackDuration]);

  return (
    <div className="sc-page max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)" }}>
            Chess clock
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Tap your time to switch the active side. Reset and start/pause from here.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="rounded-2xl border border-hair bg-surface-1 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-text-secondary uppercase tracking-[0.2em]">Live clock</p>
              <h2 className="text-lg font-semibold">Tap a side to switch</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-hair bg-surface-2 px-3 py-1 text-xs text-text-secondary">
              <Clock className="w-4 h-4" /> Active: {activeClock === "white" ? "White" : "Black"}
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => handleTimeClick("white")}
              className={`rounded-3xl border p-4 text-left transition ${activeClock === "white" ? "border-brand bg-brand-dim" : "border-hair bg-surface-2"}`}
              style={{ width: "100%" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">White</p>
                  <p className="text-4xl font-semibold mt-2">{formatCountdown(whiteTimeRemaining)}</p>
                </div>
                <span className="text-sm text-text-secondary">{whiteDuration} min</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTimeClick("black")}
              className={`rounded-3xl border p-4 text-left transition ${activeClock === "black" ? "border-brand bg-brand-dim" : "border-hair bg-surface-2"}`}
              style={{ width: "100%" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">Black</p>
                  <p className="text-4xl font-semibold mt-2">{formatCountdown(blackTimeRemaining)}</p>
                </div>
                <span className="text-sm text-text-secondary">{blackDuration} min</span>
              </div>
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="rounded-2xl bg-surface-2 p-3 text-sm text-text-secondary">
                White minutes
                <Input
                  type="number"
                  min="1"
                  value={whiteDuration}
                  onChange={(event) => setWhiteDuration(Math.max(1, Number(event.target.value)))}
                  className="mt-2 bg-transparent"
                />
              </label>
              <label className="rounded-2xl bg-surface-2 p-3 text-sm text-text-secondary">
                Black minutes
                <Input
                  type="number"
                  min="1"
                  value={blackDuration}
                  onChange={(event) => setBlackDuration(Math.max(1, Number(event.target.value)))}
                  className="mt-2 bg-transparent"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={startPauseClock} className="font-semibold">
                {clockRunning ? (
                  <><Pause className="w-4 h-4 mr-2" /> Pause</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Start</>
                )}
              </Button>
              <Button variant="outline" onClick={resetClock} className="font-semibold">
                <RotateCcw className="w-4 h-4 mr-2" /> Reset
              </Button>
            </div>
            {clockWinner && (
              <div className="rounded-2xl bg-danger-dim border border-danger p-3 text-sm text-danger">
                Time expired for {clockWinner === "white" ? "White" : "Black"}. {clockWinner === "white" ? "Black" : "White"} wins.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-hair bg-surface-1 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-text-secondary uppercase tracking-[0.2em]">Tips</p>
              <h2 className="text-lg font-semibold">How to use</h2>
            </div>
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="grid gap-3 text-sm text-text-secondary">
            <p>Tap the time on your side to switch the active clock. The player whose time is active is the one that ticks down.</p>
            <p>Use the duration controls to set the starting time before beginning.</p>
            <p>Pause anytime to stop both clocks.</p>
            <p>Reset restores both clocks to the selected durations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
