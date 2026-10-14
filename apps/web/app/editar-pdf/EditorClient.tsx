"use client";

import dynamic from "next/dynamic";

// pdf.js y el editor solo funcionan en el navegador (canvas, worker, File API).
const EditorApp = dynamic(() => import("./EditorApp"), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <div className="spinner" />
      Cargando el editor…
    </div>
  ),
});

export function EditorClient() {
  return <EditorApp />;
}
