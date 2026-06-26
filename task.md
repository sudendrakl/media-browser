# AuraView Performance Checklist

- [x] Update `style.css` with blur-up and loading transition classes
- [x] Add cache structures and MRU functions in `app.js`
- [x] Update `loadThumbnail` to use canvas resizing for image files
- [x] Refactor `openMedia` and `closeViewer` to cache full-sized image blobs and manage the cache
- [x] Implement background prefetching and decoding of adjacent media
- [x] Add load and error event listeners on `el.viewerImg` to update loading state and metadata
- [x] Verify optimization results
