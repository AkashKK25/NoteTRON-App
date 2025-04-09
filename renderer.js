// Global notes array
let notesData = {
    notes: []
  };
  
  // DOM Elements
  const notesContainer = document.getElementById('notes-container');
  const addNoteButton = document.getElementById('add-note-button');
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  
  // Initialize the app
  document.addEventListener('DOMContentLoaded', async () => {
    // Load notes from storage
    await loadNotes();
    
    // Set up event listeners
    addNoteButton.addEventListener('click', createNewNote);
    searchInput.addEventListener('input', handleSearch);
    searchButton.addEventListener('click', handleSearch);
    
    // Auto-save notes every 30 seconds
    setInterval(saveNotes, 30000);
    
    // Save notes when window is about to close
    window.addEventListener('beforeunload', () => {
      saveNotes();
    });
  });
  
  // Load notes from storage
  async function loadNotes() {
    try {
      const data = await window.electronAPI.getNotes();
      if (data && data.notes) {
        notesData = data;
        renderNotes();
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }
  
  // Save notes to storage
  async function saveNotes() {
    try {
      await window.electronAPI.saveNotes(notesData);
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  }
  
  // Create a new note and add it to the list
  function createNewNote() {
    const note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    notesData.notes.unshift(note); // Add to the beginning of the array
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
      notesData.notes = notesData.notes.filter(note => note.id !== noteId);
      renderNotes();
      saveNotes();
    }
  }
  
  // Copy note content to clipboard
  function copyNoteContent(noteId) {
    const note = notesData.notes.find(note => note.id === noteId);
    if (note) {
      navigator.clipboard.writeText(note.content)
        .then(() => {
          // Show a temporary success message
          const copyButton = document.querySelector(`.note-card[data-id="${noteId}"] .copy-button i`);
          if (copyButton) {
            copyButton.className = 'fas fa-check';
            setTimeout(() => {
              copyButton.className = 'fas fa-copy';
            }, 2000);
          }
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    }
  }
  
  // Update note title
  function updateNoteTitle(noteId, newTitle) {
    const note = notesData.notes.find(note => note.id === noteId);
    if (note) {
      note.title = newTitle;
      note.updatedAt = new Date().toISOString();
      saveNotes();
    }
  }
  
  // Update note content
  function updateNoteContent(noteId, newContent) {
    const note = notesData.notes.find(note => note.id === noteId);
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
    
    // If opening the note, focus on the content area
    if (contentContainer.classList.contains('active')) {
      const contentArea = contentContainer.querySelector('.note-content');
      contentArea.focus();
    }
  }
  
  // Handle search functionality
  function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
      renderNotes(notesData.notes);
      return;
    }
    
    const filteredNotes = notesData.notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm) || 
      note.content.toLowerCase().includes(searchTerm)
    );
    
    renderNotes(filteredNotes);
  }
  
  // Render notes to the UI
  function renderNotes(notesToRender = null) {
    notesContainer.innerHTML = '';
    
    const notes = notesToRender || notesData.notes;
    
    if (notes.length === 0) {
      notesContainer.innerHTML = `
        <div class="empty-notes">
          <p>No notes yet. Create your first note!</p>
        </div>
      `;
      return;
    }
    
    notes.forEach(note => {
      const noteCard = document.createElement('div');
      noteCard.className = 'note-card';
      noteCard.dataset.id = note.id;
      
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
      
      header.addEventListener('click', (e) => {
        if (e.target !== titleInput && !e.target.closest('.note-actions')) {
          toggleNoteContent(noteCard);
        }
      });
      
      titleInput.addEventListener('input', () => {
        updateNoteTitle(note.id, titleInput.value);
      });
      
      contentTextarea.addEventListener('input', () => {
        updateNoteContent(note.id, contentTextarea.value);
      });
      
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
      });
      
      copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        copyNoteContent(note.id);
      });
    });
  }
  
  // Helper function to escape HTML special characters
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }