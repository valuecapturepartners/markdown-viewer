import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/auth-context.jsx'
import GoogleAuth from './auth/GoogleAuth.jsx'
import Editor from './editor/Editor.jsx'
import CaptureScreen from './capture/CaptureScreen.jsx'

function AppInner() {
  const { accessToken } = useAuth()
  const [screen, setScreen] = useState('editor') // 'capture' | 'editor'

  if (!accessToken) return <GoogleAuth />

  if (screen === 'capture') {
    return (
      <CaptureScreen
        onOpenEditor={(mode) => setScreen('editor')}
      />
    )
  }

  return <Editor onOpenCapture={() => setScreen('capture')} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
