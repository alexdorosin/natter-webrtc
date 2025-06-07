import { getElement } from "./utils";

export const webcamVideo = getElement<HTMLVideoElement>("webcamVideo");
export const remoteVideo = getElement<HTMLVideoElement>("remoteVideo");
export const callInput = getElement<HTMLInputElement>("callInput");

export const webcamButton = getElement<HTMLButtonElement>("webcamButton");
export const callButton = getElement<HTMLButtonElement>("callButton");
export const answerButton = getElement<HTMLButtonElement>("answerButton");
export const hangupButton = getElement<HTMLButtonElement>("hangupButton");
export const micButton = getElement<HTMLButtonElement>("micButton");

const webcamSetupGroup = getElement<HTMLDivElement>("webcam-setup-group");
const callManagementGroup = getElement<HTMLDivElement>("call-management-group");
const bottomActionBar = getElement<HTMLDivElement>("bottom-action-bar");

export function initializeUIState(): void {
  callButton.disabled = true;
  answerButton.disabled = true;
  hangupButton.disabled = true;
  webcamSetupGroup.style.display = "block";
  callManagementGroup.style.display = "none";
  bottomActionBar.style.display = "none";
  micButton.style.display = "none";
  console.log("Initial UI states set.");
}

export function showWebcamFeed(): void {
  webcamSetupGroup.style.display = "none";
  callManagementGroup.style.display = "block";
  bottomActionBar.style.display = "flex";
  callButton.disabled = false;
  answerButton.disabled = false;
  micButton.style.display = "inline-flex";
  console.log("UI updated for active webcam.");
}

export function resetUIForNewCall(): void {
  webcamVideo.srcObject = null;
  remoteVideo.srcObject = new MediaStream();

  webcamSetupGroup.style.display = "block";
  callManagementGroup.style.display = "none";
  bottomActionBar.style.display = "none";

  callButton.disabled = true;
  answerButton.disabled = true;
  hangupButton.disabled = true;
  callInput.value = "";
  console.log("UI reset for new call or after hangup.");
}

export function setCallInProgressUI(): void {
  callButton.disabled = true;
  answerButton.disabled = true;
  hangupButton.disabled = false;
}

export function setCallId(id: string): void {
  callInput.value = id;
}

export function getCallId(): string {
  return callInput.value.trim();
}

export function displayError(message: string): void {
  alert(message);
}

export function toggleMicIcon(muted: boolean) {
  const icon = micButton.querySelector(".material-icons");

  if (icon) {
    icon.textContent = muted ? "mic_off" : "mic";
    micButton.classList.toggle("active", !muted);
  }
}
