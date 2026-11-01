import React, { useRef, useState } from 'react'
import { suggestFromPhoto, LIBRARY } from '../../game/library'

// Free, client-side only. The photo is drawn to a canvas, analysed in the
// browser, and either matched to a CC0 catalogue entry or used directly as
// a jelly texture. No upload, no key, no paid vision API.
export default function PhotoUpload({ t, onUsePhoto, onClose }) {
  const [suggest, setSuggest] = useState(null)
  const [textureUrl, setTextureUrl] = useState(null)
  const canvasRef = useRef()
  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const c = canvasRef.current
      c.width = img.width; c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      setSuggest(suggestFromPhoto(c))
      setTextureUrl(url)
    }
    img.src = url
  }
  return (
    <div className="panel">
      <button className="close" onClick={onClose}>×</button>
      <h3>{t.photo}</h3>
      <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {suggest && (
        <div>
          <p>Match: {suggest.top.map((x) => `${x.name} (${x.family}, ${x.licence})`).join(' · ')}</p>
          <button onClick={() => onUsePhoto(textureUrl, suggest.top[0])}>Play as jelly photo</button>
        </div>
      )}
      <p className="small">Catalogue: {LIBRARY.length} CC0 entries (Kenney, Quaternius, KayKit). No photo leaves this device.</p>
    </div>
  )
}
