import QR from 'qrcode'
import { useEffect, useState } from 'preact/hooks'
import { Mark } from './Icons'

/** QR at error level H with the mark knocked out of the centre (≈ 4% of the area, well inside H's 30%). */
export function QrCode({ value, size = 196 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>('')
  useEffect(() => {
    let alive = true
    QR.toString(value, { type: 'svg', errorCorrectionLevel: 'H', margin: 0, color: { dark: '#0F1C1E', light: '#FFFFFF' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''))
    return () => {
      alive = false
    }
  }, [value])
  return (
    <div class="qr" style={{ width: size, height: size }} role="img" aria-label="QR code for the fastbeam pairing link">
      {/* The SVG is generated locally from our own URL, never from remote content. */}
      <div class="qr-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      <div class="qr-mark">
        <Mark size={32} spark={false} />
      </div>
    </div>
  )
}
