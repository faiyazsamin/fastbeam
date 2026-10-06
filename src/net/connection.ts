/** Describe the live ICE path of a peer connection from getStats(): local vs internet, and the far address. */

export interface ConnectionInfo {
  /** 'local' = both ends host candidates, 'internet' = a reflexive candidate on either side. */
  path: 'local' | 'internet' | 'unknown'
  remoteAddress: string | null
  remoteType: string | null
  protocol: string | null
  /** Round-trip time in ms when the browser reports it. */
  rttMs: number | null
}

interface PairStats {
  type: string
  id: string
  state?: string
  nominated?: boolean
  selected?: boolean
  localCandidateId?: string
  remoteCandidateId?: string
  currentRoundTripTime?: number
}
interface CandidateStats {
  type: string
  id: string
  candidateType?: string
  address?: string
  ip?: string
  protocol?: string
}
interface TransportStats {
  type: string
  selectedCandidatePairId?: string
}

export async function describeConnection(pc: RTCPeerConnection): Promise<ConnectionInfo> {
  const none: ConnectionInfo = { path: 'unknown', remoteAddress: null, remoteType: null, protocol: null, rttMs: null }
  let report: RTCStatsReport
  try {
    report = await pc.getStats()
  } catch {
    return none
  }
  const all = [...report.values()] as (PairStats & CandidateStats & TransportStats)[]
  const transport = all.find((s) => s.type === 'transport' && s.selectedCandidatePairId)
  let pair = transport ? (all.find((s) => s.id === transport.selectedCandidatePairId) as PairStats | undefined) : undefined
  pair ??= all.find((s) => s.type === 'candidate-pair' && (s.selected || (s.nominated && s.state === 'succeeded'))) as
    | PairStats
    | undefined
  if (!pair) return none
  const local = all.find((s) => s.id === pair.localCandidateId) as CandidateStats | undefined
  const remote = all.find((s) => s.id === pair.remoteCandidateId) as CandidateStats | undefined
  const lt = local?.candidateType ?? null
  const rt = remote?.candidateType ?? null
  const path: ConnectionInfo['path'] =
    lt && rt ? (lt === 'host' && rt === 'host' ? 'local' : 'internet') : 'unknown'
  return {
    path,
    remoteAddress: remote?.address ?? remote?.ip ?? null,
    remoteType: rt,
    protocol: remote?.protocol ?? local?.protocol ?? null,
    rttMs: typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : null,
  }
}
