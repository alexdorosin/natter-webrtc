import "./style.css";

const VITE_DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

function initializeFullApplication() {
  Promise.all([import("./firebase"), import("./ui"), import("./webrtc")])
    .then(([, ui, webRTC]) => {
      console.log(
        "Authenticated or no password required. Initializing application modules..."
      );

      ui.initializeUIState();

      ui.webcamButton.onclick = async () => {
        console.log("main.ts: webcamButton clicked.");
        await webRTC.setupWebcam();
      };

      ui.callButton.onclick = async () => {
        console.log("main.ts: callButton clicked.");
        await webRTC.createCall();
      };

      ui.answerButton.onclick = async () => {
        console.log("main.ts: answerButton clicked.");
        await webRTC.answerCall();
      };

      ui.hangupButton.onclick = async () => {
        console.log("main.ts: hangupButton clicked.");
        await webRTC.hangupCall();
      };

      ui.micButton.onclick = () => {
        const muted = webRTC.toggleMute();
        ui.toggleMicIcon(!!muted);
      };

      console.log("main.ts: Event listeners attached. Application ready.");
    })
    .catch((error) => {
      console.error("Failed to load application modules:", error);
      document.body.innerHTML = `<h1>Application Load Error</h1>`;
    });
}

function attemptAuthentication() {
  if (VITE_DEMO_PASSWORD) {
    const enteredPassword = prompt(
      "Please enter the password to access this demo:"
    );

    if (enteredPassword === VITE_DEMO_PASSWORD) {
      initializeFullApplication();
    } else {
      alert("Incorrect password. Access denied.");
      document.body.innerHTML = "<h1>Access Denied</h1>";
    }
  } else {
    console.warn("No VITE_DEMO_PASSWORD set or it's empty.");
    initializeFullApplication();
  }
}

attemptAuthentication();
