/**
 * RTCPeerConnection that does not panic on a brief ICE "disconnected".
 *
 * Trystero closes a peer after 5 s in the disconnected state. iOS Safari reports that state routinely
 * (Wi‑Fi power save, a locked screen, a short radio hiccup) and recovers on its own, so the 5 s rule turns
 * a blip into a full teardown plus a relay round-trip to find each other again. This subclass reports
 * "connected" to callers for up to DISCONNECT_MASK_MS while the real state is "disconnected"; the real
 * state is available on `realConnectionState` / `realIceConnectionState` for code that wants to act on it
 * (our PeerLink uses it to request an ICE restart and, eventually, to give up).
 */
import { DISCONNECT_MASK_MS } from '../config'

export class PatientPeerConnection extends RTCPeerConnection {
  private disconnectedSince = 0

  private masked<T extends string>(real: T): T {
    if (real !== 'disconnected') {
      this.disconnectedSince = 0
      return real
    }
    if (!this.disconnectedSince) this.disconnectedSince = Date.now()
    return Date.now() - this.disconnectedSince < DISCONNECT_MASK_MS ? ('connected' as T) : real
  }

  override get connectionState(): RTCPeerConnectionState {
    return this.masked(super.connectionState)
  }

  override get iceConnectionState(): RTCIceConnectionState {
    return this.masked(super.iceConnectionState)
  }

  get realConnectionState(): RTCPeerConnectionState {
    return super.connectionState
  }

  get realIceConnectionState(): RTCIceConnectionState {
    return super.iceConnectionState
  }
}

export function realStates(pc: RTCPeerConnection): { connection: RTCPeerConnectionState; ice: RTCIceConnectionState } {
  const p = pc as Partial<PatientPeerConnection>
  return {
    connection: p.realConnectionState ?? pc.connectionState,
    ice: p.realIceConnectionState ?? pc.iceConnectionState,
  }
}
