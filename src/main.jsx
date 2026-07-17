import React from "react";
import { createRoot } from "react-dom/client";
import Campground from "./Campground.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Campground />
  </React.StrictMode>
);
