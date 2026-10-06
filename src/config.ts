/** Constants shared by discovery, pairing and transfer. Bump APP_SALT / PROTOCOL on breaking wire changes. */

export const APP_SALT = 'fastbeam/v1'
export const APP_ID = 'fastbeam.app'
export const PROTOCOL = 1
export const CANONICAL_ORIGIN = 'https://fastbeam.app'

/** Exactly two STUN servers and no TURN: fastbeam never relays traffic. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

/** Leave undefined to use Trystero's default Nostr relay set; override here if relays misbehave. */
export const RELAY_URLS: string[] | undefined = undefined
export const RELAY_REDUNDANCY = 4

/** CORS-enabled public IP lookup used only when STUN yields no reflexive candidate (UDP blocked). */
export const IP_LOOKUP_URL = 'https://api64.ipify.org?format=json'

/** Pairing codes never use 0, O, 1, I or L. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

export const CHUNK_SIZE = 64 * 1024
export const CHUNK_HEADER = 5
export const BUFFER_HIGH = 4 * 1024 * 1024
export const BUFFER_LOW = 1 * 1024 * 1024
/** Bytes the sender may have in flight beyond the receiver's last acknowledged progress. */
export const SEND_WINDOW = 32 * 1024 * 1024
export const PROGRESS_EVERY = 1024 * 1024
export const TEXT_MAX = 64 * 1024

export const OFFER_TIMEOUT_MS = 60_000
export const PING_INTERVAL_MS = 5_000
export const PEER_TIMEOUT_MS = 15_000
export const STUN_PROBE_MS = 3_000
export const PAIR_TIMEOUT_MS = 20_000
export const PAIR_RETRY_MS = 10_000
export const CODE_TTL_MS = 10 * 60_000
export const STILL_LOOKING_MS = 8_000
export const REDISCOVER_HIDDEN_MS = 60_000

export const SHARED_NETWORK_PEERS = 12
export const BLOB_WARN_BYTES = 1024 * 1024 * 1024

export const AUTH_MIN_INTERVAL_MS = 2_000
export const AUTH_MAX_FAILURES = 5
export const PASSWORD_MIN = 4
