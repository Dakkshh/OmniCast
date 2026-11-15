
export function sendExtensionCommand(action, extra = {}) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();

    const timeout = setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      reject(new Error("Extension did not respond."));
    }, 5000);

    function handleResponse(event) {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== "study-buddy-extension" ||
        event.data?.type !== "STUDY_COMMAND_RESULT" ||
        event.data?.requestId !== requestId
      ) {
        return;
      }

      clearTimeout(timeout);
      window.removeEventListener("message", handleResponse);

      if (event.data.ok) {
        resolve(event.data);
      } else {
        reject(new Error(event.data.error || "Command failed."));
      }
    }

    window.addEventListener("message", handleResponse);

    window.postMessage(
      {
        source: "study-buddy-web",
        type: "STUDY_COMMAND",
        requestId,
        action,
        ...extra,
      },
      window.location.origin
    );
  });
}
