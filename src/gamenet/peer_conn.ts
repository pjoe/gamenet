/* eslint-disable @typescript-eslint/no-explicit-any */
const iceServers: RTCIceServer[] = [
  // {
  //   urls: "stun:stun.l.google.com:19302",
  // },
];

export interface Signaling {
  send(to: string, t: string, data: any): void;
}

export class PeerConn {
  public pc: RTCPeerConnection;
  public dc?: RTCDataChannel;
  public dcReliable?: RTCDataChannel;
  public onConnected?: (peerConn: PeerConn) => void;
  private incomingIceCandidates: RTCIceCandidate[] = [];

  constructor(
    private signaling: Signaling,
    public localId: string,
    public remoteId: string
  ) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.pc.onnegotiationneeded = (ev) =>
      console.log("onnegotiationneeded", ev);
    this.pc.onconnectionstatechange = () =>
      console.log("onconnectionstatechange", this.pc.connectionState);
    this.pc.ondatachannel = (ev) => {
      console.log("ondatachannel", ev);
      const dc = ev.channel;
      dc.onopen = this.onDcOpen;
      if (dc.label === "unreliable") {
        this.dc = dc;
      } else {
        this.dcReliable = dc;
      }
    };
    this.pc.onicecandidate = (ev) => {
      this.signaling.send(this.remoteId, "candidate", ev.candidate);
    };
  }

  public sendJSON(msg: any, options?: { reliable: boolean }) {
    if (options?.reliable) {
      this.dcReliable?.send(JSON.stringify(msg));
    } else {
      this.dc?.send(JSON.stringify(msg));
    }
  }

  public sendRaw(msg: ArrayBuffer, options?: { reliable: boolean }) {
    if (options?.reliable) {
      this.dcReliable?.send(msg);
    } else {
      this.dc?.send(msg);
    }
  }

  public close() {
    this.pc.close();
  }

  public async offer() {
    this.dcReliable = this.pc.createDataChannel("reliable", { ordered: true });
    this.dcReliable.onopen = this.onDcOpen;
    this.dc = this.pc.createDataChannel("unreliable", {
      ordered: false,
      maxRetransmits: 0,
    });
    this.dc.onopen = this.onDcOpen;
    const offer = await this.pc.createOffer();
    console.log("offer", offer);
    await this.pc.setLocalDescription(offer);
    this.signaling.send(this.remoteId, "offer", this.pc.localDescription);
  }
  public async incomingOffer(msg: any) {
    console.log("incomingOffer", msg);
    this.pc.setRemoteDescription(msg.data);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.signaling.send(this.remoteId, "answer", this.pc.localDescription);
  }
  public incomingAnswer(msg: any) {
    console.log("incomingAnswer", msg);
    this.pc.setRemoteDescription(msg.data);
    for (const candidate of this.incomingIceCandidates) {
      this.pc.addIceCandidate(candidate);
    }
    this.incomingIceCandidates = [];
  }
  public incomingCandidate(msg: any) {
    console.log("incomingCandidate", msg);
    if (this.pc.remoteDescription) {
      this.pc.addIceCandidate(msg.data);
    } else {
      this.incomingIceCandidates.push(msg.data);
    }
  }
  private onDcOpen = (ev: Event) => {
    const dc = ev.target as RTCDataChannel;
    console.log("dc.onopen", dc);
    if (
      this.dc &&
      this.dc.readyState === "open" &&
      this.dcReliable &&
      this.dcReliable.readyState === "open" &&
      this.onConnected
    ) {
      this.onConnected(this);
    }
  };
}
