import { useEffect } from 'preact/hooks'
import { joining, sorry } from './net/pairing'
import { screen } from './state/router'
import { toast } from './state/toast'
import { sheet, textReceived } from './state/ui'
import { clearIncoming, clearOutgoing, incoming, outgoing } from './transfer/manager'
import { Console } from './ui/components/Console'
import { IncomingDialog } from './ui/components/IncomingDialog'
import { MediaViewer } from './ui/components/MediaViewer'
import { TextReceivedDialog } from './ui/components/TextReceivedDialog'
import { Toasts } from './ui/components/Toasts'
import { Home } from './ui/screens/Home'
import { Connecting, Password, Sorry } from './ui/screens/Pairing'
import { Settings } from './ui/screens/Settings'
import { Done, Progress } from './ui/screens/Transfer'
import { PairSheet } from './ui/sheets/PairSheet'
import { PeerSheet } from './ui/sheets/PeerSheet'
import { SendSheet } from './ui/sheets/SendSheet'

/** Turn terminal transfer states that have no screen of their own into toasts, then clear them. */
function useTransferToasts() {
  const o = outgoing.value?.snap.value
  const i = incoming.value?.snap.value
  useEffect(() => {
    if (!o) return
    const name = o.peerName
    const msg =
      o.state === 'declined'
        ? `${name} declined`
        : o.state === 'busy'
          ? `${name} is busy with another transfer`
          : o.state === 'timeout'
            ? `${name} didn’t answer`
            : o.state === 'cancelled'
              ? o.cancelledBy === 'receiver'
                ? `${name} cancelled`
                : 'Cancelled'
              : o.state === 'failed'
                ? `Transfer failed: ${o.error ?? 'connection lost'}`
                : o.state === 'done' && o.text !== null
                  ? `Text sent to ${name}`
                  : null
    if (msg) {
      toast(msg)
      clearOutgoing()
    }
  }, [o?.state])
  useEffect(() => {
    if (!i) return
    if (i.state === 'done' && i.text !== null) {
      textReceived.value = { from: i.peerName, fromId: i.peerId, text: i.text }
      clearIncoming()
      return
    }
    const msg =
      i.state === 'cancelled' && i.cancelledBy === 'sender'
        ? `${i.peerName} cancelled`
        : i.state === 'cancelled'
          ? 'Cancelled'
          : i.state === 'failed'
            ? `Transfer failed: ${i.error ?? 'connection lost'}`
            : i.state === 'declined'
              ? null
              : null
    if (msg) toast(msg)
    if (i.state === 'cancelled' || i.state === 'failed' || i.state === 'declined') clearIncoming()
  }, [i?.state])
}

function Screen() {
  if (sorry.value) return <Sorry />
  const j = joining.value
  if (j?.step === 'password') return <Password />
  if (j) return <Connecting />
  const o = outgoing.value?.snap.value
  if (o?.state === 'sending') return <Progress />
  if (o?.state === 'done' && o.text === null) return <Done />
  const i = incoming.value?.snap.value
  if (i?.state === 'receiving') return <Progress />
  if (i?.state === 'done' && i.text === null) return <Done />
  return screen.value === 'settings' ? <Settings /> : <Home />
}

export function App() {
  useTransferToasts()
  const s = sheet.value
  return (
    <>
      <Screen />
      {s?.kind === 'send' && <SendSheet key={s.peerId} peerId={s.peerId} tab={s.tab} />}
      {s?.kind === 'pair' && <PairSheet tab={s.tab} {...(s.prefill ? { prefill: s.prefill } : {})} />}
      {s?.kind === 'peer' && <PeerSheet key={s.peerId} peerId={s.peerId} />}
      <IncomingDialog />
      <TextReceivedDialog />
      <MediaViewer />
      <Console />
      <Toasts />
    </>
  )
}
