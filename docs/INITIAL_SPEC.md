Here is a prompt crafted for a coding agent to build the first deliverable of **"The Bob of Ross — Painting with Bob"**.

---

### 📋 Copy and paste the prompt below directly to your AI Coding Agent:

```markdown
# TASK SPECIFICATION: "The Bob of Ross — Painting with Bob" (MVP Phase 1)

You are tasked with building the first proof-of-concept (POC) for an interactive, web-based painting experience called **"The Bob of Ross — Painting with Bob"**. 

The concept allows users to follow along with Bob Ross's *The Joy of Painting* in real-time. Instead of manually choosing colors or brush settings, the application automatically synchronizes the digital canvas tool (brush style, stroke density, color) to what Bob Ross is using at that exact second in the video, based on a timestamped JSON script.

---

## 🚀 Core User Experience & Layout Constraints

1. **Clean & Zen Aesthetics:**
   - Minimalist, tranquil UI design.
   - Dark/neutral room atmosphere to emphasize the canvas and video.
   - Smooth 60 FPS canvas performance.

2. **Video & Canvas Synchronized UI:**
   - **Main Area:** A large HTML5 Canvas occupying 80–85% of the viewport.
   - **Floating Video Player:** A small, floating, non-intrusive video window overlaying a corner of the screen (draggable or dockable), displaying a selected YouTube video (e.g., *The Joy of Painting* Season 1, Episode 1: "A Walk in the Woods").
   - **Tool Indicator Badge:** A subtle, translucent floating HUD (or badge near the floating video) showing the currently active auto-selected tool (e.g., `Tool: 2-inch Landscape Brush | Color: Phthalo Blue | Mode: Sky Wash`).

3. **Automation Mechanics:**
   - As the video plays, the web application tracks the video's current time (`currentTime`).
   - The app reads a predefined, time-coded JSON script (`bob_script_s01e01.json`).
   - Every frame/second, it checks for active tool triggers and seamlessly swaps the canvas pointer's active brush, color, size, and wet-on-wet behavior.
   - The user only needs to click and drag their mouse across the canvas; the app handles the procedural art generation so it mimics Bob’s results effortlessly.

---

## 🛠️ Technical Architecture & Deliverables

### Deliverable 1: Sample JSON Tool-Script Schema (`bob_script_s01e01.json`)
Create a mock JSON file mapping video timestamps to dynamic brush parameters for YouTube Video ID `OH94B9B8zDk` (*A Walk in the Woods* or similar YouTube Joy of Painting video).

```json
{
  "videoId": "OH94B9B8zDk",
  "title": "A Walk in the Woods",
  "timeline": [
    {
      "startTime": 0,
      "endTime": 120,
      "tool": {
        "name": "2-inch Brush",
        "color": "#FFFFFF",
        "type": "liquid_white_base",
        "opacity": 0.1,
        "size": 60,
        "blendMode": "source-over"
      },
      "bobDialogue": "We start out with a thin coat of Liquid White..."
    },
    {
      "startTime": 120,
      "endTime": 240,
      "tool": {
        "name": "2-inch Brush",
        "color": "#2C5282",
        "type": "sky_wash",
        "opacity": 0.4,
        "size": 50,
        "blendMode": "multiply"
      },
      "bobDialogue": "Let's load up some Phthalo Blue and make a happy little sky..."
    },
    {
      "startTime": 240,
      "endTime": 420,
      "tool": {
        "name": "Fan Brush",
        "color": "#1A365D",
        "type": "pine_tree_foliage",
        "opacity": 0.85,
        "size": 25,
        "blendMode": "source-over"
      },
      "bobDialogue": "Now with the corner of our fan brush, tap in some background evergreens..."
    },
    {
      "startTime": 420,
      "endTime": 600,
      "tool": {
        "name": "Palette Knife",
        "color": "#CBD5E0",
        "type": "mountain_snow",
        "opacity": 1.0,
        "size": 15,
        "breakTexture": true,
        "blendMode": "source-over"
      },
      "bobDialogue": "Just whisper across the canvas with the palette knife..."
    }
  ]
}

```

---

### Deliverable 2: Web Application (React / HTML5 Canvas / YouTube IFrame API)

1. **Video Synchronization Engine:**
* Embed the YouTube Iframe Player API.
* Run a light state listener (using `requestAnimationFrame` or `setInterval` at 100ms) comparing `player.getCurrentTime()` against `bob_script_s01e01.json`.
* Update state dynamically without causing canvas re-renders.


2. **Procedural Brush Engine (HTML5 Canvas 2D or WebGL):**
Implement custom stroke rendering logic based on the active tool `type`:
* **`liquid_white_base` / `sky_wash`:** Wide, soft criss-cross strokes with smooth opacity falloff.
* **`pine_tree_foliage` (Fan Brush):** Generates small procedural stamp clusters / pine needle clusters at the cursor position on mouse drag.
* **`mountain_snow` (Palette Knife):** Creates crisp, breaking edge lines with semi-random noise to mimic dry oil breaking across canvas texture.
* **Smooth Interpolation:** Interpolate mouse points using bezier curves to ensure zero lag or jagged lines during fast mouse sweeps.


3. **User Interaction & Cursor Feedback:**
* Update the custom mouse cursor visually depending on the active tool (e.g., scale a wide rectangular outline for the 2-inch brush, a fan shape for the fan brush, or a angled blade for the knife).
* Display subtle, relaxing visual ripple or particle effects around active brush strokes.


4. **UI & Control Bar:**
* Floating video container with minimal controls (Play, Pause, Progress Bar, Minimize toggle).
* Top bar with canvas actions: `Clear Canvas`, `Save Image (.png)`, `Toggle Audio/Sync`.



---

## 🎨 Technology Requirements

* **Framework:** React / Next.js OR Vite + Vanilla TS / HTML5 Canvas.
* **Styling:** Tailwind CSS or clean modern CSS modules (Dark mode preferred).
* **Audio/Video:** YouTube IFrame Player API.
* **Performance Requirement:** Canvas drawing MUST maintain 60FPS; do not tie canvas render loops directly to React component re-render trees.

---

## 🎯 Verification Criteria for MVP

1. Loading the app presents a playable YouTube video in a floating pip window and a full-bleed canvas.
2. Clicking Play on the video auto-syncs the current active tool configuration.
3. Dragging the cursor at `01:30` paints broad blue sky strokes; dragging at `04:30` creates pine fan textures or knife-edge snow breaks seamlessly.
4. The canvas feels liquid, highly responsive, smooth, and relaxing.

```

***

<Elicitation label="Refine brush physics specs for WebGL" query="Can you help me add specific WebGL shaders or brush physics algorithms to this prompt to make the painting look ultra-realistic?"/>

```