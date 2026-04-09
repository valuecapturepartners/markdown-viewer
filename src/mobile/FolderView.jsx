import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { listFolderContents, listSharedDrives } from '../drive/drive-api.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const PDF_MIME    = 'application/pdf'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function FolderView({ folder, title, onBack, onFolderPush, onFilePick, onNewFile }) {
  // folder: { id, name } or null for root
  const { accessToken } = useAuth()
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setItems(null)
    try {
      let result
      if (!folder) {
        const drives = await listSharedDrives(accessToken)
        result = [
          { id: 'root', name: 'My Drive', isFolder: true },
          ...drives.map(d => ({ id: d.id, name: d.name, isFolder: true })),
        ]
      } else {
        const contents = await listFolderContents(accessToken, folder.id)
        result = contents.map(item => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          isFolder: item.mimeType === FOLDER_MIME,
          isPdf: item.mimeType === PDF_MIME,
          modifiedTime: item.modifiedTime,
        }))
      }
      setItems(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [folder?.id, accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const folders = items?.filter(i => i.isFolder) ?? []
  const files   = items?.filter(i => !i.isFolder) ?? []

  return (
    <div className="folder-view">
      <header className="fv-header">
        {onBack
          ? <button className="fv-back" onClick={onBack}>←</button>
          : <span className="fv-back-placeholder" />
        }
        <span className="fv-title">{title || 'Files'}</span>
        <button className="fv-new-btn" onClick={onNewFile} title="New file here">+</button>
      </header>

      <div className="fv-list">
        {loading && <div className="fv-status">Loading…</div>}
        {error && (
          <div className="fv-status fv-error">
            {error}
            <button className="fv-retry" onClick={load}>Retry</button>
          </div>
        )}

        {folders.map(item => (
          <button
            key={item.id}
            className="fv-row fv-folder"
            onClick={() => onFolderPush({ id: item.id, name: item.name })}
          >
            <span className="fv-row-name">{item.name}</span>
            <span className="fv-chevron">›</span>
          </button>
        ))}

        {files.map(item => {
          if (item.isPdf) {
            return (
              <a
                key={item.id}
                className="fv-row fv-file fv-file-pdf"
                href={`https://drive.google.com/file/d/${item.id}/view`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="fv-row-name">{item.name.replace(/\.pdf$/i, '')}</span>
                <span className="fv-badge">PDF</span>
              </a>
            )
          }
          return (
            <button
              key={item.id}
              className="fv-row fv-file"
              onClick={() => onFilePick({ id: item.id, name: item.name })}
            >
              <span className="fv-row-name">{item.name.replace(/\.md$/i, '')}</span>
              <span className="fv-date">{formatDate(item.modifiedTime)}</span>
            </button>
          )
        })}

        {!loading && !error && folders.length === 0 && files.length === 0 && (
          <div className="fv-status">Empty</div>
        )}
      </div>
    </div>
  )
}
