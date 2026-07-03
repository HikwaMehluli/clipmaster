import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

let historyData = [];
let filteredHistory = [];
let selectedIndex = 0;
let currentTheme = 'dark';
let maxHistoryLimit = 50;
let maxCharactersLimit = 5000;

const searchInput = document.getElementById('searchInput');
const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const closeBtn = document.getElementById('closeBtn');
const appContainer = document.getElementById('app');
const themeToggle = document.getElementById('themeToggle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const maxHistorySlider = document.getElementById('maxHistorySlider');
const maxCharactersSlider = document.getElementById('maxCharactersSlider');
const maxHistoryValue = document.getElementById('maxHistoryValue');
const maxCharactersValue = document.getElementById('maxCharactersValue');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyCounter = document.getElementById('historyCounter');

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  const data = await invoke('get_initial_data');
  applyData(data);

  searchInput.focus();
});

listen('update-history', (event) => {
  applyData(event.payload);
});

listen('theme-changed', (event) => {
  currentTheme = event.payload;
  applyTheme(currentTheme);
});

function applyData(data) {
  historyData = data.history;
  filteredHistory = [...historyData];
  currentTheme = data.theme;
  selectedIndex = 0;

  if (data.maxHistory !== undefined) {
    maxHistoryLimit = data.maxHistory;
    maxHistorySlider.value = maxHistoryLimit;
    maxHistoryValue.textContent = maxHistoryLimit;
  }
  if (data.maxCharacters !== undefined) {
    maxCharactersLimit = data.maxCharacters;
    maxCharactersSlider.value = maxCharactersLimit;
    maxCharactersValue.textContent = maxCharactersLimit.toLocaleString();
  }

  searchInput.value = '';
  applyTheme(currentTheme);
  renderHistory();
  updateHistoryCounter();
  searchInput.focus();
}

function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  closeBtn.addEventListener('click', closeWindow);
  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  themeToggle.addEventListener('change', () => {
    invoke('toggle_theme');
  });

  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });

  maxHistorySlider.addEventListener('input', () => {
    const val = parseInt(maxHistorySlider.value);
    maxHistoryValue.textContent = val;
    sendSettings();
  });

  maxCharactersSlider.addEventListener('input', () => {
    const val = parseInt(maxCharactersSlider.value);
    maxCharactersValue.textContent = val.toLocaleString();
    sendSettings();
  });

  clearHistoryBtn.addEventListener('click', async () => {
    await invoke('clear_history');
  });

  const externalLink = document.querySelector('.footer-copyright a');
  if (externalLink) {
    externalLink.addEventListener('click', (event) => {
      event.preventDefault();
      const url = externalLink.href;
      window.open(url, '_blank');
    });
  }
}

function handleSearch(event) {
  const query = event.target.value.toLowerCase().trim();

  if (query === '') {
    filteredHistory = [...historyData];
  } else {
    filteredHistory = historyData.filter(item =>
      item.content.toLowerCase().includes(query)
    );
  }

  selectedIndex = 0;
  renderHistory();
}

function handleKeyboard(event) {
  if (event.key === 'Escape') {
    closeWindow();
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (selectedIndex < filteredHistory.length - 1) {
        selectedIndex++;
        updateSelection();
        scrollToSelected();
      }
      break;

    case 'ArrowUp':
      event.preventDefault();
      if (selectedIndex > 0) {
        selectedIndex--;
        updateSelection();
        scrollToSelected();
      }
      break;

    case 'Enter':
      event.preventDefault();
      if (filteredHistory.length > 0) {
        pasteItem(filteredHistory[selectedIndex]);
      }
      break;

    case 'Delete':
      event.preventDefault();
      if (filteredHistory.length > 0) {
        deleteItem(filteredHistory[selectedIndex]);
      }
      break;

    default:
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        const index = event.key === '0' ? 9 : parseInt(event.key) - 1;
        if (index < filteredHistory.length) {
          pasteItem(filteredHistory[index]);
        }
      }
      break;
  }
}

function updateSelection() {
  const allItems = document.querySelectorAll('.history-item');
  allItems.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function scrollToSelected() {
  const selectedElement = document.querySelector('.history-item.selected');
  if (selectedElement) {
    selectedElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }
}

function pasteItem(item) {
  invoke('paste_item', { content: item.content });
}

function deleteItem(item) {
  const elems = document.querySelectorAll('.history-item');
  if (elems[selectedIndex]) {
    elems[selectedIndex].classList.add('fade-out');
    setTimeout(() => {
      invoke('delete_item', { id: item.id });
    }, 200);
  } else {
    invoke('delete_item', { id: item.id });
  }
}

function closeWindow() {
  const appWindow = getCurrentWindow();
  appWindow.hide();
}

function sendSettings() {
  invoke('update_settings', {
    maxHistory: parseInt(maxHistorySlider.value),
    maxCharacters: parseInt(maxCharactersSlider.value)
  });
}

function renderHistory() {
  const items = historyList.querySelectorAll('.history-item');
  items.forEach(item => item.remove());

  if (filteredHistory.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  filteredHistory.forEach((item, index) => {
    const itemElement = createHistoryItem(item, index);
    historyList.insertBefore(itemElement, emptyState);
  });

  updateSelection();
}

function createHistoryItem(item, index) {
  const container = document.createElement('div');
  container.className = 'history-item';
  container.dataset.id = item.id;

  if (index === selectedIndex) {
    container.classList.add('selected');
  }

  if (index < 10) {
    const indexBadge = document.createElement('div');
    indexBadge.className = 'item-index';
    indexBadge.textContent = index === 9 ? '0' : (index + 1).toString();
    container.appendChild(indexBadge);
  }

  const content = document.createElement('div');
  content.className = 'item-content';
  content.textContent = item.content;
  container.appendChild(content);

  const metadata = document.createElement('div');
  metadata.className = 'item-metadata';

  const charCount = document.createElement('span');
  charCount.innerHTML = `📝 ${item.charCount} characters`;
  metadata.appendChild(charCount);

  const timestamp = document.createElement('span');
  timestamp.innerHTML = `🕒 ${item.timeAgo}`;
  metadata.appendChild(timestamp);

  if (item.isTruncated) {
    const truncatedBadge = document.createElement('span');
    truncatedBadge.className = 'truncated-badge';
    truncatedBadge.textContent = 'TRUNCATED';
    metadata.appendChild(truncatedBadge);
  }

  container.appendChild(metadata);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.title = 'Delete (Del key)';
  deleteBtn.innerHTML = `
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
      </path>
    </svg>
  `;

  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteItem(item);
  });

  container.appendChild(deleteBtn);

  container.addEventListener('click', () => {
    pasteItem(item);
  });

  container.addEventListener('mouseenter', () => {
    selectedIndex = index;
    updateSelection();
  });

  return container;
}

function updateHistoryCounter() {
  if (!historyCounter) return;
  const count = historyData.length;
  const threshold = Math.floor(maxHistoryLimit * 0.8);
  if (count >= threshold) {
    historyCounter.textContent = `${count}/${maxHistoryLimit}`;
    historyCounter.className = 'history-counter warning';
  } else {
    historyCounter.textContent = '';
    historyCounter.className = 'history-counter';
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    themeToggle.checked = false;
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
    themeToggle.checked = true;
  }
}
