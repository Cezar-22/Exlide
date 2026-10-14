import { createFileRoute } from "@tanstack/react-router";
import { Play, Info, Settings } from "lucide-react";
import logo from "@/assets/exlide-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exlide — Real-time voice interactive presentations" },
      { name: "description", content: "Exlide turns your voice into a live presentation that follows you as you speak." },
      { property: "og:title", content: "Exlide — Voice interactive presentations" },
      { property: "og:description", content: "A presentation that follows you as you speak." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="grid-bg relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="fade-up flex flex-col items-center text-center">
        <h1 className="sr-only">Exlide</h1>
        <img src={logo} alt="Exlide logo" width={816} height={816} className="-my-8 h-72 w-72 sm:h-80 sm:w-80" />
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          Speak. Your slides follow.
        </p>
        <div className="wave mt-5 flex h-6 items-center gap-1" aria-hidden>
          <span /><span /><span /><span /><span />
        </div>

        <button id="start-btn" className="btn btn-primary mt-10">
          <Play className="h-5 w-5" fill="currentColor" /> Start
        </button>
        <div className="mt-4 flex gap-3">
          <button id="info-btn" className="btn btn-ghost">
            <Info className="h-4 w-4" /> Info
          </button>
          <button id="settings-btn" className="btn btn-ghost">
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>
      </div>
      <footer className="absolute bottom-6 text-xs text-muted-foreground">v0.1 · Exlide</footer>
    </main>
  );
}
