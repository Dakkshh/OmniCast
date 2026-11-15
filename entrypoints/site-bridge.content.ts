
export default defineContentScript({
  matches: [
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],

  main() {
    // ==========================================
    // 1. RECEIVE COMMANDS FROM STUDY BUDDY
    // ==========================================

    window.addEventListener("message", async (event) => {
      // Accept messages only from this webpage.
      if (
        event.source !== window ||
        event.origin !== window.location.origin
      ) {
        return;
      }

      const msg = event.data;

      if (msg?.source !== "study-buddy-web") {
        return;
      }

      // Check whether the extension is connected.
      if (msg.type === "PING") {
        window.postMessage(
          {
            source: "study-buddy-extension",
            type: "PONG",
          },
          window.location.origin
        );

        return;
      }

      // Only process valid study commands.
      if (
        msg.type !== "STUDY_COMMAND" ||
        typeof msg.requestId !== "string"
      ) {
        return;
      }

      try {
        const saved = await browser.storage.local.get([
          "currentIndex",
          "finished",
          "paused",
          "endsAt",
          "pausedLeft",
        ]);

        let changes: Record<string, unknown> = {};

        switch (msg.action) {
          // ==================================
          // START STUDY SESSION
          // ==================================

          case "START": {
            const minutes = Number(msg.minutes);

            if (
              !Number.isInteger(minutes) ||
              minutes < 1 ||
              minutes > 240
            ) {
              throw new Error("Invalid study duration");
            }

            const task = String(
              msg.task || "Study session"
            )
              .trim()
              .slice(0, 200);

            changes = {
              tasks: [
                {
                  task,
                  minutes,
                },
              ],
              currentIndex: 0,
              finished: false,
              paused: false,
              endsAt: Date.now() + minutes * 60000,
              pausedLeft: minutes * 60000,
            };

            break;
          }

          // ==================================
          // PAUSE STUDY SESSION
          // ==================================

          case "PAUSE": {
            changes = {
              paused: true,
              pausedLeft: Math.max(
                0,
                Number(saved.endsAt || 0) - Date.now()
              ),
            };

            break;
          }

          // ==================================
          // RESUME STUDY SESSION
          // ==================================

          case "RESUME": {
            changes = {
              paused: false,
              endsAt:
                Date.now() +
                Number(saved.pausedLeft || 0),
            };

            break;
          }

          // ==================================
          // STOP STUDY SESSION
          // ==================================

          case "STOP": {
            changes = {
              finished: true,
              paused: false,
              pausedLeft: 0,
            };

            break;
          }

          default:
            throw new Error("Unknown study command");
        }

        // Update shared extension storage.
        await browser.storage.local.set(changes);

        console.log(
          "[Study Buddy] Command received:",
          msg.action
        );

        // Confirm success to the website.
        window.postMessage(
          {
            source: "study-buddy-extension",
            type: "STUDY_COMMAND_RESULT",
            requestId: msg.requestId,
            ok: true,
          },
          window.location.origin
        );
      } catch (error) {
        console.error(
          "[Study Buddy] Command error:",
          error
        );

        window.postMessage(
          {
            source: "study-buddy-extension",
            type: "STUDY_COMMAND_RESULT",
            requestId: msg.requestId,
            ok: false,
            error: String(error),
          },
          window.location.origin
        );
      }
    });

    // ==========================================
    // 2. LISTEN FOR AI FOCUS CLASSIFICATIONS
    // ==========================================

    browser.storage.onChanged.addListener(
      (changes, area) => {
        if (area !== "local") {
          return;
        }

        const focusEvent =
          changes.studyBuddyFocusEvent?.newValue;

        // Ignore missing or invalid AI results.
        if (
          typeof focusEvent?.id !== "string" ||
          typeof focusEvent?.focused !== "boolean"
        ) {
          return;
        }

        const status = focusEvent.focused
          ? "Focused"
          : "Distracted";

        console.log(
          "[Study Buddy] AI classification:",
          status
        );

        // ======================================
        // 3. SEND AI RESULTS TO THE WEBSITE
        // ======================================

        window.postMessage(
          {
            source: "study-buddy-extension",
            type: "FOCUS_RESULT",

            result: {
              id: focusEvent.id,
              focused: focusEvent.focused,
              nudge: focusEvent.nudge || "",
              task: focusEvent.task || "",
              timestamp: focusEvent.timestamp,
            },
          },
          window.location.origin
        );
      }
    );
  },
});
