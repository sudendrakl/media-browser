# Implementation Plan - Optimize and Organize AuraView

To improve the readability, organization, and interaction performance of AuraView, we will extract the application logic and apply targeted optimizations to eliminate click reaction delays and loading lag.

## Proposed Changes

### 1. Code Reorganization (Readability)
- **Separate JS**: Extract all JavaScript logic currently embedded in `<script>` tags inside `index.html` into a new dedicated, clean file: [app.js](file:///home/sudhu/Documents/media-browser/app.js).
- **Clean HTML**: Modify [index.html](file:///home/sudhu/Documents/media-browser/index.html) to link to [style.css](file:///home/sudhu/Documents/media-browser/style.css) and [app.js](file:///home/sudhu/Documents/media-browser/app.js) and strip all inline `<style>` and `<script>` blocks.

### 2. Performance Optimizations (Fast Loading & Click Reaction)
- **Cache File Objects**: In `openMedia()`, change `file = await fileData.handle.getFile();` to:
  ```js
  file = await fileData.handle.getFile();
  fileData.fileObject = file; // Cache it!
  ```
  This ensures that subsequent clicks on the same picture (or navigation, filmstrip views, etc.) read from the cached in-memory File reference instead of querying the disk asynchronously via the File System Access API.
- **Eliminate Redundant DOM Rebuilds**: Remove the `filterAndRenderFiles()` call inside the `openMedia()` function. Rebuilding the entire list of elements from scratch on every single media selection is the primary source of screen stutter and browser offset recalculation.
- **O(1) Active Class Toggles**: In `openMedia()` and `closeViewer()`, replace the $O(N)$ DOM sweep (`document.querySelectorAll('.file-item')`) with targeted toggling:
  ```js
  // In openMedia
  const oldActive = el.fileList.querySelector('.file-item.active');
  if (oldActive) oldActive.classList.remove('active');
  const newActive = el.fileList.querySelector(`.file-item[data-index="${index}"]`);
  if (newActive) newActive.classList.add('active');
  ```
- **Optimized Thumbnail Generation**: Add safety checks to the thumbnail canvas generation to avoid memory overhead.

---

### [Component: AuraView Project]

#### [MODIFY] [index.html](file:///home/sudhu/Documents/media-browser/index.html)
- Link external [style.css](file:///home/sudhu/Documents/media-browser/style.css).
- Link external [app.js](file:///home/sudhu/Documents/media-browser/app.js).
- Remove inlined `<style>` and `<script>` blocks.

#### [NEW] [app.js](file:///home/sudhu/Documents/media-browser/app.js)
- Contain all the application logic with the optimizations implemented.

---

## Verification Plan

### Manual Verification
1. Open the updated [index.html](file:///home/sudhu/Documents/media-browser/index.html) directly via `file://` protocol.
2. Select a local media folder using the "Standard Folder Select" fallback or modern API.
3. Click a picture to open the preview. Verify that:
   - The reaction is instantaneous.
   - The sidebar list does not jump, reset its scroll position, or trigger screen shifting.
4. Navigate through pictures using `→` and `←` keyboard arrows. Verify that loading is extremely fast and smooth.
5. Verify slideshow mode operates correctly at a 3-second interval.
