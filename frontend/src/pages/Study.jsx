import React, { useMemo, useState } from "react";
import studies from "@/utils/studies";
import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";

function getYoutubeId(url) {
  if (!url) return null;

  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();

    if (hostname.includes("youtube.com")) {
      const pathname = u.pathname.toLowerCase();
      if (pathname === "/results" || pathname.startsWith("/results/")) return null;

      const videoId = u.searchParams.get("v");
      if (videoId) return videoId;

      const segments = u.pathname.split("/").filter(Boolean);
      if (segments[0] === "shorts" && segments[1]) return segments[1];
      if (segments[0] === "embed" && segments[1]) return segments[1];
    }

    if (hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      return id || null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function isYoutubeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().includes("youtube.com") || u.hostname.toLowerCase() === "youtu.be";
  } catch (e) {
    return false;
  }
}

export default function Study() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => ["All", ...Array.from(new Set(studies.map((s) => s.category)))], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      if (category !== "All" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Study" subtitle="Learn openings, middlegame plans and endgame fundamentals." />

      <div className="mb-4">
        <input
          aria-label="Search studies"
          placeholder="Search openings, middlegame, endgame..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-3 rounded-lg border border-hair focus:outline-none"
        />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${category === c ? "bg-brand text-on-brand" : "bg-surface-2 text-ink-secondary"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 && <div className="text-ink-secondary">No studies found</div>}
        {filtered.map((s) => {
          const youtubeId = getYoutubeId(s.youtube_url);
          const isYoutube = isYoutubeUrl(s.youtube_url);
          return (
            <div key={s.id} className="p-4 rounded-lg border border-hair bg-surface-1 flex flex-col md:flex-row items-start justify-between gap-4">
              <div className="flex-1 flex gap-4">
                {youtubeId ? (
                  <div className="w-24 min-w-[96px] overflow-hidden rounded-lg border border-hair bg-surface-2">
                    <img
                      src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                      alt={s.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-24 min-w-[96px] h-16 rounded-lg border border-hair bg-surface-2 flex items-center justify-center text-[10px] text-ink-secondary uppercase tracking-wide">
                    {isYoutube ? "YouTube" : "Video"}
                  </div>
                )}
                <div>
                  <div className="text-sm text-ink-secondary mb-1">{s.category}</div>
                  <div className="font-semibold text-lg">{s.title}</div>
                  <div className="text-sm text-ink-secondary mt-2">{s.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/study/${s.id}`} className="px-3 py-2 rounded-md bg-brand text-on-brand inline-block">
                  Open
                </Link>
                {isYoutube && (
                  <a href={s.youtube_url} target="_blank" rel="noreferrer" className="text-brand text-sm">
                    Watch on YouTube
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
