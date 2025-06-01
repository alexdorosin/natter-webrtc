import {
  doc,
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  getDoc,
  updateDoc,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { firestore } from "./firebase";
import type {
  RTCSessionDescriptionData,
  CallDocData,
  CandidateData,
} from "./types";
import * as ui from "./ui";

// WebRTC Server Configuration
const servers: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc: RTCPeerConnection = new RTCPeerConnection(servers);
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let unsubscribeListeners: Unsubscribe[] = [];

function initializeNewPeerConnection(): void {
  if (pc && pc.signalingState !== "closed") {
    pc.close();
  }
  pc = new RTCPeerConnection(servers);
  setupPeerConnectionListeners();
  console.log("New RTCPeerConnection initialized.");
}

function setupPeerConnectionListeners(): void {
  pc.ontrack = (event: RTCTrackEvent) => {
    console.log("pc.ontrack event triggered. Stream:", event.streams[0]);
    event.streams[0].getTracks().forEach((track) => {
      if (remoteStream) {
        console.log("Adding remote track to remoteStream:", track);
        remoteStream.addTrack(track);
      } else {
        console.warn("Remote stream not initialized when track received.");
      }
    });
  };
}

initializeNewPeerConnection();

export function cleanupFirestoreListeners(): void {
  unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
  unsubscribeListeners = [];
  console.log("Firestore listeners cleaned up.");
}

export async function setupWebcam(): Promise<void> {
  console.log("Attempting to setup webcam...");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    console.log("User media obtained.");
    remoteStream = new MediaStream();

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        if (pc.signalingState === "closed") {
          console.warn(
            "PeerConnection was closed, re-initializing before adding track."
          );
          initializeNewPeerConnection();
        }
        pc.addTrack(track, localStream!);
      });
      console.log("Local tracks added to PeerConnection.");
    }

    ui.webcamVideo.srcObject = localStream;
    ui.remoteVideo.srcObject = remoteStream;
    console.log("Streams assigned to video elements.");

    ui.showWebcamFeed();
  } catch (e) {
    console.error("Error in setupWebcam:", e);
    ui.displayError(
      "Could not start webcam. Please check permissions and try again."
    );
    ui.resetUIForNewCall();
  }
}

export async function createCall(): Promise<void> {
  console.log("createCall invoked.");
  if (!pc || !localStream) {
    ui.displayError("Webcam not started. Please start your webcam first.");
    console.warn("Call attempt without local stream or PeerConnection.");
    return;
  }

  ui.setCallInProgressUI();
  console.log("Creating call...");

  const callCollectionRef = collection(firestore, "calls");
  const callDocRef = doc(callCollectionRef);
  const offerCandidatesCollectionRef = collection(
    callDocRef,
    "offerCandidates"
  );
  const answerCandidatesCollectionRef = collection(
    callDocRef,
    "answerCandidates"
  );

  ui.setCallId(callDocRef.id);
  console.log(`Call ID: ${callDocRef.id}. Share this ID.`);

  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      console.log("Local ICE candidate (caller):", event.candidate.toJSON());
      addDoc(offerCandidatesCollectionRef, event.candidate.toJSON()).catch(
        (e) => console.error("Error adding offer candidate:", e)
      );
    }
  };

  try {
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    console.log("Local description (offer) set.");

    const offer: RTCSessionDescriptionData = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDocRef, { offer });
    console.log("Offer set in Firestore.");

    const unsubCallDoc = onSnapshot(
      callDocRef,
      (snapshot) => {
        const data = snapshot.data() as CallDocData | undefined;
        if (!pc.currentRemoteDescription && data?.answer) {
          console.log("Remote answer received:", data.answer);
          const answerDesc = new RTCSessionDescription(
            data.answer as RTCSessionDescriptionInit
          );
          pc.setRemoteDescription(answerDesc)
            .then(() =>
              console.log("Remote description (answer) set successfully.")
            )
            .catch((e) =>
              console.error("Error setting remote description from answer:", e)
            );
        }
      },
      (error) => console.error("Error in callDoc onSnapshot:", error)
    );
    unsubscribeListeners.push(unsubCallDoc);

    // Listen for answer ICE candidates
    const unsubAnswerCandidates = onSnapshot(
      answerCandidatesCollectionRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidateData = change.doc.data() as CandidateData;
            console.log(
              "New remote (answer) ICE candidate received:",
              candidateData
            );
            pc.addIceCandidate(new RTCIceCandidate(candidateData))
              .then(() =>
                console.log("Remote (answer) ICE candidate added successfully.")
              )
              .catch((e) =>
                console.error("Error adding ICE candidate from answer:", e)
              );
          }
        });
      },
      (error) => console.error("Error in answerCandidates onSnapshot:", error)
    );
    unsubscribeListeners.push(unsubAnswerCandidates);
    console.log(
      "Call creation process complete. Listening for answer and candidates."
    );
  } catch (error) {
    console.error("Error during call creation:", error);
    ui.displayError(
      `Error creating call: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    ui.callButton.disabled = false;
    ui.answerButton.disabled = false;
    ui.hangupButton.disabled = true;
  }
}

export async function answerCall(): Promise<void> {
  console.log("answerCall invoked.");
  const callId = ui.getCallId();
  if (!callId) {
    ui.displayError("Please enter a Call ID to answer.");
    return;
  }
  if (!pc || !localStream) {
    ui.displayError("Webcam not started. Please start your webcam first.");
    console.warn("Answer attempt without local stream or PeerConnection.");
    return;
  }

  ui.setCallInProgressUI();
  console.log(`Attempting to answer call ID: ${callId}`);

  const callDocRef = doc(firestore, "calls", callId);
  const answerCandidatesCollectionRef = collection(
    callDocRef,
    "answerCandidates"
  );
  const offerCandidatesCollectionRef = collection(
    callDocRef,
    "offerCandidates"
  );

  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      console.log("Local ICE candidate (answerer):", event.candidate.toJSON());
      addDoc(answerCandidatesCollectionRef, event.candidate.toJSON()).catch(
        (e) => console.error("Error adding answer candidate:", e)
      );
    }
  };

  try {
    const callDocSnapshot = await getDoc(callDocRef);
    if (!callDocSnapshot.exists()) {
      console.error("Call document not found for ID:", callId);
      ui.displayError("Call ID not found. Please check the ID and try again.");
      ui.answerButton.disabled = false;
      ui.callButton.disabled = false;
      return;
    }

    const callData = callDocSnapshot.data() as CallDocData | undefined;
    if (!callData || !callData.offer) {
      console.error("Offer not found in call document!");
      ui.displayError("Invalid call data: Offer missing.");
      ui.answerButton.disabled = false;
      ui.callButton.disabled = false;
      return;
    }

    console.log("Offer received for answering:", callData.offer);
    await pc.setRemoteDescription(
      new RTCSessionDescription(callData.offer as RTCSessionDescriptionInit)
    );
    console.log("Remote description (offer) set successfully for answerer.");

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    console.log("Local description (answer) created and set for answerer.");

    const answer: RTCSessionDescriptionData = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDocRef, { answer });
    console.log("Answer sent to Firestore.");

    // Listen for offer ICE candidates
    const unsubOfferCandidates = onSnapshot(
      offerCandidatesCollectionRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidateData = change.doc.data() as CandidateData;
            console.log(
              "New remote (offer) ICE candidate received by answerer:",
              candidateData
            );
            pc.addIceCandidate(new RTCIceCandidate(candidateData))
              .then(() =>
                console.log(
                  "Remote (offer) ICE candidate added successfully by answerer."
                )
              )
              .catch((e) =>
                console.error(
                  "Error adding ICE candidate from offer by answerer:",
                  e
                )
              );
          }
        });
      },
      (error) =>
        console.error(
          "Error in offerCandidates onSnapshot for answerer:",
          error
        )
    );
    unsubscribeListeners.push(unsubOfferCandidates);
    console.log(
      "Answering process complete. Listening for offerer's ICE candidates."
    );
  } catch (error) {
    console.error("Error during answer:", error);
    ui.displayError(
      `Error answering call: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    ui.answerButton.disabled = false;
    ui.callButton.disabled = false;
    ui.hangupButton.disabled = true;
  }
}

export async function hangupCall(): Promise<void> {
  console.log("hangupCall invoked. Hanging up call.");
  cleanupFirestoreListeners();

  if (pc) {
    pc.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
        // pc.removeTrack(sender); // Good practice, though closing pc handles this
      }
    });
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) receiver.track.stop();
    });
    if (pc.signalingState !== "closed") {
      pc.close();
      console.log("PeerConnection closed.");
    }
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    console.log("Local stream stopped.");
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
    remoteStream = null; // Explicitly nullify
    console.log("Remote stream stopped.");
  }

  // Re-initialize RTCPeerConnection for a potential new call
  initializeNewPeerConnection();
  // Ensure remoteStream is ready for the new pc's ontrack
  remoteStream = new MediaStream();
  ui.remoteVideo.srcObject = remoteStream;

  ui.resetUIForNewCall();
  console.log("Call ended and UI reset.");
}
