// Global app state
let appState = {
  notes: [],
  categories: [{ id: 'all', name: 'All Notes' }],
  activeCategory: 'all'
};

// DOM Elements
const notesContainer = document.getElementById('notes-container');
const addNoteButton = document.getElementById('add-note-button');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const categoryList = document.getElementById('category-list');
const addCategoryButton = document.getElementById('add-category-button');
const categoryModal = document.getElementById('category-modal');
const categoryNameInput = document.getElementById('category-name-input');
const saveCategoryButton = document.getElementById('save-category-button');
const exportImportModal = document.getElementById('export-import-modal');
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const importFile = document.getElementById('import-file');
const toastContainer = document.getElementById('toast-container');

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  // Load notes from storage
  await loadNotes();
  
  // Set up event listeners
  setupEventListeners();
  
  // Auto-save notes every 30 seconds
  setInterval(saveNotes, 30000);
  
  // Save notes when window is about to close
  window.addEventListener('beforeunload', () => {
    saveNotes();
  });
});

// Setup event listeners
function setupEventListeners() {
  // Note actions
  addNoteButton.addEventListener('click', createNewNote);
  
  // Search functionality
  if (searchInput && searchButton) {
    // Remove any existing event listeners
    searchInput.removeEventListener('input', handleSearch);
    searchButton.removeEventListener('click', handleSearch);
    
    // Add fresh event listeners
    searchInput.addEventListener('input', handleSearch);
    searchButton.addEventListener('click', handleSearch);
  }
  
  // Category actions
  if (addCategoryButton) {
    addCategoryButton.removeEventListener('click', () => showModal(categoryModal));
    addCategoryButton.addEventListener('click', () => showModal(categoryModal));
  }
  
  if (saveCategoryButton) {
    saveCategoryButton.removeEventListener('click', saveCategory);
    saveCategoryButton.addEventListener('click', saveCategory);
  }
  
  if (categoryList) {
    categoryList.removeEventListener('click', handleCategoryClick);
    categoryList.addEventListener('click', handleCategoryClick);
  }
  
  // Modal actions
  document.querySelectorAll('.close-modal-button').forEach(button => {
    button.removeEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      hideModal(modal);
    });
    
    button.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      hideModal(modal);
    });
  });
  
  // Export/Import actions
  if (exportButton) {
    exportButton.removeEventListener('click', exportNotes);
    exportButton.addEventListener('click', exportNotes);
  }
  
  if (importButton) {
    importButton.removeEventListener('click', importNotes);
    importButton.addEventListener('click', importNotes);
  }
  
  // IPC events from main process
  // Make sure we're not double-registering
  window.electronAPI.onCreateNewNote(() => {
    createNewNote();
  });
  
  window.electronAPI.onShowExportImport(() => {
    showModal(exportImportModal);
  });
  
  // Global event for focus management
  document.addEventListener('click', (e) => {
    // Check if the click happened on an unrelated element
    if (!e.target.closest('.note-card') && 
        !e.target.closest('.modal') &&
        !e.target.closest('.add-note-container') &&
        !e.target.closest('.search-container') &&
        !e.target.closest('.categories-header')) {
      // Focus the document body
      document.body.focus();
    }
  });
}

// Load notes from storage
async function loadNotes() {
  try {
    const data = await window.electronAPI.getNotes();
    if (data) {
      appState.notes = data.notes || [];
      appState.categories = data.categories || [{ id: 'all', name: 'All Notes' }];
      
      renderCategories();
      renderNotes();
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    showToast('Error loading notes: ' + error.message, 'error');
  }
}

// Save notes to storage
async function saveNotes() {
  try {
    await window.electronAPI.saveNotes(appState);
  } catch (error) {
    console.error('Error saving notes:', error);
    showToast('Error saving notes: ' + error.message, 'error');
  }
}

// Create a new note and add it to the list
function createNewNote() {
  const note = {
    id: Date.now().toString(),
    title: 'New Note',
    content: '',
    categoryId: appState.activeCategory !== 'all' ? appState.activeCategory : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  appState.notes.unshift(note); // Add to the beginning of the array
  renderNotes();
  saveNotes();
  
  // Focus on the title of the new note after rendering
  setTimeout(() => {
    const titleInput = document.querySelector(`.note-card[data-id="${note.id}"] .note-title`);
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
    
    // Open the new note automatically
    const noteCard = document.querySelector(`.note-card[data-id="${note.id}"]`);
    if (noteCard) {
      toggleNoteContent(noteCard);
    }
  }, 100);
}

// Delete a note
function deleteNote(noteId) {
  if (confirm('Are you sure you want to delete this note?')) {
    // Store the index of the deleted note to help with focus management
    const noteIndex = appState.notes.findIndex(note => note.id === noteId);
    
    // Filter out the deleted note
    appState.notes = appState.notes.filter(note => note.id !== noteId);
    
    // Render notes first
    renderNotes();
    
    // Save notes
    saveNotes();
    
    // Show success message
    showToast('Note deleted successfully', 'success');
    
    // Focus management - focus on the next available note or container
    if (appState.notes.length > 0) {
      // Try to focus on the note at the same position, or the last note if no note at that position
      const nextIndex = Math.min(noteIndex, appState.notes.length - 1);
      const nextNoteId = appState.notes[nextIndex].id;
      const nextNoteElement = document.querySelector(`.note-card[data-id="${nextNoteId}"]`);
      
      if (nextNoteElement) {
        // Force focus on this note element
        const titleInput = nextNoteElement.querySelector('.note-title');
        if (titleInput) {
          titleInput.focus();
        } else {
          nextNoteElement.focus();
        }
      }
    } else {
      // No notes left, focus on the container
      notesContainer.focus();
    }
    
    // Force window focus refresh - fixes Electron focus issues
    setTimeout(() => {
      if (document.activeElement) {
        const currentFocus = document.activeElement;
        document.body.focus();
        currentFocus.focus();
      }
    }, 50);
  }
}

// Copy note content to clipboard
function copyNoteContent(noteId) {
  const note = appState.notes.find(note => note.id === noteId);
  if (note) {
    try {
      // Focus on the document first to avoid the "document not focused" error
      document.body.focus();
      
      // Use a textarea element as a fallback if the Clipboard API doesn't work
      const textArea = document.createElement('textarea');
      textArea.value = note.content;
      textArea.style.position = 'fixed';  // Prevent scrolling to bottom
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      // Try to use document.execCommand for broader compatibility
      const successful = document.execCommand('copy');
      
      // Clean up
      document.body.removeChild(textArea);
      
      if (successful) {
        // Show success UI
        const copyButton = document.querySelector(`.note-card[data-id="${noteId}"] .copy-button i`);
        if (copyButton) {
          copyButton.className = 'fas fa-check';
          setTimeout(() => {
            copyButton.className = 'fas fa-copy';
          }, 2000);
        }
        
        showToast('Note content copied to clipboard', 'success');
        return;
      } else {
        // Fall back to clipboard API if execCommand didn't work
        navigator.clipboard.writeText(note.content)
          .then(() => {
            // Show success UI
            const copyButton = document.querySelector(`.note-card[data-id="${noteId}"] .copy-button i`);
            if (copyButton) {
              copyButton.className = 'fas fa-check';
              setTimeout(() => {
                copyButton.className = 'fas fa-copy';
              }, 2000);
            }
            
            showToast('Note content copied to clipboard', 'success');
          })
          .catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy text: ' + err.message, 'error');
          });
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy text: ' + err.message, 'error');
    }
  }
}

// Update note title
function updateNoteTitle(noteId, newTitle) {
  const note = appState.notes.find(note => note.id === noteId);
  if (note) {
    note.title = newTitle;
    note.updatedAt = new Date().toISOString();
    saveNotes();
  }
}

// Update note content
function updateNoteContent(noteId, newContent) {
  const note = appState.notes.find(note => note.id === noteId);
  if (note) {
    note.content = newContent;
    note.updatedAt = new Date().toISOString();
    saveNotes();
  }
}

// Toggle note content visibility
function toggleNoteContent(noteCard) {
  const dropdownIcon = noteCard.querySelector('.dropdown-icon');
  const contentContainer = noteCard.querySelector('.note-content-container');
  
  dropdownIcon.classList.toggle('active');
  contentContainer.classList.toggle('active');
  
  // Update content container max-height based on content
  if (contentContainer.classList.contains('active')) {
    const contentTextarea = contentContainer.querySelector('.note-content');
    
    // Set initial height
    contentTextarea.style.height = 'auto';
    
    // Add an event listener for input to adjust height dynamically
    if (!contentTextarea.hasAttribute('data-resize-listener')) {
      contentTextarea.setAttribute('data-resize-listener', 'true');
      contentTextarea.addEventListener('input', function() {
        // Reset the height to auto, then set it to scrollHeight to expand the textarea
        this.style.height = 'auto';
        this.style.height = Math.max(150, this.scrollHeight) + 'px';
      });
      
      // Trigger the input event to set the correct height initially
      const inputEvent = new Event('input');
      contentTextarea.dispatchEvent(inputEvent);
    }
    
    // Focus on the content area
    contentTextarea.focus();
  }
}

// Handle search functionality
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (searchTerm === '') {
    // Reset to active category view
    renderNotes();
    return;
  }
  
  // Create a copy of the notes array before filtering
  const filteredNotes = [...appState.notes].filter(note => 
    (note.title.toLowerCase().includes(searchTerm) || 
     note.content.toLowerCase().includes(searchTerm)) &&
    (appState.activeCategory === 'all' || note.categoryId === appState.activeCategory)
  );
  
  renderNotes(filteredNotes);
}

// Move note to a different category
function moveNoteToCategory(noteId, categoryId) {
  const note = appState.notes.find(note => note.id === noteId);
  
  if (note) {
    // Check if we're trying to move to the same category
    if ((note.categoryId === categoryId) || 
        (categoryId === 'all' && note.categoryId === null)) {
      return; // No change needed
    }
    
    // Update the note's category
    note.categoryId = categoryId === 'all' ? null : categoryId;
    note.updatedAt = new Date().toISOString();
    
    // Save changes
    saveNotes();
    
    // Update UI to reflect the change
    const categoryButton = document.querySelector(`.note-card[data-id="${noteId}"] .category-button i`);
    if (categoryButton) {
      if (note.categoryId) {
        // Note is in a category
        categoryButton.className = 'fas fa-folder-open';
        categoryButton.style.color = 'var(--accent-color)';
      } else {
        // Note is in "All Notes"
        categoryButton.className = 'fas fa-folder';
        categoryButton.style.color = '';
      }
    }
    
    // If we're in a category view and removing a note from this category,
    // we need to update the UI
    if (appState.activeCategory !== 'all' && note.categoryId !== appState.activeCategory) {
      renderNotes(); // Re-render to remove the note from view
    }
    
    // Show notification
    const categoryName = categoryId === 'all' ? 'All Notes' : 
      appState.categories.find(cat => cat.id === categoryId)?.name || 'Unknown Category';
    
    showToast(`Note moved to "${categoryName}"`, 'success');
  }
}

// Create a new category
function saveCategory() {
  const categoryName = categoryNameInput.value.trim();
  
  if (!categoryName) {
    showToast('Category name cannot be empty', 'error');
    return;
  }
  
  // Check for duplicate category names
  if (appState.categories.some(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
    showToast('A category with this name already exists', 'error');
    return;
  }
  
  const category = {
    id: 'category_' + Date.now().toString(),
    name: categoryName
  };
  
  appState.categories.push(category);
  saveNotes();
  renderCategories();
  
  // Clear input and hide modal
  categoryNameInput.value = '';
  hideModal(categoryModal);
  
  showToast(`Category "${categoryName}" created`, 'success');
}

// Delete a category
function deleteCategory(categoryId) {
  const category = appState.categories.find(cat => cat.id === categoryId);
  
  if (!category) return;
  
  if (confirm(`Are you sure you want to delete category "${category.name}"? Notes in this category will not be deleted but will be moved to "All Notes".`)) {
    // Move all notes in this category to "All Notes"
    appState.notes.forEach(note => {
      if (note.categoryId === categoryId) {
        note.categoryId = null;
      }
    });
    
    // Remove the category
    appState.categories = appState.categories.filter(cat => cat.id !== categoryId);
    
    // If the active category was deleted, switch to "All Notes"
    if (appState.activeCategory === categoryId) {
      appState.activeCategory = 'all';
    }
    
    // Update UI first
    saveNotes();
    renderCategories();
    renderNotes();
    
    // Show toast
    showToast(`Category "${category.name}" deleted`, 'success');
    
    // Force focus on the "All Notes" category
    const allNotesCategory = document.querySelector('.category-item[data-id="all"]');
    if (allNotesCategory) {
      allNotesCategory.focus();
    }
    
    // Force window focus refresh - fixes Electron focus issues
    setTimeout(() => {
      if (document.activeElement) {
        const currentFocus = document.activeElement;
        document.body.focus();
        currentFocus.focus();
      }
    }, 50);
  }
}

// Handle category click events
function handleCategoryClick(e) {
  const categoryItem = e.target.closest('.category-item');
  if (!categoryItem) return;
  
  const actionButton = e.target.closest('.category-action-button');
  if (actionButton) {
    // Handle action button clicks
    if (actionButton.classList.contains('delete-category-button')) {
      const categoryId = categoryItem.dataset.id;
      deleteCategory(categoryId);
    }
    return;
  }
  
  // Handle category selection
  const categoryId = categoryItem.dataset.id;
  if (categoryId) {
    appState.activeCategory = categoryId;
    
    // Update active class
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === categoryId);
    });
    
    renderNotes();
  }
}

// Export notes
async function exportNotes() {
  try {
    const result = await window.electronAPI.exportNotes();
    
    if (result.success) {
      showToast('Notes exported successfully', 'success');
      hideModal(exportImportModal);
    } else {
      showToast('Export failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Error exporting notes:', error);
    showToast('Error exporting notes: ' + error.message, 'error');
  }
}

// Import notes
async function importNotes() {
  const fileInput = importFile;
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('Please select a file to import', 'error');
    return;
  }
  
  try {
    const fileContent = await readFile(file);
    const importData = JSON.parse(fileContent);
    
    const result = await window.electronAPI.importNotes(importData);
    
    if (result.success) {
      // Update app state with the merged data
      appState = result.data;
      
      renderCategories();
      renderNotes();
      
      const message = `Import successful: Added ${result.stats.importedNotes} notes and ${result.stats.importedCategories} categories`;
      showToast(message, 'success');
      
      hideModal(exportImportModal);
      fileInput.value = ''; // Clear the file input
    } else {
      showToast('Import failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Error importing notes:', error);
    showToast('Error importing notes: ' + error.message, 'error');
  }
}

// Helper function to read file content
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file);
  });
}

// Show a modal
function showModal(modal) {
  if (modal) {
    modal.classList.add('active');
  }
}

// Hide a modal
function hideModal(modal) {
  if (modal) {
    modal.classList.remove('active');
  }
}

// Show a toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Render categories to the UI
function renderCategories() {
  // Preserve the "All Notes" category
  const allNotesCategory = categoryList.querySelector('[data-id="all"]');
  
  // Clear the category list except for "All Notes"
  categoryList.innerHTML = '';
  
  // Re-add "All Notes" category
  categoryList.appendChild(allNotesCategory);
  
  // Add other categories
  appState.categories
    .filter(category => category.id !== 'all')
    .forEach(category => {
      const categoryItem = document.createElement('li');
      categoryItem.className = 'category-item';
      categoryItem.dataset.id = category.id;
      
      if (category.id === appState.activeCategory) {
        categoryItem.classList.add('active');
      }
      
      categoryItem.innerHTML = `
        <span class="category-name">${escapeHtml(category.name)}</span>
        <div class="category-actions">
          <button class="category-action-button delete-category-button" title="Delete Category">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      categoryList.appendChild(categoryItem);
    });
}

// Render notes to the UI
function renderNotes(notesToRender = null) {
  // Clear the container first
  notesContainer.innerHTML = '';
  
  // If notesToRender is provided, use that array
  // Otherwise, filter notes based on active category
  const notes = notesToRender || 
    (appState.activeCategory === 'all' 
      ? appState.notes 
      : appState.notes.filter(note => note.categoryId === appState.activeCategory));
  
  if (notes.length === 0) {
    notesContainer.innerHTML = `
      <div class="empty-notes">
        <p>${notesToRender ? 'No notes match your search.' : 'No notes in this category yet.'}</p>
        <p>Click the + button below to create a new note.</p>
      </div>
    `;
    return;
  }
  
  notes.forEach(note => {
    const noteCard = document.createElement('div');
    noteCard.className = 'note-card';
    noteCard.dataset.id = note.id;
    noteCard.tabIndex = "0"; // Make focusable
    
    // Determine if the note is assigned to a specific category
    const isInCategory = note.categoryId !== null;
    
    noteCard.innerHTML = `
      <div class="note-header">
        <div class="dropdown-icon">
          <i class="fas fa-caret-down"></i>
        </div>
        <input 
          type="text" 
          class="note-title" 
          value="${escapeHtml(note.title)}" 
          placeholder="Note Title"
        >
        <div class="note-actions">
          <button class="note-action-button copy-button" title="Copy Content">
            <i class="fas fa-copy"></i>
          </button>
          <button class="note-action-button category-button" title="Move to Category">
            <i class="fas ${isInCategory ? 'fa-folder-open' : 'fa-folder'}" 
               ${isInCategory ? 'style="color: var(--accent-color);"' : ''}></i>
          </button>
          <button class="note-action-button delete-button" title="Delete Note">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="note-content-container">
        <textarea class="note-content" placeholder="Write your note here...">${escapeHtml(note.content)}</textarea>
      </div>
    `;
    
    notesContainer.appendChild(noteCard);
    
    // Add event listeners
    const header = noteCard.querySelector('.note-header');
    const titleInput = noteCard.querySelector('.note-title');
    const contentTextarea = noteCard.querySelector('.note-content');
    const deleteButton = noteCard.querySelector('.delete-button');
    const copyButton = noteCard.querySelector('.copy-button');
    const categoryButton = noteCard.querySelector('.category-button');
    
    // Check for null elements before adding event listeners
    if (header) {
      header.addEventListener('click', (e) => {
        // Prevent triggering when clicking on input or buttons
        if (e.target !== titleInput && !e.target.closest('.note-actions')) {
          toggleNoteContent(noteCard);
        }
      });
    }
    
    if (titleInput) {
      // Prevent the click from triggering the header click
      titleInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      // Handle input changes
      titleInput.addEventListener('input', () => {
        updateNoteTitle(note.id, titleInput.value);
      });
      
      // Focus management
      titleInput.addEventListener('focus', (e) => {
        e.stopPropagation();
      });
      
      titleInput.addEventListener('blur', (e) => {
        // Trim title and update if empty
        if (titleInput.value.trim() === '') {
          titleInput.value = 'Untitled Note';
          updateNoteTitle(note.id, titleInput.value);
        }
      });
    }
    
    if (contentTextarea) {
      // Add input event
      contentTextarea.addEventListener('input', () => {
        updateNoteContent(note.id, contentTextarea.value);
        
        // Dynamic height adjustment
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = Math.max(150, contentTextarea.scrollHeight) + 'px';
      });
      
      // Focus management
      contentTextarea.addEventListener('focus', (e) => {
        e.stopPropagation();
      });
      
      // Prevent bubbling
      contentTextarea.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    if (deleteButton) {
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
      });
    }
    
    if (copyButton) {
      copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        copyNoteContent(note.id);
      });
    }
    
    if (categoryButton) {
      categoryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showCategoryDropdown(note.id, e.target);
      });
    }
  });
}

// Show category dropdown menu for moving notes
function showCategoryDropdown(noteId, target) {
  // Get the current note to determine its category
  const note = appState.notes.find(note => note.id === noteId);
  const currentCategoryId = note ? note.categoryId : null;
  
  // Remove any existing dropdown
  const existingDropdown = document.querySelector('.dropdown-menu');
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  // Create a new dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu';
  
  // Add "All Notes" option
  const allNotesItem = document.createElement('div');
  allNotesItem.className = `dropdown-item ${currentCategoryId === null ? 'dropdown-item-active' : ''}`;
  allNotesItem.dataset.categoryId = 'all';
  allNotesItem.innerHTML = `
    <i class="fas fa-folder"></i> All Notes
    ${currentCategoryId === null ? '<span class="dropdown-active-indicator">✓</span>' : ''}
  `;
  dropdown.appendChild(allNotesItem);
  
  // Add other categories
  appState.categories
    .filter(category => category.id !== 'all')
    .forEach(category => {
      const categoryItem = document.createElement('div');
      categoryItem.className = `dropdown-item ${currentCategoryId === category.id ? 'dropdown-item-active' : ''}`;
      categoryItem.dataset.categoryId = category.id;
      categoryItem.innerHTML = `
        <i class="fas fa-folder"></i> ${escapeHtml(category.name)}
        ${currentCategoryId === category.id ? '<span class="dropdown-active-indicator">✓</span>' : ''}
      `;
      dropdown.appendChild(categoryItem);
    });
  
  // Position the dropdown
  const buttonRect = target.closest('.category-button').getBoundingClientRect();
  dropdown.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
  dropdown.style.left = `${buttonRect.left + window.scrollX - 100}px`;
  
  // Add event listeners
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (item) {
      const categoryId = item.dataset.categoryId;
      if (categoryId) {
        moveNoteToCategory(noteId, categoryId);
      }
      dropdown.remove();
    }
  });
  
  // Add the dropdown to the document
  document.body.appendChild(dropdown);
  
  // Add a class to make it visible after it's added to the DOM
  setTimeout(() => {
    dropdown.classList.add('active');
  }, 10);
  
  // Close dropdown when clicking outside of it
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !target.closest('.category-button').contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };
  
  // Use a timeout to avoid the dropdown being immediately closed
  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 10);
}

// Helper to force focus refresh when needed
function refreshFocus(element) {
  if (!element) return;
  
  setTimeout(() => {
    // Force document body focus first
    document.body.focus();
    // Then refocus the intended element
    element.focus();
  }, 50);
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}