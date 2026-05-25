// כפתור הסוכן הצף — מופיע על כל מסך מוגן (ProtectedLayout).
// לחיצה פותחת את AgentChatPanel.
//
// מיקום: TOP-CENTER — באמצע ה-sticky header, בין הלוגו (visual left) לאייברו
// השם של הדף (visual right). מתחת ל-safe-area-top.

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AgentChatPanel } from "./AgentChatPanel";

export function AgentButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="פתח את השקנאי הרשמי"
        onClick={() => setIsOpen(true)}
        className="fixed left-1/2 z-50 -translate-x-1/2 overflow-hidden rounded-full no-tap transition-transform hover:scale-105"
        style={{
          top: "calc(max(8px, env(safe-area-inset-top)) + 6px)",
          width: 32,
          height: 32,
          boxShadow: "0 0 0 1.5px rgba(255,217,61,0.55), 0 2px 8px -2px rgba(0,0,0,0.4)",
        }}
      >
        <img
          src="/img/pelican.jpg"
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </button>

      <AnimatePresence>
        {isOpen && <AgentChatPanel onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
