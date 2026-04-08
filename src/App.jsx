import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/auth-context.jsx";
import GoogleAuth from "./auth/GoogleAuth.jsx";
import Editor from "./editor/Editor.jsx";
import CaptureScreen from "./capture/CaptureScreen.jsx";
import KanbanScreen from "./kanban/KanbanScreen.jsx";

function AppInner() {
  const { accessToken } = useAuth();
  const [screen, setScreen] = useState("editor"); // 'capture' | 'editor' | 'kanban'

  if (!accessToken) return <GoogleAuth />;

  if (screen === "capture") {
    return (
      <CaptureScreen
        onOpenEditor={(mode) => setScreen("editor")}
        onOpenKanban={() => setScreen("kanban")}
      />
    );
  }

  if (screen === "kanban") {
    return (
      <KanbanScreen
        onOpenEditor={() => setScreen("editor")}
        onOpenCapture={() => setScreen("capture")}
      />
    );
  }

  return (
    <Editor
      onOpenCapture={() => setScreen("capture")}
      onOpenKanban={() => setScreen("kanban")}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
