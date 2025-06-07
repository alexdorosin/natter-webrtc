export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T | null;

  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }

  return element;
}

export function addLocalTracksToPC(
  pc: RTCPeerConnection | null,
  localStream: MediaStream | null
): void {
  if (!pc || !localStream) return;

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });
}

export function setupPeerConnectionListeners(
  pc: RTCPeerConnection | null,
  remoteStream: MediaStream | null
): void {
  if (!pc || !remoteStream) return;

  pc.ontrack = (event) => {
    event.streams[0]
      .getTracks()
      .forEach((track) => remoteStream.addTrack(track));
  };
}
