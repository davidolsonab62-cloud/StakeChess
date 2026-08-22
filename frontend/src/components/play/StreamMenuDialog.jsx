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
 *   GET  /api/stream/accounts             -> [{ platform, connected, username }]
 *   POST /api/stream/:platform/connect    -> { auth_url }  (OAuth-style connect)
 *   POST /api/stream/:platform/go-live    -> { stream_id } (starts the stream)
 *   GET  /api/stream/youtube/client-id    -> { client_id, scope }  (YouTube only, see below)
 *   POST /api/stream/youtube/connect-code -> { connected, username }  (YouTube only, see below)
 * Adjust the endpoint paths to match your actual backend if different.
 *
 * OAuth note (TikTok / Instagram / Facebook): connecting sends the browser
 * away to the provider (window.location.href = auth_url), so the SPA fully
 * unloads. The *provider's* redirect_uri is our backend's own callback route
 * (computed server-side - never send a frontend URL as redirect_uri, the
 * provider would hand the auth code to the SPA instead of to the backend).
 * What we DO send is `frontend_redirect`: where the backend should bounce
 * the browser back to once it's finished the token exchange. The backend
 * appends `?stream_connected=<platform>` or `?stream_error=<platform>` to
 * that URL, which the effect below picks up after the reload. On mobile,
 * this navigation is also what lets iOS/Android hand off to the installed
 * app automatically (Universal Links / App Links) - see the note below
 * PLATFORMS for why that doesn't extend to YouTube.
 *
 * OAuth note (YouTube): YouTube's auth_url is Google's generic web OAuth
 * endpoint, which has no app hand-off and (unlike the others) doesn't need
 * a full-page unload to work well. Instead this uses Google Identity
 * Services' popup code flow (google.accounts.oauth2.initCodeClient) so the
 * dialog stays open and the SPA never reloads: a Google-hosted popup opens,
 * and on success its `code` is POSTed to our own backend
 * (/stream/youtube/connect-code), which exchanges it server-side exactly
 * like the redirect callback does for the other platforms. This still does
 * NOT open the native YouTube/Google app - that's not available to
 * websites at all (Google reserves it for apps using their native SDKs) -
 * it's purely a smoother *browser* experience.
 */
const PLATFORMS = [
  { id: "tiktok", label: "TikTok", icon: Music2, color: "#FE2C55" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E1306C" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { id: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
];

// App hand-off on iOS/Android for TikTok, Facebook, and Instagram happens
// automatically at the OS level (Universal Links / App Links) as long as
// this is a real top-level navigation to the provider's own auth_url - no
// extra JS needed here. That only works because those auth_urls live on
// domains the apps register as theirs (www.tiktok.com,
// www.facebook.com, www.instagram.com - see server.py, which must use
// www.instagram.com and NOT the deprecated api.instagram.com for this to
// hold for Instagram).
//
// YouTube's auth_url is accounts.google.com/o/oauth2/v2/auth - Google's
// generic web OAuth endpoint. There is no universal-link or custom-scheme
// hand-off available for it; getting the native app to open for Google
// sign-in requires a platform-specific SDK (e.g. Android Credential
// Manager, iOS GoogleSignIn) with its own registered OAuth client, which is
// a different auth flow than "redirect to auth_url" and out of scope for a
// frontend fix. On this flow, YouTube will always open in the browser
// regardless of platform.
//
// Lazily loads Google Identity Services (needed only for the YouTube popup
// flow - TikTok/Facebook/Instagram never touch this). Safe to call multiple
// times; resolves immediately once the script has already loaded.
let gisLoadPromise = null;
function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null; // allow retrying on a later click
      reject(new Error("Couldn't load Google's sign-in script"));
    };
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// One real gotcha worth checking if hand-off still isn't happening for
// TikTok/Facebook/Instagram: in-app browsers (opening StakeChess from a
// link inside Instagram/TikTok/Facebook's own in-app webview, or from
// Twitter/X, etc.) deliberately suppress universal links to other apps.
// That's an environment issue, not something this redirect can work around
// - test in Safari/Chrome directly, or prompt the user to open in the
// system browser if you detect an in-app webview (navigator.userAgent
// matching FBAN/FBAV, Instagram, TikTok, etc).

export default function StreamMenuDialog({ open, onOpenChange, gameId = null }) {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState({}); // { [platform]: { connected, username } }
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [busyPlatform, setBusyPlatform] = useState(null);

  // Picks up the redirect back from the OAuth provider (via our backend's
  // callback route) after the full-page navigation away and back. Runs
  // regardless of `open` since the dialog may be closed/unmounted-from-view
  // at the moment the page reloads.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get("stream_connected");
    const erroredPlatform = params.get("stream_error");
    if (!connectedPlatform && !erroredPlatform) return;

    if (connectedPlatform) {
      const label = PLATFORMS.find((p) => p.id === connectedPlatform)?.label || connectedPlatform;
      toast.success(`${label} connected`);
      onOpenChange(true);
    } else if (erroredPlatform) {
      const label = PLATFORMS.find((p) => p.id === erroredPlatform)?.label || erroredPlatform;
      toast.error(`Unable to connect ${label}`);
      onOpenChange(true);
    }

    params.delete("stream_connected");
    params.delete("stream_error");
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", newUrl);
    // Reopening (above) flips `open` to true, which triggers the accounts
    // fetch below and picks up the freshly-connected platform.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // TikTok / Instagram / Facebook: unchanged full-page OAuth redirect.
  const handleConnect = async (platformId) => {
    setBusyPlatform(platformId);
    try {
      const res = await axios.post(
        `${API}/stream/${platformId}/connect`,
        // Where the backend should send the browser back to once OAuth
        // finishes - just the current page, so this dialog is what the
        // user sees again. This is NOT the provider's redirect_uri; the
        // backend computes that itself from its own public URL.
        { frontend_redirect: window.location.href },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.auth_url) {
        // Real top-level navigation, required for iOS/Android to intercept
        // this as a universal/app link where the provider supports it (see
        // the platform hand-off note near the top of the file).
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

  // YouTube: Google Identity Services popup flow - see the file header for
  // why this differs from the other three. Stays entirely within this
  // click handler; the dialog never closes or reloads.
  const handleYoutubeConnect = async () => {
    setBusyPlatform("youtube");
    try {
      await loadGoogleIdentityServices();

      const { data: clientConfig } = await axios.get(`${API}/stream/youtube/client-id`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const code = await new Promise((resolve, reject) => {
        const codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: clientConfig.client_id,
          scope: clientConfig.scope,
          ux_mode: "popup",
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.code);
            }
          },
          // Handles non-OAuth failures (blocked popup, user closed it) that
          // never reach `callback` above.
          error_callback: (err) => {
            reject(new Error(err?.type === "popup_closed" ? "popup_closed" : "Unable to open Google sign-in"));
          },
        });
        codeClient.requestCode();
      });

      // Hand the one-time code to our backend, which does the actual
      // token exchange server-side (needs the client secret - never
      // exposed here) and stores the connected account.
      const res = await axios.post(
        `${API}/stream/youtube/connect-code`,
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data?.username ? `Connected as ${res.data.username}` : "YouTube connected");
      setAccounts((prev) => ({
        ...prev,
        youtube: { ...prev.youtube, connected: true, username: res.data?.username },
      }));
    } catch (error) {
      // The user simply closing the popup isn't a real error - don't nag them.
      if (error?.message !== "popup_closed") {
        console.error("YouTube connect error", error);
        toast.error(error.response?.data?.detail || error?.message || "Unable to connect YouTube");
      }
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
                onClick={() =>
                  isConnected ? handleGoLive(id) : id === "youtube" ? handleYoutubeConnect() : handleConnect(id)
                }
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
