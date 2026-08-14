import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useScrollReveal() {
  const location = useLocation();

  useEffect(() => {
    const autoAttach = () => {
      const selectors = [
        "main > *",
        ".sc-page",
        ".min-h-screen > *",
        ".sc-hero",
      ];
      const nodes = Array.from(
        document.querySelectorAll(selectors.join(", "))
      ).filter((el) => !el.classList.contains("sc-no-reveal"));
      nodes.forEach((el) => el.classList.add("sc-reveal"));
      return nodes;
    };

    const elements = autoAttach();
    if (elements.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      elements.forEach((el) => el.classList.add("sc-reveal-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sc-reveal-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [location.pathname]);
}
