import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import * as ui from "./ui";
import { addLocalTracksToPC, setupPeerConnectionListeners } from "./utils";
import { firestore } from "./firebase";
import type { CallDocData } from "./types";

//  Without STUN servers, the connection would only work between two devices on the same network
const servers: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let unsubscribeListeners: Unsubscribe[] = [];
let isMuted = false;

// ======================================================================================
export async function setupWebcam(): Promise<void> {
  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    remoteStream = new MediaStream();

    ui.webcamVideo.srcObject = localStream;
    ui.remoteVideo.srcObject = remoteStream;

    ui.showWebcamFeed();
  } catch (error) {
    console.error(error);
    ui.displayError("Could not start webcam.");
    ui.resetUIForNewCall();
  }
}

// ======================================================================================
export async function createCall(): Promise<void> {
  if (!localStream) {
    return ui.displayError("Please start your webcam first.");
  }

  if (pc) {
    return ui.displayError("A call is already in progress");
  }

  ui.setCallInProgressUI();

  // --- Step 1: Setup RTCPeerConnection
  pc = new RTCPeerConnection(servers);
  addLocalTracksToPC(pc, localStream);
  setupPeerConnectionListeners(pc, remoteStream);

  // --- Step 2: Create call document in Firestore
  const callCollection = collection(firestore, "calls");
  const callDocRef = doc(callCollection);
  const offerCandidates = collection(callDocRef, "offerCandidates");
  const answerCandidates = collection(callDocRef, "answerCandidates");

  ui.setCallId(callDocRef.id);

  // --- Step 3: Collect ICE candidates and add to Firestore
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  // --- Step 4: Create an SDP Offer and set it as local description
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };
  await setDoc(callDocRef, { offer });

  // --- Step 5: Listen for the Answer from the other peer
  const unsubCallDoc = onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data() as CallDocData;

    if (!pc?.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc?.setRemoteDescription(answerDescription);
    }
  });

  // --- Step 6: Listen for ICE candidates from the answering peer
  const unsubAnswerCandidates = onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc?.addIceCandidate(candidate);
      }
    });
  });

  // Add the unsubscribe functions to our array for later cleanup
  unsubscribeListeners.push(unsubCallDoc, unsubAnswerCandidates);
}

// ======================================================================================
export async function answerCall(): Promise<void> {
  const callId = ui.getCallId();

  if (!callId) {
    return ui.displayError("Please enter a Call ID.");
  }

  if (!localStream) {
    return ui.displayError("Please start your webcam first.");
  }

  if (pc) {
    return ui.displayError("A call is already in progress");
  }

  ui.setCallInProgressUI();

  // --- Step 1: Setup RTCPeerConnection and add local tracks
  pc = new RTCPeerConnection(servers);
  addLocalTracksToPC(pc, localStream);
  setupPeerConnectionListeners(pc, remoteStream);

  // --- Step 2: Reference the call document in Firestore
  const callDocRef = doc(firestore, "calls", callId);
  const answerCandidates = collection(callDocRef, "answerCandidates");
  const offerCandidates = collection(callDocRef, "offerCandidates");

  // --- Step 3: Collect local ICE candidates and send to the caller
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  // --- Step 4: Get the caller's Offer and set it as remote description ---
  const callDocSnapshot = await getDoc(callDocRef);
  if (!callDocSnapshot.exists()) {
    return ui.displayError("Call ID not found.");
  }

  const offerDescription = (callDocSnapshot.data() as CallDocData).offer;
  if (!offerDescription) {
    return ui.displayError("Invalid call data.");
  }

  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  // --- Step 5: Create an SDP Answer and set it as local description ---
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
  };

  await updateDoc(callDocRef, { answer });

  // --- Step 6: Listen for ICE candidates from the calling peer ---
  const unsubOfferCandidates = onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc?.addIceCandidate(candidate);
      }
    });
  });

  // Add the unsubscribe function for later cleanup
  unsubscribeListeners.push(unsubOfferCandidates);
}

// ======================================================================================
export async function hangupCall(): Promise<void> {
  // --- Step 1: Clean up Firestore listeners
  unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
  unsubscribeListeners = [];

  // --- Step 2: Clean up the Firestore document
  const callId = ui.getCallId();

  if (callId) {
    const callDocRef = doc(firestore, "calls", callId);

    const offerCandidatesQuery = query(
      collection(callDocRef, "offerCandidates")
    );
    const answerCandidatesQuery = query(
      collection(callDocRef, "answerCandidates")
    );

    const batch = writeBatch(firestore);

    const offerCandidatesSnapshot = await getDocs(offerCandidatesQuery);
    offerCandidatesSnapshot.forEach((docSnap) => batch.delete(docSnap.ref));

    const answerCandidatesSnapshot = await getDocs(answerCandidatesQuery);
    answerCandidatesSnapshot.forEach((docSnap) => batch.delete(docSnap.ref));

    batch.delete(callDocRef);

    await batch.commit();
  }

  // --- Step 3: Close the PeerConnection
  if (pc) {
    pc.close();
    pc = null;
  }

  // --- Step 4: Stop all media tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
    remoteStream = null;
  }

  // --- Step 5: Reset the UI to its initial state ---
  ui.resetUIForNewCall();
}

// ======================================================================================
export function toggleMute() {
  if (!localStream) return;

  isMuted = !isMuted;

  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMuted;
  });

  console.log(`Microphone is now ${isMuted ? "muted" : "unmuted"}.`);

  return isMuted;
}
