import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startPerformanceMonitor } from "./performance/monitor";
import "./styles.css";

const stopPerformanceMonitor = startPerformanceMonitor();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.dispose(stopPerformanceMonitor);
}
