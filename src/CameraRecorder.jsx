
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const CameraRecorder = forwardRef(function CameraRecorder(_props, ref) {
  const previewRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const aliveRef = useRef(true);

  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [recordings, setRecordings] = useState([]);

  function releaseStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
  }

  function finish() {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      setState("stopping");

      try {
        recorder.stop();
      } catch (err) {
        console.error("Could not stop recording:", err);
        releaseStream();
        setState("idle");
      }
    }
  }

  async function begin() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      const message =
        "Recording requires a supported browser on localhost or HTTPS.";

      setError(message);
      return { ok: false, message };
    }

    if (
      recorderRef.current &&
      recorderRef.current.state === "recording"
    ) {
      return { ok: true };
    }

    if (state === "starting" || state === "stopping") {
      return {
        ok: false,
        message: "The camera is busy. Please try again.",
      };
    }

    setError("");
    setState("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // React development mode may run cleanup and setup more than once.
      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop());

        return {
          ok: false,
          message: "Camera initialization was interrupted.",
        };
      }

      streamRef.current = stream;

      const supportedType = [
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(
        stream,
        supportedType ? { mimeType: supportedType } : undefined
      );

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error("Recording error:", event);
        setError("Recording was interrupted.");
        releaseStream();
        setState("idle");
      };

      recorder.onstop = () => {
        releaseStream();

        if (!aliveRef.current) return;

        const chunks = chunksRef.current;
        chunksRef.current = [];

        if (chunks.length > 0) {
          const mimeType = recorder.mimeType || "video/webm";

          const videoBlob = new Blob(chunks, {
            type: mimeType,
          });

          const videoUrl = URL.createObjectURL(videoBlob);

          const extension = mimeType.includes("mp4")
            ? "mp4"
            : "webm";

          const newRecording = {
            id: crypto.randomUUID(),
            url: videoUrl,
            ext: extension,
            created: new Date().toLocaleTimeString(),
          };

          setRecordings((previous) => [
            newRecording,
            ...previous,
          ]);

          setState("ready");
        } else {
          setState("idle");
          setError("No video data was captured.");
        }
      };

      recorder.start(1000);
      setState("recording");

      console.log("Study Buddy camera recording started.");

      return { ok: true };
    } catch (err) {
      console.error("Camera startup error:", err);

      releaseStream();
      setState("idle");

      let message = `Camera unavailable: ${
        err?.message || "Unknown error"
      }`;

      if (err?.name === "NotAllowedError") {
        message =
          "Camera permission denied. Allow access and try again.";
      } else if (err?.name === "NotReadableError") {
        message =
          "Camera is being used by another application. Close that application and try again.";
      } else if (err?.name === "NotFoundError") {
        message = "No camera was found on this device.";
      }

      setError(message);

      return { ok: false, message };
    }
  }

  // Methods controlled by the study timer in App.jsx
  useImperativeHandle(ref, () => ({
    start: begin,

    stop: finish,

    pause: () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.pause();
        setState("paused");
      }
    },

    resume: () => {
      if (recorderRef.current?.state === "paused") {
        recorderRef.current.resume();
        setState("recording");
      }
    },

    isPaused: () => recorderRef.current?.state === "paused",
  }));

  // Attach the live camera stream to the video preview.
  useEffect(() => {
    if (
      (state === "recording" || state === "paused") &&
      previewRef.current &&
      streamRef.current
    ) {
      const video = previewRef.current;

      video.srcObject = streamRef.current;
      video.muted = true;

      video.play().catch((err) => {
        console.error("Camera preview error:", err);
        setError(
          "Camera started, but the live preview could not play."
        );
      });
    }
  }, [state]);

  // FIX: Reset aliveRef when the effect initializes.
  // This handles React StrictMode in development.
  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;

      if (
        recorderRef.current &&
        recorderRef.current.state !== "inactive"
      ) {
        recorderRef.current.onstop = null;

        try {
          recorderRef.current.stop();
        } catch {
          // Ignore errors during cleanup.
        }
      }

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    };
  }, []);

  function removeVideo(id) {
    const recording = recordings.find((item) => item.id === id);

    if (recording) {
      URL.revokeObjectURL(recording.url);
    }

    setRecordings((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  return (
    <section
      className="sb-card sb-camera-card"
      aria-label="Camera recording"
    >
      <div className="sb-section-head">
        <div>
          <span className="sb-eyebrow">
            03 / LIVE RECORDING
          </span>
          <h3>Study camera</h3>
        </div>

        <span className="sb-chip">Timer synced</span>
      </div>

      <p className="sb-muted">
        Recording begins when you start the timer, pauses with
        it, and stops when it ends or you reset. Camera only;
        microphone off.
      </p>

      <div className="sb-camera-stage">
        {state === "recording" || state === "paused" ? (
          <video
            ref={previewRef}
            className="sb-camera-video sb-camera-live"
            muted
            autoPlay
            playsInline
            aria-label="Live camera preview"
          />
        ) : (
          <div className="sb-camera-placeholder">
            <div
              className="sb-camera-symbol"
              aria-hidden="true"
            >
              ◉
            </div>

            <strong>
              {state === "starting"
                ? "Connecting camera..."
                : state === "stopping"
                ? "Saving recording..."
                : "Camera ready when you are"}
            </strong>

            <span>Press Start on the focus timer.</span>
          </div>
        )}

        {state === "recording" && (
          <span className="sb-recording-indicator">
            <i aria-hidden="true" />
            LIVE · REC
          </span>
        )}

        {state === "paused" && (
          <span className="sb-recording-indicator">
            PAUSED
          </span>
        )}
      </div>

      {error && (
        <p className="sb-camera-error" role="alert">
          {error}
        </p>
      )}

      <div className="sb-recordings-heading">
        <strong>Review recordings</strong>
        <span>{recordings.length} available</span>
      </div>

      {recordings.length === 0 ? (
        <p className="sb-muted">
          Recordings will appear here after your timer ends
          or you press Reset.
        </p>
      ) : (
        <div className="sb-recording-list">
          {recordings.map((item) => (
            <div
              className="sb-recording-item"
              key={item.id}
            >
              <p className="sb-muted">
                Recorded at {item.created}
              </p>

              <video
                className="sb-camera-video sb-recorded-video"
                controls
                playsInline
                src={item.url}
                aria-label="Recorded study session"
              />

              <div className="sb-camera-actions">
                <a
                  className="sb-button sb-button-primary"
                  href={item.url}
                  download={`study-buddy-${item.id}.${item.ext}`}
                >
                  Download video
                </a>

                <button
                  type="button"
                  className="sb-button sb-button-outline"
                  onClick={() => removeVideo(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="sb-camera-privacy">
        🔒 Recordings stay in browser memory until the
        page refreshes or closes, or you delete them.
        Download a video to keep it permanently.
        Long recordings may use significant memory.
      </p>
    </section>
  );
});

export default CameraRecorder;
