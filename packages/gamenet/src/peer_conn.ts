/* eslint-disable @typescript-eslint/no-explicit-any */
//TODO: maybe use https://github.com/pradt2/always-online-stun
const iceServers: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

export interface Signaling {
  send(to: string, t: string, data: any): void;
}

export interface PeerConn {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  dcReliable?: RTCDataChannel;
  localId: string;
  remoteId: string;
  onConnected?: (peerConn: PeerConn) => void;
  sendJSON(msg: any, options?: { reliable: boolean }): void;
  sendRaw(msg: ArrayBuffer, options?: { reliable: boolean }): void;
  close(): void;
  offer(): Promise<void>;
  incomingOffer(msg: any): Promise<void>;
  incomingAnswer(msg: any): void;
  incomingCandidate(msg: any): void;
}

export function createPeerConn(
  signaling: Signaling,
  localId: string,
  remoteId: string
): PeerConn {
  const incomingIceCandidates: RTCIceCandidate[] = [];
  let didEmitConnected = false;

  const pc = new RTCPeerConnection({ iceServers });

  const onDcOpen = (ev: Event) => {
    const dc = ev.target as RTCDataChannel;
    console.log("dc.onopen", dc);
    if (
      !didEmitConnected &&
      peerConn.dc &&
      peerConn.dc.readyState === "open" &&
      peerConn.dcReliable &&
      peerConn.dcReliable.readyState === "open" &&
      peerConn.onConnected
    ) {
      didEmitConnected = true;
      peerConn.onConnected(peerConn);
    }
  };

  pc.onnegotiationneeded = (ev) => console.log("onnegotiationneeded", ev);
  pc.onconnectionstatechange = () =>
    console.log("onconnectionstatechange", pc.connectionState);
  pc.ondatachannel = (ev) => {
    console.log("ondatachannel", ev);
    const dc = ev.channel;
    dc.binaryType = "arraybuffer";
    dc.onopen = onDcOpen;
    if (dc.label === "unreliable") {
      peerConn.dc = dc;
    } else {
      peerConn.dcReliable = dc;
    }
  };
  pc.onicecandidate = (ev) => {
    signaling.send(remoteId, "candidate", ev.candidate);
  };

  const peerConn: PeerConn = {
    pc,
    dc: undefined,
    dcReliable: undefined,
    localId,
    remoteId,
    onConnected: undefined,

    sendJSON(msg: any, options?: { reliable: boolean }) {
      const channel = options?.reliable ? peerConn.dcReliable : peerConn.dc;
      if (channel?.readyState === "open") {
        channel.send(JSON.stringify(msg));
      }
    },

    sendRaw(msg: ArrayBuffer, options?: { reliable: boolean }) {
      const channel = options?.reliable ? peerConn.dcReliable : peerConn.dc;
      if (channel?.readyState === "open") {
        channel.send(msg);
      }
    },

    close() {
      pc.close();
    },

    async offer() {
      peerConn.dcReliable = pc.createDataChannel("reliable", {
        ordered: true,
      });
      peerConn.dcReliable.binaryType = "arraybuffer";
      peerConn.dcReliable.onopen = onDcOpen;
      peerConn.dc = pc.createDataChannel("unreliable", {
        ordered: false,
        maxRetransmits: 0,
      });
      peerConn.dc.binaryType = "arraybuffer";
      peerConn.dc.onopen = onDcOpen;
      const offer = await pc.createOffer();
      console.log("offer", offer);
      await pc.setLocalDescription(offer);
      signaling.send(remoteId, "offer", pc.localDescription);
    },

    async incomingOffer(msg: any) {
      console.log("incomingOffer", msg);
      pc.setRemoteDescription(msg.data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signaling.send(remoteId, "answer", pc.localDescription);
    },

    incomingAnswer(msg: any) {
      console.log("incomingAnswer", msg);
      pc.setRemoteDescription(msg.data);
      for (const candidate of incomingIceCandidates) {
        pc.addIceCandidate(candidate);
      }
      incomingIceCandidates.length = 0;
    },

    incomingCandidate(msg: any) {
      console.log("incomingCandidate", msg);
      if (pc.remoteDescription) {
        pc.addIceCandidate(msg.data);
      } else {
        incomingIceCandidates.push(msg.data);
      }
    },
  };

  return peerConn;
}
