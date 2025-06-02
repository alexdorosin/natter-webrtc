import type { DocumentData } from "firebase/firestore";

export interface RTCSessionDescriptionData {
  sdp?: string;
  type: RTCSdpType;
}

export interface CallDocData extends DocumentData {
  offer?: RTCSessionDescriptionData;
  answer?: RTCSessionDescriptionData;
}

export interface CandidateData extends DocumentData {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}
