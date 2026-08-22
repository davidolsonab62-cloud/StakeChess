import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Containers whose *contents* should reveal piece by piece as the user
// scrolls, rather than the container itself revealing as one lump.
const CONTENT_SELECTORS = [
  "main > *",
  ".sc-page > *",
  ".min-h-screen > *",
  "section > *",
];

// A handful of whole blocks that are meant to reveal as a single unit
// (not decomposed into their children).
const BLOCK_SELECTORS = [".sc-hero"];

// An element marked .sc-reveal-stagger reveals its tagged .sc-reveal-item
// descendants one after another (heading, then subtext, then a CTA, say)
// once the group scrolls into view, instead of the whole group fading in
// as a single block. Items are found by document order, however deeply
// they're nested, so this doesn't depend on them being direct siblings.
const STAGGER_GROUP_SELECTOR = ".sc-reveal-stagger";
const STAGGER_ITEM_SELECTOR = ".sc-reveal-item";
const STAGGER_DELAY_STEP_MS = 90;
const STAGGER_MAX_ITEMS = 6;

function findStaggerGroups(root = document) {
  return Array.from(root.querySelectorAll(STAGGER_GROUP_SELECTOR)).filter(
    (el) => !el.classList.contains("sc-no-reveal")
  );
}

function findRevealTargets(root = document) {
  const matched = Array.from(
    new Set(
      root.querySelectorAll(
        [...CONTENT_SELECTORS, ...BLOCK_SELECTORS].join(", ")
      )
    )
  ).filter(
    (el) =>
      !el.classList.contains("sc-no-reveal") &&
      !el.classList.contains("sc-reveal-stagger") &&
      !el.closest(STAGGER_GROUP_SELECTOR)
  );

  // Prefer the most granular matched element: if a matched node contains
  // another matched node, drop the outer one so we reveal the actual
  // piece of content instead of a wrapper around it (and its contents)
  // fading in twice.
  return matched.filter(
    (el) => !matched.some((other) => other !== el && el.contains(other))
  );
}

export function useScrollReveal() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      findRevealTargets().forEach((el) => {
        el.classList.add("sc-reveal", "sc-reveal-visible");
      });
      findStaggerGroups().forEach((group) => {
        group.querySelectorAll(STAGGER_ITEM_SELECTOR).forEach((item) => {
          item.classList.add("sc-reveal", "sc-reveal-visible");
        });
      });
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

    const seenTargets = new WeakSet();
    const seenGroups = new WeakSet();

    const attachStaggerGroups = () => {
      findStaggerGroups().forEach((group) => {
        if (seenGroups.has(group)) return;
        seenGroups.add(group);

        const items = Array.from(
          group.querySelectorAll(STAGGER_ITEM_SELECTOR)
        ).slice(0, STAGGER_MAX_ITEMS);
        if (items.length === 0) return;

        items.forEach((item, i) => {
          item.classList.add("sc-reveal");
          item.style.transitionDelay = `${i * STAGGER_DELAY_STEP_MS}ms`;
        });

        // One trigger for the whole group: once it's in view, every
        // tagged item reveals together, staggered by the delay set above.
        const groupObserver = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                items.forEach((item) => item.classList.add("sc-reveal-visible"));
                obs.disconnect();
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
        );
        groupObserver.observe(group);
      });
    };

    const attach = () => {
      attachStaggerGroups();
      findRevealTargets().forEach((el) => {
        if (seenTargets.has(el)) return;
        seenTargets.add(el);
        el.classList.add("sc-reveal");
        observer.observe(el);
      });
    };

    // Initial pass for content that's already mounted.
    attach();

    // Route transitions (AnimatePresence's exit-before-enter, in
    // particular) can mount the new page's content a beat after this
    // effect runs — as can any async-loaded content (e.g. a page that
    // shows a loading skeleton first). Watch for it landing and attach
    // reveal to it too, instead of only catching whatever existed the
    // instant we fired. Scoped to #root (not document.body) so it
    // doesn't re-scan on every portaled dialog/toast/dropdown mutation
    // elsewhere in the app. Runs the attach synchronously in the
    // mutation callback (no requestAnimationFrame hop) so the reveal
    // classes land in the same paint as the new content, rather than
    // one frame after — otherwise the content briefly shows at full
    // opacity, then visibly vanishes before fading back in.
    const appRoot = document.getElementById("root") || document.body;
    const mutationObserver = new MutationObserver(attach);
    mutationObserver.observe(appRoot, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [location.pathname]);
}
