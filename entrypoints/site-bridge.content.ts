
export default defineContentScript({
  matches: [
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],

  main() {
    window.addEventListener("message", async (event) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin
      ) return;

      const msg = event.data;

      if (msg?.source !== "study-buddy-web") return;

      // Keep our working connection test.
      if (msg.type === "PING") {
        window.postMessage({
          source: "study-buddy-extension",
          type: "PONG",
        }, window.location.origin);
        return;
      }

      if (
        msg.type !== "STUDY_COMMAND" ||
        typeof msg.requestId !== "string"
      ) return;

      try {
        const saved = await browser.storage.local.get([
          "currentIndex",
          "finished",
          "paused",
          "endsAt",
          "pausedLeft",
        ]);

        let changes = {};

        switch (msg.action) {
          case "START": {
            const minutes = Number(msg.minutes);
            if (
              !Number.isInteger(minutes) ||
              minutes < 1 ||
              minutes > 240
            ) throw new Error("Invalid study duration");

            const task = String(msg.task || "Study session")
              .trim().slice(0, 200);

            changes = {
              tasks: [{ task, minutes }],
              currentIndex: 0,
              finished: false,
              paused: false,
              endsAt: Date.now() + minutes * 60000,
              pausedLeft: minutes * 60000,
            };
            break;
          }

          case "PAUSE":
            changes = {
              paused: true,
              pausedLeft: Math.max(
                0,
                Number(saved.endsAt || 0) - Date.now()
              ),
            };
            break;

          case "RESUME":
            changes = {
              paused: false,
              endsAt: Date.now() + Number(saved.pausedLeft || 0),
            };
            break;

          case "STOP":
            changes = {
              finished: true,
              paused: false,
            };
            break;

          default:
            throw new Error("Unknown study command");
        }

        await browser.storage.local.set(changes);

        window.postMessage({
          source: "study-buddy-extension",
          type: "STUDY_COMMAND_RESULT",
          requestId: msg.requestId,
          ok: true,
        }, window.location.origin);

      } catch (error) {
        window.postMessage({
          source: "study-buddy-extension",
          type: "STUDY_COMMAND_RESULT",
          requestId: msg.requestId,
          ok: false,
          error: String(error),
        }, window.location.origin);
      }
    });
  },
});
