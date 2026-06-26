/**
 * AuraView - Premium Local Media Browser
 * Core Application Logic & Performance Engine
 */

// Application State
const state = {
  files: [],            // List of file items: { name, size, type, relativePath, parentPath, fileHandle, fileObject }
  activeFolder: null,   // Selected parent path in the folder tree (null means root or all)
  currentFilter: 'all', // 'all', 'images', 'videos'
  searchQuery: '',      // Search query string
  filteredFiles: [],    // Currently filtered list of files based on folder, filter tab, and search query
  currentIndex: -1,     // Index in filteredFiles
  activeBlobUrl: null,  // Current preview object URL
  renderedLimit: 100,   // Initial render batch size
  
  // Image Viewer Transform State
  zoom: 1,
  panX: 0,
  panY: 0,
  rotate: 0,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  
  // Slideshow State
  slideshowActive: false,
  slideshowTimer: null,
  slideshowInterval: 3000, // 3 seconds interval
  
  // UI Cache
  thumbnailCache: new Map(), // relativePath -> blobUrl
};

// Supported Media Extensions
const EXT_IMAGES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic'];
const EXT_VIDEOS = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'];

// DOM Elements
const el = {
  btnOpenModern: document.getElementById('btn-open-modern'),
  btnOpenFallback: document.getElementById('btn-open-fallback'),
  fallbackDirInput: document.getElementById('fallback-dir-input'),
  welcomeOpenModern: document.getElementById('welcome-btn-modern'),
  welcomeOpenFallback: document.getElementById('welcome-btn-fallback'),
  
  btnHelp: document.getElementById('btn-help'),
  helpModal: document.getElementById('help-modal'),
  btnHelpClose: document.getElementById('btn-help-close'),
  btnHelpOk: document.getElementById('btn-help-ok'),
  
  sidebar: document.getElementById('app-sidebar'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  sidebarToggleIcon: document.getElementById('sidebar-toggle-icon'),
  sectionFolders: document.getElementById('section-folders'),
  folderTree: document.getElementById('folder-tree'),
  searchBox: document.getElementById('search-box'),
  filterTabs: document.querySelectorAll('.filter-tab'),
  fileList: document.getElementById('media-file-list'),
  fileCount: document.getElementById('file-count'),
  
  emptyWorkspace: document.getElementById('empty-workspace'),
  viewerContainer: document.getElementById('viewer-container'),
  toolbarIndex: document.getElementById('toolbar-index'),
  
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),
  btnRotate: document.getElementById('btn-rotate'),
  btnSlideshow: document.getElementById('btn-slideshow'),
  slideshowIcon: document.getElementById('slideshow-icon'),
  btnFullscreen: document.getElementById('btn-fullscreen'),
  fullscreenIcon: document.getElementById('fullscreen-icon'),
  btnInfo: document.getElementById('btn-info'),
  btnCloseViewer: document.getElementById('btn-close-viewer'),
  
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  zoomIndicator: document.getElementById('zoom-indicator'),
  mediaViewport: document.getElementById('media-viewport'),
  
  viewerImg: document.getElementById('viewer-img'),
  viewerVideoWrapper: document.getElementById('viewer-video-wrapper'),
  viewerVideo: document.getElementById('viewer-video'),
  
  // Custom Video Controls
  videoTimelineContainer: document.getElementById('video-timeline-container'),
  videoProgress: document.getElementById('video-progress'),
  videoProgressHandle: document.getElementById('video-progress-handle'),
  videoPlayBtn: document.getElementById('video-play-btn'),
  videoPlayIcon: document.getElementById('video-play-icon'),
  videoRewindBtn: document.getElementById('video-rewind-btn'),
  videoForwardBtn: document.getElementById('video-forward-btn'),
  videoTimeDisplay: document.getElementById('video-time-display'),
  videoSpeedSelect: document.getElementById('video-speed-select'),
  videoMuteBtn: document.getElementById('video-mute-btn'),
  videoVolumeIcon: document.getElementById('video-volume-icon'),
  videoVolumeSlider: document.getElementById('video-volume-slider'),
  videoLoopBtn: document.getElementById('video-loop-btn'),
  videoFullscreenBtn: document.getElementById('video-fullscreen-btn'),
  
  infoOverlay: document.getElementById('file-info-overlay'),
  btnInfoClose: document.getElementById('btn-info-close'),
  infoOverlayContent: document.getElementById('info-overlay-content'),
  
  filmstripView: document.getElementById('filmstrip-view'),
};

// Initialize Application
function init() {
  const isFileProtocol = window.location.protocol === 'file:';
  if (!window.showDirectoryPicker || isFileProtocol) {
    el.btnOpenModern.style.display = 'none';
    el.welcomeOpenModern.style.display = 'none';
    el.btnOpenFallback.classList.add('btn-primary');
    el.welcomeOpenFallback.classList.add('btn-primary');
  }

  bindEvents();
  setupDragAndDrop();
  setupImageInteraction();
  setupCustomVideoPlayer();
  setupIntersectionObserver();
  setupSentinelObserver();
}

// Bind Global and Component UI Events
function bindEvents() {
  el.btnOpenModern.addEventListener('click', selectFolderModern);
  el.welcomeOpenModern.addEventListener('click', selectFolderModern);
  
  el.btnOpenFallback.addEventListener('click', () => el.fallbackDirInput.click());
  el.welcomeOpenFallback.addEventListener('click', () => el.fallbackDirInput.click());
  el.fallbackDirInput.addEventListener('change', handleFallbackFolderSelect);
  
  el.btnHelp.addEventListener('click', () => el.helpModal.classList.add('visible'));
  el.btnHelpClose.addEventListener('click', () => el.helpModal.classList.remove('visible'));
  el.btnHelpOk.addEventListener('click', () => el.helpModal.classList.remove('visible'));
  el.helpModal.addEventListener('click', (e) => {
    if (e.target === el.helpModal) el.helpModal.classList.remove('visible');
  });

  el.sidebarToggle.addEventListener('click', toggleSidebar);

  el.searchBox.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    filterAndRenderFiles();
  });

  el.filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      el.filterTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.currentFilter = e.target.dataset.filter;
      filterAndRenderFiles();
    });
  });

  el.btnCloseViewer.addEventListener('click', closeViewer);
  el.btnPrev.addEventListener('click', playPrevious);
  el.btnNext.addEventListener('click', playNext);
  
  el.btnSlideshow.addEventListener('click', toggleSlideshow);
  el.btnFullscreen.addEventListener('click', toggleViewerFullscreen);
  
  document.addEventListener('fullscreenchange', handleFullscreenStateChange);
  
  el.btnInfo.addEventListener('click', toggleInfoOverlay);
  el.btnInfoClose.addEventListener('click', () => el.infoOverlay.classList.remove('visible'));

  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Toggle Sidebar View State
function toggleSidebar() {
  document.body.classList.toggle('sidebar-collapsed');
  const isCollapsed = document.body.classList.contains('sidebar-collapsed');
  el.sidebarToggleIcon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
}

// Modern File System API Ingestion
async function selectFolderModern() {
  if (!window.showDirectoryPicker || window.location.protocol === 'file:') {
    alert("Your browser does not support the File System Access API in this context. Please use 'Standard Folder Select' instead.");
    return;
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    clearActiveBlobUrl();
    clearFullBlobCache();
    clearThumbnailCache();
    state.files = [];
    el.fileCount.textContent = "Scanning...";
    
    await traverseDirectoryHandle(dirHandle, dirHandle.name);
    onFolderLoaded();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error("Directory access error:", err);
      alert("Failed to access directory: " + err.message);
    }
  }
}

async function traverseDirectoryHandle(dirHandle, relativePath) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory') {
      await traverseDirectoryHandle(entry, `${relativePath}/${entry.name}`);
    } else if (entry.kind === 'file') {
      const ext = entry.name.split('.').pop().toLowerCase();
      const isImg = EXT_IMAGES.includes(ext);
      const isVid = EXT_VIDEOS.includes(ext);
      
      if (isImg || isVid) {
        const parts = relativePath.split('/');
        const rootDirName = parts[0];
        const displayRelativePath = relativePath.substring(rootDirName.length + 1) + '/' + entry.name;
        const parentPath = relativePath.substring(rootDirName.length + 1);

        state.files.push({
          name: entry.name,
          relativePath: displayRelativePath.startsWith('/') ? displayRelativePath.substring(1) : displayRelativePath,
          parentPath: parentPath.startsWith('/') ? parentPath.substring(1) : parentPath,
          type: isImg ? 'image' : 'video',
          handle: entry,
          fileObject: null // Lazy loaded and cached
        });
      }
    }
  }
}

// Fallback Input folder select
function handleFallbackFolderSelect(e) {
  const selectedFiles = e.target.files;
  if (!selectedFiles || selectedFiles.length === 0) return;

  clearActiveBlobUrl();
  clearFullBlobCache();
  clearThumbnailCache();
  state.files = [];
  el.fileCount.textContent = "Scanning...";

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const ext = file.name.split('.').pop().toLowerCase();
    const isImg = EXT_IMAGES.includes(ext);
    const isVid = EXT_VIDEOS.includes(ext);
    
    if (isImg || isVid) {
      const pathParts = file.webkitRelativePath.split('/');
      const rootDir = pathParts[0];
      const relativePath = file.webkitRelativePath.substring(rootDir.length + 1);
      const parentPath = pathParts.slice(1, -1).join('/');

      state.files.push({
        name: file.name,
        relativePath: relativePath,
        parentPath: parentPath,
        type: isImg ? 'image' : 'video',
        handle: null,
        fileObject: file
      });
    }
  }

  onFolderLoaded();
}

// Post-Ingestion Processing and Rendering
function onFolderLoaded() {
  if (state.files.length === 0) {
    alert("No supported images or videos found in the selected folder.");
    el.fileCount.textContent = "0 items";
    return;
  }

  buildFolderTree();

  state.activeFolder = null;
  state.currentFilter = 'all';
  state.searchQuery = '';
  
  el.searchBox.value = '';
  el.filterTabs.forEach(t => t.classList.remove('active'));
  el.filterTabs[0].classList.add('active');
  
  el.sectionFolders.style.display = 'block';

  const welcomeCard = el.emptyWorkspace.querySelector('.welcome-card');
  welcomeCard.innerHTML = `
    <div class="welcome-icon" style="background: rgba(6, 182, 212, 0.1); color: var(--accent-secondary); border-color: rgba(6, 182, 212, 0.2);">
      <svg viewBox="0 0 24 24">
        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
      </svg>
    </div>
    <h2>Folder Loaded</h2>
    <p>We found <strong>${state.files.length}</strong> media file(s) in your folder. Select any photo or video from the sidebar to preview.</p>
    <div class="welcome-buttons">
      <button class="btn btn-primary" id="welcome-btn-reopen" style="padding: 12px 24px; justify-content: center;">
        <svg viewBox="0 0 24 24"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg>
        Select a Different Folder
      </button>
    </div>
  `;
  
  document.getElementById('welcome-btn-reopen').addEventListener('click', () => {
    if (window.showDirectoryPicker && window.location.protocol !== 'file:') {
      selectFolderModern();
    } else {
      el.fallbackDirInput.click();
    }
  });

  document.body.classList.remove('no-folder');
  filterAndRenderFiles();
}

// Build folder tree structure
function buildFolderTree() {
  el.folderTree.innerHTML = '';
  
  const folders = new Set();
  state.files.forEach(f => {
    if (f.parentPath) {
      folders.add(f.parentPath);
    }
  });

  const tree = { name: 'Root', fullPath: '', children: {} };
  
  folders.forEach(fullPath => {
    const parts = fullPath.split('/');
    let current = tree;
    let pathAcc = '';
    
    parts.forEach(part => {
      pathAcc = pathAcc ? `${pathAcc}/${part}` : part;
      if (!current.children[part]) {
        current.children[part] = { name: part, fullPath: pathAcc, children: {} };
      }
      current = current.children[part];
    });
  });

  const rootNode = document.createElement('div');
  rootNode.className = 'tree-node active';
  rootNode.dataset.path = '';
  rootNode.innerHTML = `
    <svg class="chevron" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
    <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
    <span>All Media</span>
  `;
  el.folderTree.appendChild(rootNode);

  const rootChildrenContainer = document.createElement('div');
  rootChildrenContainer.className = 'tree-children';
  el.folderTree.appendChild(rootChildrenContainer);

  rootNode.addEventListener('click', (e) => {
    e.stopPropagation();
    selectTreeNode(rootNode, '');
  });

  function renderSubtree(node, parentEl) {
    Object.values(node.children).forEach(child => {
      const itemNode = document.createElement('div');
      itemNode.className = 'tree-node';
      itemNode.dataset.path = child.fullPath;
      
      const hasChildren = Object.keys(child.children).length > 0;
      const chevron = hasChildren 
        ? `<svg class="chevron" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`
        : `<span style="width: 10px; display: inline-block;"></span>`;

      itemNode.innerHTML = `
        ${chevron}
        <svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        <span>${child.name}</span>
      `;
      parentEl.appendChild(itemNode);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      childrenContainer.style.display = 'block';
      parentEl.appendChild(childrenContainer);

      itemNode.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('.chevron')) {
          const isCollapsed = childrenContainer.style.display === 'none';
          childrenContainer.style.display = isCollapsed ? 'block' : 'none';
          itemNode.classList.toggle('expanded', isCollapsed);
          return;
        }
        selectTreeNode(itemNode, child.fullPath);
      });

      if (hasChildren) {
        itemNode.classList.add('expanded');
        renderSubtree(child, childrenContainer);
      }
    });
  }

  renderSubtree(tree, rootChildrenContainer);
}

function selectTreeNode(nodeEl, path) {
  document.querySelectorAll('.tree-node').forEach(node => node.classList.remove('active'));
  nodeEl.classList.add('active');
  state.activeFolder = path;
  filterAndRenderFiles();
}

// File Filtering and UI Render Engine
function filterAndRenderFiles() {
  state.filteredFiles = state.files.filter(file => {
    if (state.activeFolder !== null) {
      if (state.activeFolder === '') {
        // Root folder: include all
      } else {
        const isCurrentFolder = file.parentPath === state.activeFolder;
        const isNestedFolder = file.parentPath.startsWith(state.activeFolder + '/');
        if (!isCurrentFolder && !isNestedFolder) return false;
      }
    }
    
    if (state.currentFilter === 'images' && file.type !== 'image') return false;
    if (state.currentFilter === 'videos' && file.type !== 'video') return false;
    
    if (state.searchQuery) {
      if (!file.name.toLowerCase().includes(state.searchQuery)) return false;
    }
    
    return true;
  });

  state.filteredFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  el.fileCount.textContent = `${state.filteredFiles.length} item${state.filteredFiles.length === 1 ? '' : 's'}`;

  renderListView();

  if (state.currentIndex >= 0) {
    const currentActiveFile = state.filteredFiles.find((f, idx) => idx === state.currentIndex);
    if (!currentActiveFile) {
      closeViewer();
    }
  }
}

let sentinelObserver;

function setupSentinelObserver() {
  sentinelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadNextBatch();
      }
    });
  }, {
    root: el.fileList,
    rootMargin: '200px', // Trigger load before user hits scroll bottom
    threshold: 0.01
  });
}

function renderListView() {
  state.renderedLimit = 100;
  
  if (sentinelObserver) {
    sentinelObserver.disconnect();
  }
  
  el.fileList.innerHTML = '';
  
  if (state.filteredFiles.length === 0) {
    el.fileList.innerHTML = `<li style="padding: 24px; text-align: center; color: var(--text-dark); font-size: 0.85rem;">No media files match your filters</li>`;
    return;
  }

  appendFilesToList(0, Math.min(state.filteredFiles.length, state.renderedLimit));
  
  if (state.renderedLimit < state.filteredFiles.length) {
    createAndObserveSentinel();
  }
}

function appendFilesToList(startIndex, endIndex) {
  for (let i = startIndex; i < endIndex; i++) {
    const file = state.filteredFiles[i];
    const li = document.createElement('li');
    li.className = `file-item ${i === state.currentIndex ? 'active' : ''}`;
    li.dataset.index = i;

    const sizeFormatted = file.fileObject ? formatBytes(file.fileObject.size) : 'Local file';
    const videoBadge = file.type === 'video' ? '<span class="badge-video">VIDEO</span>' : '';
    
    const mediaIcon = file.type === 'video' 
      ? `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

    li.innerHTML = `
      <div class="file-item-thumb skeleton" data-thumb-path="${file.relativePath}">
        ${mediaIcon}
        ${videoBadge}
      </div>
      <div class="file-item-info">
        <div class="file-item-name" title="${file.name}">${file.name}</div>
        <div class="file-item-meta">
          <span>${file.type.toUpperCase()}</span>
          <span>${sizeFormatted}</span>
        </div>
      </div>
    `;

    li.addEventListener('click', () => {
      openMedia(i);
    });

    const sentinel = document.getElementById('file-list-sentinel');
    if (sentinel) {
      el.fileList.insertBefore(li, sentinel);
    } else {
      el.fileList.appendChild(li);
    }
    
    const thumbContainer = li.querySelector('.file-item-thumb');
    thumbnailObserver.observe(thumbContainer);
  }
}

function createAndObserveSentinel() {
  let sentinel = document.getElementById('file-list-sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'file-list-sentinel';
    sentinel.style.height = '20px';
    sentinel.style.width = '100%';
    el.fileList.appendChild(sentinel);
  }
  sentinelObserver.observe(sentinel);
}

function loadNextBatch() {
  if (state.renderedLimit >= state.filteredFiles.length) {
    if (sentinelObserver) sentinelObserver.disconnect();
    const sentinel = document.getElementById('file-list-sentinel');
    if (sentinel) sentinel.remove();
    return;
  }
  
  const prevLimit = state.renderedLimit;
  state.renderedLimit += 100;
  const nextLimit = Math.min(state.filteredFiles.length, state.renderedLimit);
  
  appendFilesToList(prevLimit, nextLimit);
  
  if (nextLimit >= state.filteredFiles.length) {
    if (sentinelObserver) sentinelObserver.disconnect();
    const sentinel = document.getElementById('file-list-sentinel');
    if (sentinel) sentinel.remove();
  }
}

// Lazy Load Thumbnails System
let thumbnailObserver;

function setupIntersectionObserver() {
  thumbnailObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      const container = entry.target;
      if (entry.isIntersecting) {
        const relativePath = container.dataset.thumbPath;
        const fileData = state.files.find(f => f.relativePath === relativePath);
        
        if (fileData) {
          const timer = setTimeout(() => {
            loadThumbnail(fileData, container);
            observer.unobserve(container);
            delete container.dataset.loadTimer;
          }, 150);
          container.dataset.loadTimer = timer;
        }
      } else {
        if (container.dataset.loadTimer) {
          clearTimeout(parseInt(container.dataset.loadTimer));
          delete container.dataset.loadTimer;
        }
      }
    });
  }, {
    root: el.fileList,
    rootMargin: '100px 0px',
    threshold: 0.01
  });
}

async function loadThumbnail(fileData, container) {
  const tStart = performance.now();
  try {
    if (state.thumbnailCache.has(fileData.relativePath)) {
      applyThumbnailImage(container, state.thumbnailCache.get(fileData.relativePath));
      return;
    }

    let file = fileData.fileObject;
    if (!file && fileData.handle) {
      const tGet = performance.now();
      file = await fileData.handle.getFile();
      fileData.fileObject = file; // Performance optimization: Cache it!
      console.log(`[AuraView Log] Thumbnail getFile() for "${fileData.name}" took ${(performance.now() - tGet).toFixed(2)}ms`);
    }

    if (!file) return;

    let thumbUrl = '';

    if (fileData.type === 'image') {
      const tImgStart = performance.now();
      const img = new Image();
      const tempUrl = URL.createObjectURL(file);
      img.src = tempUrl;
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 120;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              state.thumbnailCache.set(fileData.relativePath, url);
              applyThumbnailImage(container, url);
              console.log(`[AuraView Log] Image canvas thumbnail for "${fileData.name}" created in ${(performance.now() - tImgStart).toFixed(2)}ms`);
            }
            URL.revokeObjectURL(tempUrl);
            img.src = '';
          }, 'image/jpeg', 0.7);
        } catch (err) {
          console.warn("Failed canvas render for image thumbnail:", err);
          URL.revokeObjectURL(tempUrl);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(tempUrl);
      };
    } else if (fileData.type === 'video') {
      const tVidStart = performance.now();
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const tempUrl = URL.createObjectURL(file);
      video.src = tempUrl;
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              state.thumbnailCache.set(fileData.relativePath, url);
              applyThumbnailImage(container, url);
              console.log(`[AuraView Log] Video thumbnail for "${fileData.name}" created in ${(performance.now() - tVidStart).toFixed(2)}ms`);
            }
            URL.revokeObjectURL(tempUrl);
            video.src = '';
            video.load();
          }, 'image/jpeg', 0.7);
        } catch (err) {
          console.warn("Failed canvas render for thumbnail:", err);
          URL.revokeObjectURL(tempUrl);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(tempUrl);
      };
    }
  } catch (err) {
    console.error("Error loading thumbnail for:", fileData.name, err);
  }
}

function applyThumbnailImage(container, url) {
  container.classList.remove('skeleton');
  
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'thumb';
  
  const badge = container.querySelector('.badge-video');
  container.innerHTML = '';
  container.appendChild(img);
  if (badge) container.appendChild(badge);
}

function clearThumbnailCache() {
  state.thumbnailCache.forEach(url => {
    if (!url.startsWith('data:')) {
      URL.revokeObjectURL(url);
    }
  });
  state.thumbnailCache.clear();
}

// Media Preview Core Engine
function ensureIndexRendered(index) {
  while (index >= state.renderedLimit && state.renderedLimit < state.filteredFiles.length) {
    loadNextBatch();
  }
}

async function openMedia(index) {
  if (index < 0 || index >= state.filteredFiles.length) return;
  
  console.log(`%c[AuraView Log] Clicked file index: ${index}, name: ${state.filteredFiles[index].name}`, 'color: #06b6d4; font-weight: bold;');
  const t0 = performance.now();
  
  pauseSlideshowTimer();
  
  // Ensure the items up to this index are rendered in the DOM first
  const tRender = performance.now();
  ensureIndexRendered(index);
  console.log(`[AuraView Log] ensureIndexRendered took ${(performance.now() - tRender).toFixed(2)}ms`);

  state.currentIndex = index;
  const fileData = state.filteredFiles[index];
  
  // Performance Optimization: O(1) active item toggle
  const tActive = performance.now();
  const oldActive = el.fileList.querySelector('.file-item.active');
  if (oldActive) oldActive.classList.remove('active');
  
  const newActive = el.fileList.querySelector(`.file-item[data-index="${index}"]`);
  if (newActive) newActive.classList.add('active');
  console.log(`[AuraView Log] active item toggle took ${(performance.now() - tActive).toFixed(2)}ms`);

  // Smooth scroll the sidebar active list item into view (container-relative to prevent body shifting)
  const tScroll = performance.now();
  if (newActive) {
    const container = el.fileList;
    const itemTop = newActive.offsetTop;
    const itemHeight = newActive.offsetHeight;
    const containerHeight = container.clientHeight;
    const containerScrollTop = container.scrollTop;

    if (itemTop < containerScrollTop) {
      container.scrollTo({ top: itemTop, behavior: 'smooth' });
    } else if (itemTop + itemHeight > containerScrollTop + containerHeight) {
      container.scrollTo({ top: itemTop + itemHeight - containerHeight, behavior: 'smooth' });
    }
  }
  console.log(`[AuraView Log] sidebar scrolling took ${(performance.now() - tScroll).toFixed(2)}ms`);

  el.emptyWorkspace.style.display = 'none';
  el.viewerContainer.style.display = 'flex';
  
  el.toolbarIndex.textContent = `${index + 1} / ${state.filteredFiles.length}`;

  let file = fileData.fileObject;
  if (!file && fileData.handle) {
    el.fileCount.textContent = "Loading file...";
    const tGetFile = performance.now();
    try {
      file = await fileData.handle.getFile();
      fileData.fileObject = file; // Performance optimization: Cache it!
    } catch (e) {
      console.error(e);
      alert("Failed to read file: " + e.message);
      return;
    }
    console.log(`[AuraView Log] getFile() disk fetch took ${(performance.now() - tGetFile).toFixed(2)}ms`);
    
    // Performance optimization: Removed filterAndRenderFiles() complete DOM rebuild call.
    // Instead we just update the specific item metadata (file size) if fallback size wasn't ready.
    if (newActive) {
      const metaSpan = newActive.querySelector('.file-item-meta span:last-child');
      if (metaSpan && metaSpan.textContent === 'Local file') {
        metaSpan.textContent = formatBytes(file.size);
      }
    }
  } else {
    console.log(`[AuraView Log] Using cached/preloaded fileObject (fetch took 0ms)`);
  }

  const tBlob = performance.now();
  if (fileData.type === 'image') {
    state.activeBlobUrl = getFullSizeBlobUrl(fileData, file);
  } else if (fileData.type === 'video') {
    clearActiveBlobUrl();
    state.activeBlobUrl = URL.createObjectURL(file);
  }
  console.log(`[AuraView Log] Blob URL preparation took ${(performance.now() - tBlob).toFixed(2)}ms`);

  resetImageTransforms();

  const tShow = performance.now();
  if (fileData.type === 'image') {
    el.viewerVideoWrapper.style.display = 'none';
    el.viewerVideo.pause();
    el.viewerVideo.src = '';
    
    el.viewerImg.style.display = 'block';
    el.viewerImg.classList.add('img-loading'); // add loading/blur state
    el.viewerImg.src = state.activeBlobUrl;
    
    document.getElementById('image-controls').style.display = 'flex';
  } else if (fileData.type === 'video') {
    el.viewerImg.style.display = 'none';
    el.viewerImg.src = '';
    
    el.viewerVideoWrapper.style.display = 'flex';
    el.viewerVideo.src = state.activeBlobUrl;
    el.viewerVideo.load();
    
    document.getElementById('image-controls').style.display = 'none';
    
    resetVideoUI();
    el.viewerVideo.play().catch(e => console.log("Autoplay block:", e));
  }
  console.log(`[AuraView Log] show media took ${(performance.now() - tShow).toFixed(2)}ms`);

  const tFilm = performance.now();
  renderFilmstrip();
  console.log(`[AuraView Log] renderFilmstrip took ${(performance.now() - tFilm).toFixed(2)}ms`);
  
  const tMeta = performance.now();
  updateFileMetadata(file, fileData);
  console.log(`[AuraView Log] updateFileMetadata took ${(performance.now() - tMeta).toFixed(2)}ms`);

  if (state.slideshowActive) {
    startSlideshowTimer();
  }
  
  // Preload adjacent images
  setTimeout(() => {
    preloadAdjacentMedia(index);
  }, 100);
  
  console.log(`%c[AuraView Log] openMedia Total Time: ${(performance.now() - t0).toFixed(2)}ms`, 'color: #8b5cf6; font-weight: bold;');
}

function closeViewer() {
  pauseSlideshowTimer();
  state.slideshowActive = false;
  updateSlideshowButtonUI();
  
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  
  clearActiveBlobUrl();
  clearFullBlobCache();
  state.currentIndex = -1;
  
  el.viewerVideo.pause();
  el.viewerVideo.src = '';
  el.viewerImg.src = '';
  el.viewerImg.classList.remove('img-loading');
  
  el.viewerContainer.style.display = 'none';
  el.emptyWorkspace.style.display = 'flex';
  
  // Performance optimization: O(1) targeted removal
  const activeItem = el.fileList.querySelector('.file-item.active');
  if (activeItem) activeItem.classList.remove('active');
}

function preloadAdjacentMedia(index) {
  if (index < 0 || index >= state.filteredFiles.length) return;
  
  // Preload next and previous 2 items
  const indicesToPreload = [index + 1, index - 1, index + 2, index - 2].filter(
    idx => idx >= 0 && idx < state.filteredFiles.length
  );
  
  indicesToPreload.forEach(async (idx) => {
    const fileData = state.filteredFiles[idx];
    if (!fileData || fileData.type !== 'image') return;
    
    let file = fileData.fileObject;
    if (!file && fileData.handle) {
      try {
        file = await fileData.handle.getFile();
        fileData.fileObject = file;
      } catch (e) {
        return;
      }
    }
    if (!file) return;
    
    const url = getFullSizeBlobUrl(fileData, file);
    
    if (!fileData.preloadedImage) {
      const img = new Image();
      img.src = url;
      fileData.preloadedImage = img;
      img.decode().then(() => {
        console.log(`[AuraView Log] Background pre-decoded: ${fileData.name}`);
      }).catch(() => {
        // Ignore decode errors
      });
    }
  });
}

// Full-Size Image Blob URL Cache (MRU cache implementation)
const activeFullBlobCache = []; // Array of relativePaths in order of MRU
const MAX_FULL_BLOB_CACHE = 10;

function getFullSizeBlobUrl(fileData, file) {
  if (fileData.fullBlobUrl) {
    // Move to end of cache (Most Recently Used)
    const idx = activeFullBlobCache.indexOf(fileData.relativePath);
    if (idx > -1) {
      activeFullBlobCache.splice(idx, 1);
    }
    activeFullBlobCache.push(fileData.relativePath);
    return fileData.fullBlobUrl;
  }
  
  // Create new Object URL
  const url = URL.createObjectURL(file);
  fileData.fullBlobUrl = url;
  activeFullBlobCache.push(fileData.relativePath);
  
  // Evict oldest if limit exceeded
  if (activeFullBlobCache.length > MAX_FULL_BLOB_CACHE) {
    const oldestPath = activeFullBlobCache.shift();
    const oldestFile = state.files.find(f => f.relativePath === oldestPath);
    if (oldestFile && oldestFile.fullBlobUrl) {
      URL.revokeObjectURL(oldestFile.fullBlobUrl);
      oldestFile.fullBlobUrl = null;
      oldestFile.preloadedImage = null;
      console.log(`[AuraView Log] Evicted full-size blob URL for: ${oldestFile.name}`);
    }
  }
  
  return url;
}

function clearFullBlobCache() {
  state.files.forEach(f => {
    if (f.fullBlobUrl) {
      URL.revokeObjectURL(f.fullBlobUrl);
      f.fullBlobUrl = null;
      f.preloadedImage = null;
    }
  });
  activeFullBlobCache.length = 0;
}

function clearActiveBlobUrl() {
  if (state.activeBlobUrl) {
    // Revoke only if it's not a cached full-size image blob URL
    const isImageCached = state.files.some(f => f.fullBlobUrl === state.activeBlobUrl);
    if (!isImageCached) {
      URL.revokeObjectURL(state.activeBlobUrl);
    }
    state.activeBlobUrl = null;
  }
}

function playPrevious() {
  if (state.filteredFiles.length === 0) return;
  let newIdx = state.currentIndex - 1;
  if (newIdx < 0) {
    newIdx = state.filteredFiles.length - 1;
  }
  openMedia(newIdx);
}

function playNext() {
  if (state.filteredFiles.length === 0) return;
  let newIdx = state.currentIndex + 1;
  if (newIdx >= state.filteredFiles.length) {
    newIdx = 0;
  }
  openMedia(newIdx);
}

// Image Interaction System (Pan, Zoom, Rotate)
function setupImageInteraction() {
  const img = el.viewerImg;

  el.btnZoomIn.addEventListener('click', () => adjustZoom(0.25));
  el.btnZoomOut.addEventListener('click', () => adjustZoom(-0.25));
  el.btnZoomReset.addEventListener('click', resetImageTransforms);
  el.btnRotate.addEventListener('click', rotateImage);

  el.mediaViewport.addEventListener('wheel', (e) => {
    if (state.currentIndex < 0) return;
    const file = state.filteredFiles[state.currentIndex];
    if (file.type !== 'image') return;
    
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    adjustZoom(zoomFactor);
  }, { passive: false });

  img.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    state.isDragging = true;
    img.classList.add('dragging');
    state.dragStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    state.panX = e.clientX - state.dragStart.x;
    state.panY = e.clientY - state.dragStart.y;
    applyImageTransforms();
  });

  window.addEventListener('mouseup', () => {
    if (state.isDragging) {
      state.isDragging = false;
      img.classList.remove('dragging');
    }
  });

  img.addEventListener('load', () => {
    img.classList.remove('img-loading');
    if (state.currentIndex >= 0) {
      const fileData = state.filteredFiles[state.currentIndex];
      const file = fileData.fileObject;
      updateFileMetadata(file, fileData);
    }
  });

  img.addEventListener('error', () => {
    img.classList.remove('img-loading');
  });
}

function adjustZoom(factor) {
  const prevZoom = state.zoom;
  state.zoom = Math.max(0.1, Math.min(8, state.zoom + factor));
  
  if (state.zoom !== prevZoom) {
    applyImageTransforms();
    showZoomPercent();
  }
}

function rotateImage() {
  state.rotate = (state.rotate + 90) % 360;
  applyImageTransforms();
}

function resetImageTransforms() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.rotate = 0;
  applyImageTransforms();
  showZoomPercent();
}

function applyImageTransforms() {
  el.viewerImg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}) rotate(${state.rotate}deg)`;
}

let zoomIndicatorTimer;
function showZoomPercent() {
  el.zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
  el.zoomIndicator.classList.add('visible');
  
  clearTimeout(zoomIndicatorTimer);
  zoomIndicatorTimer = setTimeout(() => {
    el.zoomIndicator.classList.remove('visible');
  }, 1000);
}

// Fullscreen View Mode Controller
function toggleViewerFullscreen() {
  const container = el.viewerContainer;
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      alert(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
    });
  } else {
    document.exitFullscreen();
  }
}

function handleFullscreenStateChange() {
  const isFullscreen = !!document.fullscreenElement;
  if (isFullscreen) {
    el.fullscreenIcon.innerHTML = `<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>`;
  } else {
    el.fullscreenIcon.innerHTML = `<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>`;
  }
}

// Custom Video Player Controller
function setupCustomVideoPlayer() {
  const v = el.viewerVideo;

  v.addEventListener('timeupdate', updateVideoProgress);
  v.addEventListener('durationchange', updateVideoProgress);
  v.addEventListener('play', () => updateVideoPlayIcon(true));
  v.addEventListener('pause', () => updateVideoPlayIcon(false));
  v.addEventListener('ended', handleVideoEnded);

  el.videoPlayBtn.addEventListener('click', toggleVideoPlayback);
  v.addEventListener('click', toggleVideoPlayback);

  el.videoRewindBtn.addEventListener('click', () => { v.currentTime = Math.max(0, v.currentTime - 10); });
  el.videoForwardBtn.addEventListener('click', () => { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); });

  el.videoSpeedSelect.addEventListener('change', (e) => {
    v.playbackRate = parseFloat(e.target.value);
  });

  el.videoMuteBtn.addEventListener('click', toggleVideoMute);
  el.videoVolumeSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    v.volume = vol;
    v.muted = vol === 0;
    updateVolumeIcon(vol, v.muted);
  });

  el.videoLoopBtn.addEventListener('click', () => {
    v.loop = !v.loop;
    el.videoLoopBtn.style.color = v.loop ? 'var(--accent-secondary)' : '#fff';
  });

  el.videoFullscreenBtn.addEventListener('click', toggleViewerFullscreen);
  el.videoTimelineContainer.addEventListener('mousedown', startVideoScrubbing);
}

function resetVideoUI() {
  const v = el.viewerVideo;
  v.playbackRate = 1.0;
  el.videoSpeedSelect.value = "1";
  v.loop = false;
  el.videoLoopBtn.style.color = '#fff';
}

function toggleVideoPlayback() {
  const v = el.viewerVideo;
  if (v.paused) {
    v.play().catch(e => console.log(e));
  } else {
    v.pause();
  }
}

function updateVideoPlayIcon(isPlaying) {
  el.videoPlayIcon.innerHTML = isPlaying 
    ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
    : `<path d="M8 5v14l11-7z"/>`;
}

function updateVideoProgress() {
  const v = el.viewerVideo;
  const current = v.currentTime || 0;
  const duration = v.duration || 0;
  
  const percentage = duration > 0 ? (current / duration) * 100 : 0;
  
  el.videoProgress.style.width = `${percentage}%`;
  el.videoProgressHandle.style.left = `${percentage}%`;
  el.videoTimeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

let isScrubbing = false;
function startVideoScrubbing(e) {
  isScrubbing = true;
  scrubVideo(e);
  window.addEventListener('mousemove', scrubVideo);
  window.addEventListener('mouseup', stopVideoScrubbing);
}

function scrubVideo(e) {
  const rect = el.videoTimelineContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, clickX / rect.width));
  const v = el.viewerVideo;
  v.currentTime = percentage * (v.duration || 0);
  updateVideoProgress();
}

function stopVideoScrubbing() {
  if (isScrubbing) {
    isScrubbing = false;
    window.removeEventListener('mousemove', scrubVideo);
    window.removeEventListener('mouseup', stopVideoScrubbing);
  }
}

// Muting toggles
function toggleVideoMute() {
  const v = el.viewerVideo;
  v.muted = !v.muted;
  updateVolumeIcon(v.volume, v.muted);
  el.videoVolumeSlider.value = v.muted ? 0 : v.volume;
}

function updateVolumeIcon(volume, isMuted) {
  if (isMuted || volume === 0) {
    el.videoVolumeIcon.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
  } else if (volume < 0.5) {
    el.videoVolumeIcon.innerHTML = `<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>`;
  } else {
    el.videoVolumeIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;
  }
}

function handleVideoEnded() {
  if (state.slideshowActive) {
    playNext();
  }
}

// Slideshow Engine Logic
function toggleSlideshow() {
  state.slideshowActive = !state.slideshowActive;
  updateSlideshowButtonUI();

  if (state.slideshowActive) {
    if (state.currentIndex === -1 && state.filteredFiles.length > 0) {
      openMedia(0);
    } else {
      startSlideshowTimer();
    }
  } else {
    pauseSlideshowTimer();
  }
}

function updateSlideshowButtonUI() {
  el.slideshowIcon.innerHTML = state.slideshowActive 
    ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
    : `<path d="M8 5v14l11-7z"/>`;
  el.btnSlideshow.classList.toggle('active', state.slideshowActive);
  el.btnSlideshow.style.color = state.slideshowActive ? 'var(--accent-secondary)' : 'var(--text-muted)';
}

function startSlideshowTimer() {
  pauseSlideshowTimer();
  
  if (state.currentIndex === -1) return;
  const currentFile = state.filteredFiles[state.currentIndex];
  
  if (currentFile.type === 'video') {
    // Video auto-advance is bound to 'ended' event listener
  } else {
    state.slideshowTimer = setTimeout(() => {
      playNext();
    }, state.slideshowInterval);
  }
}

function pauseSlideshowTimer() {
  if (state.slideshowTimer) {
    clearTimeout(state.slideshowTimer);
    state.slideshowTimer = null;
  }
}

// Bottom Filmstrip Controller
function renderFilmstrip() {
  el.filmstripView.innerHTML = '';
  
  if (state.filteredFiles.length === 0) return;

  const windowRadius = 15;
  const startIdx = Math.max(0, state.currentIndex - windowRadius);
  const endIdx = Math.min(state.filteredFiles.length - 1, state.currentIndex + windowRadius);

  for (let i = startIdx; i <= endIdx; i++) {
    const file = state.filteredFiles[i];
    const div = document.createElement('div');
    div.className = `filmstrip-item ${i === state.currentIndex ? 'active' : ''}`;
    div.dataset.index = i;
    div.dataset.filmstripPath = file.relativePath;

    const placeholderIcon = file.type === 'video'
      ? `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

    div.innerHTML = placeholderIcon;
    
    div.addEventListener('click', () => {
      openMedia(i);
    });

    el.filmstripView.appendChild(div);

    if (state.thumbnailCache.has(file.relativePath)) {
      const img = document.createElement('img');
      img.src = state.thumbnailCache.get(file.relativePath);
      img.alt = 'strip';
      div.innerHTML = '';
      div.appendChild(img);
    } else {
      thumbnailObserver.observe(div);
      div.dataset.thumbPath = file.relativePath;
    }
  }

  setTimeout(() => {
    const activeItem = el.filmstripView.querySelector('.filmstrip-item.active');
    if (activeItem) {
      const container = el.filmstripView;
      const itemLeft = activeItem.offsetLeft;
      const itemWidth = activeItem.offsetWidth;
      const containerWidth = container.clientWidth;
      const targetScrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, 100);
}

// Metadata Overlay panel
function toggleInfoOverlay() {
  el.infoOverlay.classList.toggle('visible');
}

function updateFileMetadata(fileObject, fileData) {
  const size = fileObject ? formatBytes(fileObject.size) : 'Unknown';
  const lastModified = fileObject ? new Date(fileObject.lastModified).toLocaleString() : 'Unknown';
  
  let detailsHtml = `
    <div class="info-row"><span class="info-label">Filename</span><span class="info-value">${fileData.name}</span></div>
    <div class="info-row"><span class="info-label">Format</span><span class="info-value">${fileData.name.split('.').pop().toUpperCase()} (${fileData.type})</span></div>
    <div class="info-row"><span class="info-label">File Size</span><span class="info-value">${size}</span></div>
    <div class="info-row"><span class="info-label">Relative Path</span><span class="info-value">${fileData.relativePath}</span></div>
    <div class="info-row"><span class="info-label">Modified Date</span><span class="info-value">${lastModified}</span></div>
  `;

  if (fileData.type === 'image') {
    if (el.viewerImg.complete && el.viewerImg.naturalWidth > 0) {
      detailsHtml += `<div class="info-row"><span class="info-label">Dimensions</span><span class="info-value">${el.viewerImg.naturalWidth} x ${el.viewerImg.naturalHeight} px</span></div>`;
    } else {
      detailsHtml += `<div class="info-row"><span class="info-label">Dimensions</span><span class="info-value">Detecting...</span></div>`;
    }
  } else if (fileData.type === 'video') {
    const v = el.viewerVideo;
    const updateDimensions = () => {
      detailsHtml += `
        <div class="info-row"><span class="info-label">Resolution</span><span class="info-value">${v.videoWidth} x ${v.videoHeight} px</span></div>
        <div class="info-row"><span class="info-label">Duration</span><span class="info-value">${formatTime(v.duration)}</span></div>
      `;
      el.infoOverlayContent.innerHTML = detailsHtml;
    };
    if (v.readyState >= 1) {
      updateDimensions();
    } else {
      v.addEventListener('loadedmetadata', updateDimensions, { once: true });
    }
  }

  el.infoOverlayContent.innerHTML = detailsHtml;
}

// Drag and Drop Folder Ingestion
function setupDragAndDrop() {
  const dropZone = document.body;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.border = '2px dashed var(--accent-secondary)';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.border = 'none';
    }, false);
  });

  dropZone.addEventListener('drop', async (e) => {
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;
    
    if (items[0].getAsFileSystemHandle) {
      try {
        const handle = await items[0].getAsFileSystemHandle();
        if (handle.kind === 'directory') {
          clearActiveBlobUrl();
          clearThumbnailCache();
          state.files = [];
          el.fileCount.textContent = "Scanning directory...";
          
          await traverseDirectoryHandle(handle, handle.name);
          onFolderLoaded();
        } else {
          alert("Please drag and drop a FOLDER instead of individual files.");
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      alert("Folder drop is not fully supported in this browser version. Use 'Standard Folder Select' button.");
    }
  });
}

// Keyboard Shortcut Navigation Hook
function handleKeyboardShortcuts(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
    return;
  }

  const key = e.key.toLowerCase();
  
  if (el.helpModal.classList.contains('visible')) {
    if (key === 'escape' || key === 'enter') {
      el.helpModal.classList.remove('visible');
      e.preventDefault();
    }
    return;
  }

  if (state.currentIndex === -1) {
    if (key === 'h' || key === '?' || e.key === '?') {
      el.helpModal.classList.add('visible');
      e.preventDefault();
    }
    return;
  }

  const currentFile = state.filteredFiles[state.currentIndex];

  switch (e.key) {
    case 'ArrowRight':
      playNext();
      e.preventDefault();
      break;
      
    case 'ArrowLeft':
      playPrevious();
      e.preventDefault();
      break;
      
    case ' ':
      e.preventDefault();
      if (currentFile.type === 'video') {
        toggleVideoPlayback();
      } else {
        toggleSlideshow();
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      if (state.zoom !== 1 || state.rotate !== 0 || state.panX !== 0 || state.panY !== 0) {
        resetImageTransforms();
      } else {
        closeViewer();
      }
      break;
      
    case 'r':
    case 'R':
      if (currentFile.type === 'image') {
        rotateImage();
        e.preventDefault();
      }
      break;
      
    case 'i':
    case 'I':
      toggleInfoOverlay();
      e.preventDefault();
      break;

    case 'f':
    case 'F':
      toggleViewerFullscreen();
      e.preventDefault();
      break;
      
    case 'h':
    case 'H':
    case '?':
      el.helpModal.classList.add('visible');
      e.preventDefault();
      break;
      
    case '+':
    case '=':
      if (currentFile.type === 'image') {
        adjustZoom(0.25);
        e.preventDefault();
      }
      break;
      
    case '-':
    case '_':
      if (currentFile.type === 'image') {
        adjustZoom(-0.25);
        e.preventDefault();
      }
      break;
  }
}

// Utility Functions
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Execute AuraView Init
init();
