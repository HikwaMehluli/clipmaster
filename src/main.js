import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  CATEGORIES, SKIN_TONES, DEFAULT_SKIN_TONE_INDEX,
  getAllEmojis, getEmojisByCategory, searchEmojis, applySkinTone, getEmojiCodepoint, isZwij
} from './emoji-data.js';

let historyData = [];
let filteredHistory = [];
let selectedIndex = 0;
let currentTheme = 'dark';
let maxHistoryLimit = 50;
let maxCharactersLimit = 5000;

let currentTab = 'history';
let emojiData = [];
let filteredEmojis = [];
let emojiSelectedIndex = 0;
let selectedSkinToneIndex = DEFAULT_SKIN_TONE_INDEX;
let activeCategory = 'all';
let emojiGridColumns = 8;

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
const emojiPanel = document.getElementById('emojiPanel');
const skinToneBar = document.getElementById('skinToneBar');
const categoryBar = document.getElementById('categoryBar');
const emojiGrid = document.getElementById('emojiGrid');

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  const data = await invoke('get_initial_data');
  applyData(data);

  emojiData = getAllEmojis();
  filteredEmojis = [...emojiData];
  buildSkinToneBar();
  buildCategoryBar();
  renderEmojiGrid();

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
  switchTab('history');
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

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

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
      openUrl(externalLink.href);
    });
  }

}

function handleSearch(event) {
  const query = event.target.value.toLowerCase().trim();

  if (currentTab === 'history') {
    if (query === '') {
      filteredHistory = [...historyData];
    } else {
      filteredHistory = historyData.filter(item =>
        item.content.toLowerCase().includes(query)
      );
    }
    selectedIndex = 0;
    renderHistory();
  } else {
    if (query === '') {
      filteredEmojis = activeCategory === 'all' ? [...emojiData] : getEmojisByCategory(activeCategory);
    } else {
      filteredEmojis = searchEmojis(query).filter(e =>
        activeCategory === 'all' || e.category === activeCategory
      );
    }
    emojiSelectedIndex = 0;
    renderEmojiGrid();
  }
}

function handleKeyboard(event) {
  if (event.key === 'Escape') {
    closeWindow();
    return;
  }

  if (currentTab === 'emojis' && filteredEmojis.length > 0) {
    handleEmojiKeyboard(event);
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

function handleEmojiKeyboard(event) {
  const cols = emojiGridColumns;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (emojiSelectedIndex + cols < filteredEmojis.length) {
        emojiSelectedIndex += cols;
        updateEmojiSelection();
        scrollEmojiToSelected();
      }
      break;

    case 'ArrowUp':
      event.preventDefault();
      if (emojiSelectedIndex - cols >= 0) {
        emojiSelectedIndex -= cols;
        updateEmojiSelection();
        scrollEmojiToSelected();
      }
      break;

    case 'ArrowRight':
      event.preventDefault();
      if (emojiSelectedIndex < filteredEmojis.length - 1) {
        emojiSelectedIndex++;
        updateEmojiSelection();
        scrollEmojiToSelected();
      }
      break;

    case 'ArrowLeft':
      event.preventDefault();
      if (emojiSelectedIndex > 0) {
        emojiSelectedIndex--;
        updateEmojiSelection();
        scrollEmojiToSelected();
      }
      break;

    case 'Home':
      event.preventDefault();
      emojiSelectedIndex = 0;
      updateEmojiSelection();
      scrollEmojiToSelected();
      break;

    case 'End':
      event.preventDefault();
      emojiSelectedIndex = filteredEmojis.length - 1;
      updateEmojiSelection();
      scrollEmojiToSelected();
      break;

    case 'Enter':
      event.preventDefault();
      if (filteredEmojis.length > 0) {
        copyEmoji(filteredEmojis[emojiSelectedIndex]);
      }
      break;

    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      break;

    default:
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        const index = event.key === '0' ? 9 : parseInt(event.key) - 1;
        if (index < filteredEmojis.length) {
          copyEmoji(filteredEmojis[index]);
        }
      }
      break;
  }
}

function updateSelection() {
  if (currentTab === 'emojis') {
    updateEmojiSelection();
    return;
  }
  const allItems = document.querySelectorAll('.history-item');
  allItems.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function updateEmojiSelection() {
  const cells = document.querySelectorAll('.emoji-cell');
  cells.forEach((cell, index) => {
    if (index === emojiSelectedIndex) {
      cell.classList.add('selected');
      cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      cell.classList.remove('selected');
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

function scrollEmojiToSelected() {
  const cell = document.querySelector('.emoji-cell.selected');
  if (cell) {
    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  appWindow.close();
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

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  historyList.classList.toggle('hidden', tabId === 'emojis');
  emojiPanel.classList.toggle('hidden', tabId === 'history');

  if (tabId === 'emojis') {
    searchInput.placeholder = 'Search emojis...';
    searchInput.value = '';
    filteredEmojis = activeCategory === 'all' ? [...emojiData] : getEmojisByCategory(activeCategory);
    emojiSelectedIndex = 0;
    renderEmojiGrid();
  } else {
    searchInput.placeholder = 'Search clipboard history...';
    searchInput.value = '';
    filteredHistory = [...historyData];
    selectedIndex = 0;
    renderHistory();
  }
  searchInput.focus();
}

function buildSkinToneBar() {
  skinToneBar.innerHTML = '';
  SKIN_TONES.forEach((tone, index) => {
    const btn = document.createElement('button');
    btn.className = 'skin-tone-btn' + (index === selectedSkinToneIndex ? ' selected' : '');
    btn.style.backgroundColor = tone.color;
    btn.title = tone.name;
    btn.addEventListener('click', () => {
      selectedSkinToneIndex = index;
      document.querySelectorAll('.skin-tone-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderEmojiGrid();
    });
    skinToneBar.appendChild(btn);
  });
}

function buildCategoryBar() {
  categoryBar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'category-btn' + (activeCategory === 'all' ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.dataset.cat = 'all';
  allBtn.addEventListener('click', () => selectCategory('all'));
  categoryBar.appendChild(allBtn);

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (activeCategory === cat.id ? ' active' : '');
    btn.textContent = `${cat.icon} ${cat.name}`;
    btn.dataset.cat = cat.id;
    btn.addEventListener('click', () => selectCategory(cat.id));
    categoryBar.appendChild(btn);
  });
}

function selectCategory(categoryId) {
  activeCategory = categoryId;
  categoryBar.querySelectorAll('.category-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === categoryId);
  });

  const query = searchInput.value.toLowerCase().trim();
  if (query) {
    filteredEmojis = searchEmojis(query).filter(e =>
      categoryId === 'all' || e.category === categoryId
    );
  } else {
    filteredEmojis = categoryId === 'all' ? [...emojiData] : getEmojisByCategory(categoryId);
  }
  emojiSelectedIndex = 0;
  renderEmojiGrid();
  searchInput.focus();
}

function renderEmojiGrid() {
  emojiGrid.innerHTML = '';
  emojiGridColumns = Math.floor(emojiGrid.clientWidth / 52) || 8;

  if (filteredEmojis.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'emoji-empty';
    empty.textContent = 'No emojis found';
    emojiGrid.appendChild(empty);
    return;
  }

  filteredEmojis.forEach((item, index) => {
    const cell = document.createElement('button');
    cell.className = 'emoji-cell' + (index === emojiSelectedIndex ? ' selected' : '');
    cell.title = item.name;
    cell.dataset.index = index;

    const stripped = item.emoji.replace(/\uFE0F/g, '');
    const skinToneModifier = SKIN_TONES[selectedSkinToneIndex]?.modifier || '';
    if (item.skinTone && skinToneModifier) {
      cell.textContent = applySkinTone(stripped, skinToneModifier).replace(/\uFE0F/g, '');
    } else if (item.countryCode) {
      cell.textContent = stripped;
    } else if (isZwij(item.emoji)) {
      cell.textContent = [...stripped][0] || stripped;
    } else {
      const img = document.createElement('img');
      img.className = 'emoji-img';
      img.src = `/emojis/${getEmojiCodepoint(item.emoji)}.svg`;
      img.alt = item.name;
      img.loading = 'lazy';
      img.onerror = () => { img.remove(); cell.textContent = stripped; };
      cell.appendChild(img);
    }

    cell.addEventListener('click', () => {
      emojiSelectedIndex = index;
      copyEmoji(item);
    });

    cell.addEventListener('mouseenter', () => {
      emojiSelectedIndex = index;
      updateEmojiSelection();
    });

    emojiGrid.appendChild(cell);
  });
}

function copyEmoji(item) {
  const skinToneModifier = SKIN_TONES[selectedSkinToneIndex]?.modifier || '';
  const emoji = item.skinTone && skinToneModifier
    ? applySkinTone(item.emoji, skinToneModifier)
    : item.emoji;
  invoke('copy_emoji', { emoji });
}
