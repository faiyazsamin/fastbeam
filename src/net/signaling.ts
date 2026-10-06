import { joinRoom, type Room } from 'trystero/nostr'
import { APP_ID, ICE_SERVERS, RELAY_REDUNDANCY, RELAY_URLS } from '../config'

export interface RoomHandlers {
  onPeer(peerId: string, pc: RTCPeerConnection): void
  onPeerLeave(peerId: string): void
  onError?(error: string, peerId: string): void
}

export interface RoomHandle {
  readonly roomId: string
  /** Live peer connections by Trystero peer ID. */
  peers(): Record<string, RTCPeerConnection>
  leave(): Promise<void>
}

/** Signaling only finds peers and exchanges SDP; a self-hosted adapter can replace this later. */
export interface Signaling {
  join(roomId: string, handlers: RoomHandlers): RoomHandle
}

export const trysteroSignaling: Signaling = {
  join(roomId, handlers) {
    const room: Room = joinRoom(
      {
        appId: APP_ID,
        rtcConfig: { iceServers: ICE_SERVERS },
        relayConfig: RELAY_URLS ? { urls: RELAY_URLS, redundancy: RELAY_REDUNDANCY } : { redundancy: RELAY_REDUNDANCY },
      },
      roomId,
      {
        onJoinError: (d) => handlers.onError?.(d.error, d.peerId),
      },
    )
    room.onPeerJoin = (peerId) => {
      const pc = room.getPeers()[peerId]
      if (pc) handlers.onPeer(peerId, pc)
    }
    room.onPeerLeave = (peerId) => handlers.onPeerLeave(peerId)
    return {
      roomId,
      peers: () => room.getPeers(),
      leave: () => room.leave(),
    }
  },
}
