import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth, API } from "@/App";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Music2, Instagram, Facebook, Youtube, Check, Loader2 } from "lucide-react";

/**
 * Shared "Stream" dialog: lets the user connect a social account (or go live
 * if already connected) so their StakeChess match streams out to TikTok,
 * Instagram, Facebook, or YouTube. Mirrors PlayMenuDialog's shape so the
 * connect/go-live logic lives in one place and can be dropped in anywhere
 * (sidebar, Lobby header, etc).
 *
 * Expects the backend to expose:
 *   GET  /api/stream/accounts        -> [{ platform, connected, username }]
 *   POST /api/stream/:platform/connect -> { auth_url }  (OAuth-style connect)
 *   POST /api/stream/:platform/go-live -> { stream_id } (starts the stream)
 * Adjust the endpoint paths to match your actual backend if different.
 */
const PLATFORMS = [
  { id: "tiktok", label: "TikTok", icon: Music2, color: "#FE2C55" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E1306C" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { id: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
];

export default function StreamMenuDialog({ open, onOpenChange, gameId = null }) {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState({}); // { [platform]: { connected, username } }
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [busyPlatform, setBusyPlatform] = useState(null);

  useEffect(() => {
    if (!open) return;
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const res = await axios.get(`${API}/stream/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const byPlatform = {};
        (res.data || []).forEach((a) => {
          byPlatform[a.platform] = a;
        });
        setAccounts(byPlatform);
      } catch (error) {
        console.error("Failed to fetch stream accounts", error);
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, [open, token]);

  const handleConnect = async (platformId) => {
    setBusyPlatform(platformId);
    try {
      const res = await axios.post(
        `${API}/stream/${platformId}/connect`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.success(`${platformId} connected`);
        setAccounts((prev) => ({ ...prev, [platformId]: { ...prev[platformId], connected: true } }));
      }
    } catch (error) {
      console.error("Stream connect error", error);
      toast.error(error.response?.data?.detail || `Unable to connect ${platformId}`);
    } finally {
      setBusyPlatform(null);
    }
  };

  const handleGoLive = async (platformId) => {
    setBusyPlatform(platformId);
    try {
      await axios.post(
        `${API}/stream/${platformId}/go-live`,
        gameId ? { game_id: gameId } : {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Going live on ${PLATFORMS.find((p) => p.id === platformId)?.label}…`);
      onOpenChange(false);
    } catch (error) {
      console.error("Go live error", error);
      toast.error(error.response?.data?.detail || "Unable to start stream");
    } finally {
      setBusyPlatform(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        style={{ background: "var(--surface-1)", borderColor: "var(--hairline)", color: "var(--text-primary)" }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Stream</DialogTitle>
        </DialogHeader>
        <p className="text-sm -mt-1" style={{ color: "var(--text-secondary)" }}>
          Sync a social account to broadcast your StakeChess match live.
        </p>
        <div className="space-y-3 pt-2">
          {PLATFORMS.map(({ id, label, icon: Icon, color }) => {
            const account = accounts[id];
            const isConnected = !!account?.connected;
            const isBusy = busyPlatform === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => (isConnected ? handleGoLive(id) : handleConnect(id))}
                disabled={isBusy || loadingAccounts}
                className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-colors disabled:opacity-60"
                style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
                data-testid={`stream-${id}-btn`}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
                >
                  {isBusy ? (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
                  ) : (
                    <Icon className="w-5 h-5" style={{ color }} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[15px] flex items-center gap-2">
                    {label}
                    {isConnected && <Check className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {isConnected
                      ? account?.username
                        ? `Connected as ${account.username} — tap to go live`
                        : "Connected — tap to go live"
                      : `Sync your ${label} account to stream matches`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
