import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class KeepView extends View {
    constructor(app) {
        super(app);
        this.unsubscribe = null;
        this.currentArea = this.app.currentUser.area || 'Ventas';
        this.areas = ['Ventas', 'Supervisión', 'Relaciones Públicas', 'Marketing', 'Operaciones', 'Recursos Humanos'];
        this.currentColor = 'k-color-default';
        this.currentBgImage = '';
        this.isListMode = false;
        this.allNotes = [];
        this.teamMembers = [];
        this.currentTab = 'active';
    }

    async render() {
        const container = this.createEl('div', 'keep-view-wrapper fade-in');
        
        // Determinar si es gerente
        const isManager = this.app.currentUser.role === 'gerente';
        
        let areaFiltersHtml = '';
        if (isManager) {
            areaFiltersHtml = `
                <div class="keep-area-filters" id="keep-area-filters">
                    ${this.areas.map(area => `
                        <button class="keep-area-btn ${area === this.currentArea ? 'active' : ''}" data-area="${area}">
                            ${area}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="keep-view-container">
                ${areaFiltersHtml}

                <div class="keep-tabs-container">
                    <button class="keep-tab-btn active" id="keep-tab-active">Notas</button>
                    <button class="keep-tab-btn" id="keep-tab-archived">Archivo (30d)</button>
                </div>

                <!-- Quick Input -->
                <div class="keep-quick-input-container">
                    <div class="keep-quick-input collapsed ${this.currentColor}" id="quick-input-card">
                        
                        <input type="text" id="quick-title" class="keep-input-title" placeholder="Título">
                        
                        <div id="quick-list-container" style="padding: 0 16px;">
                            <div id="quick-list-items"></div>
                            <button class="keep-add-list-btn" id="quick-add-list-btn">
                                <span>+</span> Elemento de lista
                            </button>
                        </div>

                        <textarea id="quick-body" class="keep-input-body" placeholder="Añade una nota..."></textarea>
                        
                        <div class="keep-fake-icons">
                            <button class="keep-tool-btn" id="fake-list-btn" title="Nueva lista">☑️</button>
                        </div>

                        <div class="keep-quick-actions">
                            <div class="keep-toolbar">
                                <button class="keep-tool-btn" id="quick-list-toggle" title="Nueva lista">☑️</button>
                                <button class="keep-tool-btn" id="quick-color-btn" title="Color de fondo">🎨</button>
                                <!-- Color Palette -->
                                <div class="keep-color-palette hidden" id="quick-color-palette">
                                    ${this.renderColorSwatches()}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="keep-close-btn" id="quick-close-btn">Cerrar</button>
                                <button class="keep-save-btn" id="quick-save-btn">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>

            <!-- Secciones de Notas -->
            <div id="keep-pinned-section" class="hidden">
                <h3 class="keep-section-title">Fijadas</h3>
                <div class="keep-masonry" id="keep-pinned-masonry"></div>
            </div>

            <div id="keep-others-section">
                <h3 class="keep-section-title hidden" id="keep-others-title">Otras</h3>
                <div class="keep-masonry" id="keep-others-masonry">
                    <div class="loading-inline">Cargando notas de ${this.currentArea}...</div>
                </div>
            </div>

            </div> <!-- End container -->

            <!-- Modal de Edición -->
            <div class="keep-modal-overlay" id="keep-edit-modal">
                <div class="keep-modal-content" id="edit-modal-card">
                    <div class="keep-modal-body">
                        <input type="hidden" id="edit-note-id">
                        <input type="text" id="edit-title" class="keep-input-title" style="display:block; padding: 0 0 16px 0;" placeholder="Título">
                        
                        <div id="edit-list-container" class="hidden">
                            <div id="edit-list-items"></div>
                            <button class="keep-add-list-btn" id="edit-add-list-btn">
                                <span>+</span> Elemento de lista
                            </button>
                        </div>
                        
                        <textarea id="edit-body" class="keep-input-body" style="padding: 0;" placeholder="Añade una nota..."></textarea>
                    </div>
                    <div class="keep-modal-footer">
                        <div class="keep-toolbar">
                            <button class="keep-tool-btn" id="edit-color-btn" title="Color de fondo">🎨</button>
                            <div class="keep-color-palette hidden" id="edit-color-palette">
                                ${this.renderColorSwatches('edit')}
                            </div>
                            <button class="keep-tool-btn" id="edit-archive-btn" title="Archivar">📦</button>
                            <button class="keep-tool-btn" id="edit-delete-btn" title="Eliminar nota">🗑️</button>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="keep-close-btn" id="edit-close-btn">Cerrar</button>
                            <button class="keep-save-btn" id="edit-save-btn">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return container;
    }

    renderColorSwatches(prefix = 'quick') {
        const colors = [
            'k-color-default', 'k-color-red', 'k-color-orange', 'k-color-yellow', 
            'k-color-green', 'k-color-teal', 'k-color-blue', 'k-color-darkblue', 
            'k-color-purple', 'k-color-pink', 'k-color-brown', 'k-color-gray'
        ];
        
        const patterns = [
            { id: '', label: 'Sin ilustración', emoji: '🚫', class: 'k-bg-none' },
            { id: 'k-bg-reading', label: 'Lectura / Libros', emoji: '📚', class: 'k-bg-reading-swatch' },
            { id: 'k-bg-art', label: 'Arte / Dibujo', emoji: '🎨', class: 'k-bg-art-swatch' },
            { id: 'k-bg-nature', label: 'Naturaleza / Plantas', emoji: '🌿', class: 'k-bg-nature-swatch' },
            { id: 'k-bg-music', label: 'Música y Canción', emoji: '🎵', class: 'k-bg-music-swatch' },
            { id: 'k-bg-food', label: 'Recetas y Comida', emoji: '🍽️', class: 'k-bg-food-swatch' },
            { id: 'k-bg-balloons', label: 'Fiesta y Globos', emoji: '🎈', class: 'k-bg-balloons-swatch' }
        ];

        const colorsHtml = colors.map(c => `
            <div class="keep-color-swatch ${c}" data-color="${c}" data-target="${prefix}" title="Color"></div>
        `).join('');

        const patternsHtml = patterns.map(p => `
            <div class="keep-pattern-swatch ${p.class}" data-pattern="${p.id}" data-target="${prefix}" title="${p.label}">
                <span style="font-size: 1.1rem; line-height: 1;">${p.emoji}</span>
            </div>
        `).join('');

        return `
            <div class="keep-palette-container">
                <div class="keep-palette-title">Colores</div>
                <div class="keep-palette-row">${colorsHtml}</div>
                <div class="keep-palette-divider"></div>
                <div class="keep-palette-title">Ilustraciones Temáticas</div>
                <div class="keep-palette-row">${patternsHtml}</div>
            </div>
        `;
    }

    async afterRender() {
        this.app.showNavigation();
        try {
            this.teamMembers = await FirebaseService.getAllMembers();
        } catch (error) {
            console.error("Error loading team members:", error);
        }
        this.currentTab = 'active';
        this.setupTabs();
        this.setupQuickInput();
        this.setupEditModal();
        this.setupAreaFilters();
        this.cleanOldArchivedNotes();
        this.listenToNotes();
    }

    setupTabs() {
        const tabActive = document.getElementById('keep-tab-active');
        const tabArchived = document.getElementById('keep-tab-archived');
        const quickInputContainer = document.querySelector('.keep-quick-input-container');

        if (!tabActive || !tabArchived) return;

        tabActive.onclick = () => {
            if (this.currentTab === 'active') return;
            this.currentTab = 'active';
            tabActive.classList.add('active');
            tabArchived.classList.remove('active');
            if (quickInputContainer) quickInputContainer.style.display = 'block';
            this.listenToNotes();
        };

        tabArchived.onclick = () => {
            if (this.currentTab === 'archived') return;
            this.currentTab = 'archived';
            tabArchived.classList.add('active');
            tabActive.classList.remove('active');
            if (quickInputContainer) quickInputContainer.style.display = 'none';
            this.listenToNotes();
        };
    }

    async cleanOldArchivedNotes() {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        try {
            const snapshot = await db.collection('keep_notes')
                .where('isArchived', '==', true)
                .get();
                
            const batch = db.batch();
            let count = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const updatedTime = data.updatedAt ? data.updatedAt.toDate().getTime() : 0;
                if (updatedTime && updatedTime < thirtyDaysAgo) {
                    batch.delete(doc.ref);
                    count++;
                }
            });
            
            if (count > 0) {
                await batch.commit();
                console.log(`[Keep Cleanup] Eliminadas ${count} notas archivadas con más de 30 días.`);
            }
        } catch (error) {
            console.error("Error al limpiar notas archivadas antiguas:", error);
        }
    }

    setupAreaFilters() {
        const filters = document.getElementById('keep-area-filters');
        if (!filters) return;

        filters.querySelectorAll('.keep-area-btn').forEach(btn => {
            btn.onclick = () => {
                filters.querySelectorAll('.keep-area-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentArea = btn.dataset.area;
                
                // Actualizar título
                const titleP = document.querySelector('.view-header p');
                if (titleP) titleP.textContent = `Notas y listas por área: ${this.currentArea}`;

                this.listenToNotes();
            };
        });
    }

    setupQuickInput() {
        const card = document.getElementById('quick-input-card');
        const bodyInput = document.getElementById('quick-body');
        const titleInput = document.getElementById('quick-title');
        const saveBtn = document.getElementById('quick-save-btn');
        const listToggle = document.getElementById('quick-list-toggle');
        const fakeListBtn = document.getElementById('fake-list-btn');
        const colorBtn = document.getElementById('quick-color-btn');
        const colorPalette = document.getElementById('quick-color-palette');
        const addListBtn = document.getElementById('quick-add-list-btn');

        const expandCard = () => {
            if (card.classList.contains('collapsed')) {
                card.classList.remove('collapsed');
                card.classList.add('expanded');
                if (this.isListMode) {
                    bodyInput.classList.add('hidden');
                    document.getElementById('quick-list-container').style.display = 'block';
                    if (document.getElementById('quick-list-items').children.length === 0) {
                        this.addQuickListItem();
                    }
                } else {
                    bodyInput.classList.remove('hidden');
                    document.getElementById('quick-list-container').style.display = 'none';
                    bodyInput.focus();
                }
            }
        };

        // Expandir al hacer clic
        bodyInput.addEventListener('focus', expandCard);
        titleInput.addEventListener('focus', expandCard);
        card.addEventListener('click', expandCard);

        const enableListMode = (e) => {
            if (e) e.stopPropagation();
            this.isListMode = true;
            document.getElementById('quick-list-container').style.display = 'block';
            bodyInput.classList.add('hidden');
            listToggle.classList.add('active');
            expandCard();
            if (document.getElementById('quick-list-items').children.length === 0) {
                this.addQuickListItem();
            }
        };

        const disableListMode = (e) => {
            if (e) e.stopPropagation();
            this.isListMode = false;
            document.getElementById('quick-list-container').style.display = 'none';
            bodyInput.classList.remove('hidden');
            listToggle.classList.remove('active');
            bodyInput.focus();
        };

        // Toggle List Mode
        listToggle.onclick = (e) => {
            if (this.isListMode) disableListMode(e);
            else enableListMode(e);
        };

        fakeListBtn.onclick = (e) => {
            enableListMode(e);
        };

        // Add list item
        addListBtn.onclick = () => this.addQuickListItem();

        // Color Palette
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            colorPalette.classList.toggle('hidden');
        };

        colorPalette.querySelectorAll('.keep-color-swatch').forEach(swatch => {
            swatch.onclick = (e) => {
                e.stopPropagation();
                const newColor = swatch.dataset.color;
                card.className = `keep-quick-input expanded ${newColor} ${this.currentBgImage}`;
                this.currentColor = newColor;
                colorPalette.classList.add('hidden');
            };
        });

        colorPalette.querySelectorAll('.keep-pattern-swatch').forEach(swatch => {
            swatch.onclick = (e) => {
                e.stopPropagation();
                const newPattern = swatch.dataset.pattern;
                card.className = `keep-quick-input expanded ${this.currentColor} ${newPattern}`;
                this.currentBgImage = newPattern;
                colorPalette.classList.add('hidden');
            };
        });

        // Click outside to close color palette
        document.addEventListener('click', (e) => {
            if (!colorBtn.contains(e.target) && !colorPalette.contains(e.target)) {
                colorPalette.classList.add('hidden');
            }
            // Collapse quick input if clicked outside and empty
            if (!card.contains(e.target) && card.classList.contains('expanded')) {
                if (!titleInput.value.trim() && !bodyInput.value.trim() && this.getQuickListItems().length === 0) {
                    this.resetQuickInput();
                }
            }
        });

        // Auto-resize textarea
        bodyInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        // Guardar
        saveBtn.onclick = () => this.saveQuickNote();

        // Cerrar (Cancelar sin guardar)
        const closeBtn = document.getElementById('quick-close-btn');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.resetQuickInput();
            };
        }
    }

    addQuickListItem(text = '', checked = false) {
        const container = document.getElementById('quick-list-items');
        const id = 'ql_' + Date.now() + Math.random().toString(36).substr(2, 9);
        const div = document.createElement('div');
        div.className = 'keep-edit-list-item';
        div.innerHTML = `
            <input type="checkbox" ${checked ? 'checked' : ''}>
            <input type="text" value="${text}" placeholder="Elemento de lista">
            <button class="keep-edit-list-del">✕</button>
        `;
        
        div.querySelector('.keep-edit-list-del').onclick = () => div.remove();
        div.querySelector('input[type="text"]').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addQuickListItem();
                container.lastElementChild.querySelector('input[type="text"]').focus();
            }
        });

        container.appendChild(div);
    }

    getQuickListItems() {
        const items = [];
        document.getElementById('quick-list-items').querySelectorAll('.keep-edit-list-item').forEach(el => {
            const text = el.querySelector('input[type="text"]').value.trim();
            const checked = el.querySelector('input[type="checkbox"]').checked;
            if (text) items.push({ text, checked });
        });
        return items;
    }

    resetQuickInput() {
        const card = document.getElementById('quick-input-card');
        card.className = 'keep-quick-input collapsed k-color-default';
        this.currentColor = 'k-color-default';
        this.currentBgImage = '';
        this.isListMode = false;
        
        document.getElementById('quick-title').value = '';
        const bodyInput = document.getElementById('quick-body');
        bodyInput.value = '';
        bodyInput.style.height = '46px';
        bodyInput.classList.remove('hidden');
        
        document.getElementById('quick-list-container').style.display = 'none';
        document.getElementById('quick-list-items').innerHTML = '';
        document.getElementById('quick-list-toggle').classList.remove('active');
    }

    async saveQuickNote() {
        const title = document.getElementById('quick-title').value.trim();
        const type = this.isListMode ? 'list' : 'text';
        const content = document.getElementById('quick-body').value.trim();
        const checklist = this.isListMode ? this.getQuickListItems() : [];

        if (!title && !content && checklist.length === 0) {
            this.resetQuickInput();
            return;
        }

        const note = {
            area: this.currentArea,
            title,
            type,
            content: type === 'text' ? content : '',
            checklist,
            color: this.currentColor,
            backgroundImage: this.currentBgImage,
            isPinned: false,
            isArchived: false,
            tags: [],
            createdBy: this.app.currentUser.uid,
            createdByName: this.app.currentUser.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('keep_notes').add(note);
            this.resetQuickInput();
        } catch (error) {
            console.error("Error guardando nota:", error);
            ToastService.error("Error al guardar la nota.");
        }
    }

    listenToNotes() {
        if (this.unsubscribe) this.unsubscribe();

        const othersContainer = document.getElementById('keep-others-masonry');
        othersContainer.innerHTML = `<div class="loading-inline">Cargando notas de ${this.currentArea}...</div>`;

        const isArchivedMode = this.currentTab === 'archived';

        this.unsubscribe = db.collection('keep_notes')
            .where('area', '==', this.currentArea)
            .where('isArchived', '==', isArchivedMode)
            .onSnapshot(snapshot => {
                let notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (isArchivedMode) {
                    // Filtrar solo las archivadas en los últimos 30 días
                    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                    notes = notes.filter(n => {
                        const t = n.updatedAt ? n.updatedAt.toDate().getTime() : 0;
                        return t >= thirtyDaysAgo;
                    });
                }
                
                this.allNotes = notes;
                
                // Ordenar por fecha de actualización descendente
                notes.sort((a, b) => {
                    const timeA = a.updatedAt ? a.updatedAt.toMillis() : 0;
                    const timeB = b.updatedAt ? b.updatedAt.toMillis() : 0;
                    return timeB - timeA;
                });

                if (isArchivedMode) {
                    const pinnedSection = document.getElementById('keep-pinned-section');
                    if (pinnedSection) pinnedSection.classList.add('hidden');
                    
                    this.renderNotes(notes, 'keep-others-masonry', 'keep-others-section', false);
                    
                    if (notes.length === 0) {
                        othersContainer.innerHTML = `
                            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-dim);">
                                <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">📦</span>
                                <p style="font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 600; margin: 0 0 0.5rem 0;">No hay notas archivadas en los últimos 30 días</p>
                                <span style="font-size: 0.85rem; color: var(--text-dim); display: block;">Las notas aquí archivadas se eliminarán automáticamente después de 30 días.</span>
                            </div>
                        `;
                    }
                } else {
                    const pinned = notes.filter(n => n.isPinned);
                    const others = notes.filter(n => !n.isPinned);

                    this.renderNotes(pinned, 'keep-pinned-masonry', 'keep-pinned-section');
                    this.renderNotes(others, 'keep-others-masonry', 'keep-others-section', pinned.length > 0);
                }
            }, error => {
                console.error("Error al escuchar notas:", error);
                othersContainer.innerHTML = '<p class="error-msg">Error de permisos o conexión al cargar las notas.</p>';
            });
    }

    renderNotes(notes, containerId, sectionId, showOthersTitle = false) {
        const container = document.getElementById(containerId);
        const section = document.getElementById(sectionId);
        
        if (notes.length === 0) {
            if (sectionId === 'keep-pinned-section') {
                section.classList.add('hidden');
            } else {
                container.innerHTML = '';
                if (!showOthersTitle) section.querySelector('.keep-section-title')?.classList.add('hidden');
            }
            return;
        }

        section.classList.remove('hidden');
        if (sectionId === 'keep-others-section') {
            const titleEl = section.querySelector('.keep-section-title');
            if (titleEl) titleEl.classList.toggle('hidden', !showOthersTitle);
        }

        container.innerHTML = notes.map(note => this.generateNoteHtml(note)).join('');

        // Container-level drag and drop (Google Keep-style smooth layout flow)
        container.ondragover = (e) => {
            e.preventDefault();
            const dragged = this.draggedCard;
            if (!dragged) return;

            // Encontrar elemento más cercano para insertar la tarjeta usando coordenadas 2D (clientX, clientY)
            const afterElement = this.getDragAfterElement(container, e.clientX, e.clientY);
            
            // Crear el placeholder si no existe
            if (!this.placeholder) {
                this.placeholder = document.createElement('div');
                this.placeholder.className = 'keep-note-placeholder';
                this.placeholder.style.height = `${dragged.offsetHeight}px`;
            }

            if (afterElement == null) {
                container.appendChild(this.placeholder);
            } else {
                container.insertBefore(this.placeholder, afterElement);
            }
        };

        container.ondrop = async (e) => {
            e.preventDefault();
            const dragged = this.draggedCard;
            if (!dragged) return;

            const draggedId = dragged.dataset.id;
            
            // Limpiar placeholder
            if (this.placeholder && this.placeholder.parentNode) {
                this.placeholder.parentNode.removeChild(this.placeholder);
            }
            this.placeholder = null;

            // Determinar si es fijada o normal según el contenedor destino
            const targetIsPinned = (containerId === 'keep-pinned-masonry');

            // Posicionar la tarjeta visualmente en el DOM para calcular el nuevo índice
            const afterElement = this.getDragAfterElement(container, e.clientX, e.clientY);
            if (afterElement == null) {
                container.appendChild(dragged);
            } else {
                container.insertBefore(dragged, afterElement);
            }

            // Calcular orden basado en interpolación matemática de timestamps (1 solo write a Firestore)
            const cards = [...container.querySelectorAll('.keep-note')];
            const draggedIndex = cards.indexOf(dragged);
            
            try {
                let newTime;
                if (cards.length === 1) {
                    newTime = new Date();
                } else if (draggedIndex === 0) {
                    const nextCardId = cards[1].dataset.id;
                    const nextNote = notes.find(n => n.id === nextCardId) || {};
                    const nextTime = nextNote.updatedAt ? nextNote.updatedAt.toDate().getTime() : Date.now();
                    newTime = new Date(nextTime + 1000);
                } else if (draggedIndex === cards.length - 1) {
                    const prevCardId = cards[draggedIndex - 1].dataset.id;
                    const prevNote = notes.find(n => n.id === prevCardId) || {};
                    const prevTime = prevNote.updatedAt ? prevNote.updatedAt.toDate().getTime() : Date.now();
                    newTime = new Date(prevTime - 1000);
                } else {
                    const prevCardId = cards[draggedIndex - 1].dataset.id;
                    const nextCardId = cards[draggedIndex + 1].dataset.id;
                    
                    const prevNote = notes.find(n => n.id === prevCardId) || {};
                    const nextNote = notes.find(n => n.id === nextCardId) || {};
                    
                    const prevTime = prevNote.updatedAt ? prevNote.updatedAt.toDate().getTime() : Date.now();
                    const nextTime = nextNote.updatedAt ? nextNote.updatedAt.toDate().getTime() : Date.now();
                    
                    newTime = new Date((prevTime + nextTime) / 2);
                }

                await db.collection('keep_notes').doc(draggedId).update({
                    isPinned: targetIsPinned,
                    updatedAt: firebase.firestore.Timestamp.fromDate(newTime)
                });
            } catch(err) {
                console.error("Error al reordenar la nota:", err);
            }
        };

        // Bind events
        container.querySelectorAll('.keep-note').forEach(card => {
            // Drag and Drop Events
            card.addEventListener('dragstart', (e) => {
                this.draggedCard = card;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.id);
                setTimeout(() => card.classList.add('dragging'), 0);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                if (this.placeholder && this.placeholder.parentNode) {
                    this.placeholder.parentNode.removeChild(this.placeholder);
                }
                this.placeholder = null;
                this.draggedCard = null;
            });

            // Edit modal trigger
            card.onclick = (e) => {
                if (e.target.closest('.keep-note-pin') || 
                    e.target.closest('input[type="checkbox"]') || 
                    e.target.closest('.keep-note-toolbar') ||
                    e.target.closest('.keep-reminder-tag')) return;
                
                this.openEditModal(card.dataset.id);
            };

            // Pin toggle
            const pinBtn = card.querySelector('.keep-note-pin');
            if (pinBtn) {
                pinBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const isPinned = pinBtn.classList.contains('active');
                    await db.collection('keep_notes').doc(card.dataset.id).update({ 
                        isPinned: !isPinned,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                };
            }

            // Checkbox toggle
            card.querySelectorAll('.keep-chk').forEach(chk => {
                chk.onchange = async (e) => {
                    e.stopPropagation();
                    const index = parseInt(chk.dataset.index);
                    const isChecked = chk.checked;
                    const noteId = card.dataset.id;
                    
                    const note = notes.find(n => n.id === noteId);
                    if (note && note.checklist) {
                        note.checklist[index].checked = isChecked;
                        await db.collection('keep_notes').doc(noteId).update({
                            checklist: note.checklist,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                };
            });

            // Color palette from toolbar
            const colorBtn = card.querySelector('.tool-color-btn');
            const colorPal = card.querySelector('.tool-color-palette');
            if (colorBtn && colorPal) {
                colorBtn.onclick = (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.tool-color-palette').forEach(p => {
                        if (p !== colorPal) {
                            p.classList.add('hidden');
                            const otherCard = p.closest('.keep-note');
                            if (otherCard) otherCard.classList.remove('active-palette');
                        }
                    });
                    colorPal.classList.toggle('hidden');
                    if (!colorPal.classList.contains('hidden')) {
                        card.classList.add('active-palette');
                    } else {
                        card.classList.remove('active-palette');
                    }
                };

                colorPal.querySelectorAll('.keep-color-swatch').forEach(swatch => {
                    swatch.onclick = async (e) => {
                        e.stopPropagation();
                        const newColor = swatch.dataset.color;
                        await db.collection('keep_notes').doc(card.dataset.id).update({
                            color: newColor,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        colorPal.classList.add('hidden');
                        card.classList.remove('active-palette');
                    };
                });

                colorPal.querySelectorAll('.keep-pattern-swatch').forEach(swatch => {
                    swatch.onclick = async (e) => {
                        e.stopPropagation();
                        const newPattern = swatch.dataset.pattern;
                        await db.collection('keep_notes').doc(card.dataset.id).update({
                            backgroundImage: newPattern,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        colorPal.classList.add('hidden');
                        card.classList.remove('active-palette');
                    };
                });
            }

            // Archive
            const archBtn = card.querySelector('.tool-archive-btn');
            if (archBtn) {
                archBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const noteObj = notes.find(n => n.id === card.dataset.id) || {};
                    const nextArchived = !noteObj.isArchived;
                    await db.collection('keep_notes').doc(card.dataset.id).update({
                        isArchived: nextArchived,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    ToastService.success(nextArchived ? "Nota archivada" : "Nota desarchivada");
                };
            }

            // Custom Reminder Setup Pop-up Modal
            const reminderBtn = card.querySelector('.tool-reminder-btn');
            if (reminderBtn) {
                const noteObj = notes.find(n => n.id === card.dataset.id);
                reminderBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.openReminderSetupModal(noteObj);
                };
            }

            // Clear Reminder Tag
            const reminderClear = card.querySelector('.keep-reminder-clear');
            if (reminderClear) {
                reminderClear.onclick = async (e) => {
                    e.stopPropagation();
                    await db.collection('keep_notes').doc(card.dataset.id).update({
                        reminder: firebase.firestore.FieldValue.delete(),
                        reminderFired: firebase.firestore.FieldValue.delete(),
                        reminderRecipients: firebase.firestore.FieldValue.delete(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    ToastService.info("Recordatorio eliminado");
                };
            }
        });

        // Global click to close inline color palettes
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.keep-note-toolbar')) {
                document.querySelectorAll('.tool-color-palette').forEach(p => p.classList.add('hidden'));
                document.querySelectorAll('.keep-note').forEach(n => n.classList.remove('active-palette'));
            }
        });
    }

    getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.keep-note:not(.dragging)')];
        
        const closest = draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const childX = box.left + box.width / 2;
            const childY = box.top + box.height / 2;
            
            // Distancia Euclidiana 2D para soporte nativo de multi-columnas Masonry
            const distance = Math.hypot(x - childX, y - childY);
            
            if (distance < closest.distance) {
                return { distance: distance, element: child, box: box };
            } else {
                return closest;
            }
        }, { distance: Number.POSITIVE_INFINITY });

        if (!closest.element) return null;
        
        const centerX = closest.box.left + closest.box.width / 2;
        const centerY = closest.box.top + closest.box.height / 2;
        
        // Si el cursor está a la derecha del centro de la tarjeta,
        // o si está abajo del centro vertical, lo insertamos después (devolviendo el siguiente hermano)
        if (x > centerX || y > centerY) {
            return closest.element.nextElementSibling;
        }
        
        return closest.element;
    }

    generateNoteHtml(note) {
        let contentHtml = '';
        
        if (note.type === 'list' && note.checklist) {
            const unchecked = note.checklist.map((item, idx) => ({...item, originalIndex: idx})).filter(i => !i.checked);
            const checked = note.checklist.map((item, idx) => ({...item, originalIndex: idx})).filter(i => i.checked);
            
            let listHtml = unchecked.map(item => `
                <div class="keep-checklist-item">
                    <input type="checkbox" class="keep-chk" data-index="${item.originalIndex}">
                    <span>${item.text}</span>
                </div>
            `).join('');

            if (checked.length > 0) {
                if (unchecked.length > 0) listHtml += '<div class="keep-checklist-divider"></div>';
                listHtml += `<div class="keep-checklist-completed-count">${checked.length} elementos completados</div>`;
                listHtml += checked.map(item => `
                    <div class="keep-checklist-item checked">
                        <input type="checkbox" class="keep-chk" data-index="${item.originalIndex}" checked>
                        <span>${item.text}</span>
                    </div>
                `).join('');
            }
            contentHtml = listHtml;
        } else {
            // Reemplazar saltos de línea con <br>
            contentHtml = `<div class="keep-note-body">${(note.content || '').replace(/\n/g, '<br>')}</div>`;
        }

        const titleHtml = note.title ? `<div class="keep-note-title">${note.title}</div>` : '';
        const authorHtml = note.createdByName && note.createdByName !== this.app.currentUser.name 
            ? `<span class="keep-author-tag">${note.createdByName}</span>` 
            : '';

        let recipientsText = '';
        if (note.reminderRecipients && note.reminderRecipients.length > 0) {
            const names = note.reminderRecipients.map(uid => {
                const member = (this.teamMembers || []).find(m => m.uid === uid);
                return member ? member.name.split(' ')[0] : '';
            }).filter(Boolean);
            if (names.length > 0) {
                recipientsText = ` • Para: ${names.join(', ')}`;
            }
        }

        const reminderHtml = note.reminder ? `
            <div class="keep-reminder-tag" title="Fecha y destinatarios del recordatorio">
                <span>🔔 ${this.formatReminderDate(note.reminder)}${recipientsText}</span>
                <button class="keep-reminder-clear" title="Quitar recordatorio">✕</button>
            </div>
        ` : '';

        return `
            <div class="keep-note ${note.color || 'k-color-default'} ${note.backgroundImage || ''}" data-id="${note.id}" draggable="true">
                <button class="keep-note-pin ${note.isPinned ? 'active' : ''}" title="${note.isPinned ? 'Desfijar' : 'Fijar nota'}">
                    📌
                </button>
                ${titleHtml}
                ${contentHtml}
                ${reminderHtml}
                ${authorHtml}
                
                <div class="keep-note-toolbar">
                    <div style="position: relative;">
                        <button class="keep-tool-btn tool-color-btn" title="Color">🎨</button>
                        <div class="keep-color-palette tool-color-palette hidden" style="top: 110%; bottom: auto;">
                            ${this.renderColorSwatches('inline')}
                        </div>
                    </div>
                    
                    <div style="position: relative; display: inline-block;">
                        <button class="keep-tool-btn tool-reminder-btn" title="Recordatorio">🔔</button>
                        <input type="datetime-local" class="keep-reminder-input" style="position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;" title="Programar recordatorio">
                    </div>
                    
                    <button class="keep-tool-btn tool-archive-btn" title="${note.isArchived ? 'Desarchivar' : 'Archivar'}">${note.isArchived ? '📥' : '📦'}</button>
                </div>
            </div>
        `;
    }

    // Modal Editing
    setupEditModal() {
        const overlay = document.getElementById('keep-edit-modal');
        const saveBtn = document.getElementById('edit-save-btn');
        const colorBtn = document.getElementById('edit-color-btn');
        const colorPalette = document.getElementById('edit-color-palette');
        const addListBtn = document.getElementById('edit-add-list-btn');
        const delBtn = document.getElementById('edit-delete-btn');
        const archBtn = document.getElementById('edit-archive-btn');
        const bodyInput = document.getElementById('edit-body');

        // Auto-resize
        bodyInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        colorBtn.onclick = (e) => {
            e.stopPropagation();
            colorPalette.classList.toggle('hidden');
        };

        colorPalette.querySelectorAll('.keep-color-swatch').forEach(swatch => {
            swatch.onclick = (e) => {
                e.stopPropagation();
                const newColor = swatch.dataset.color;
                const card = document.getElementById('edit-modal-card');
                const patternMatch = card.className.match(/k-bg-[a-z0-9]+/i);
                const currentPattern = patternMatch ? patternMatch[0] : '';
                card.className = `keep-modal-content ${newColor} ${currentPattern}`;
                colorPalette.classList.add('hidden');
            };
        });

        colorPalette.querySelectorAll('.keep-pattern-swatch').forEach(swatch => {
            swatch.onclick = (e) => {
                e.stopPropagation();
                const newPattern = swatch.dataset.pattern;
                const card = document.getElementById('edit-modal-card');
                const colorMatch = card.className.match(/k-color-[a-z0-9]+/i);
                const currentColor = colorMatch ? colorMatch[0] : 'k-color-default';
                card.className = `keep-modal-content ${currentColor} ${newPattern}`;
                colorPalette.classList.add('hidden');
            };
        });

        addListBtn.onclick = () => {
            const container = document.getElementById('edit-list-items');
            const div = document.createElement('div');
            div.className = 'keep-edit-list-item';
            div.innerHTML = `
                <input type="checkbox">
                <input type="text" placeholder="Elemento de lista">
                <button class="keep-edit-list-del">✕</button>
            `;
            div.querySelector('.keep-edit-list-del').onclick = () => div.remove();
            container.appendChild(div);
            div.querySelector('input[type="text"]').focus();
        };

        const editCloseBtn = document.getElementById('edit-close-btn');
        if (editCloseBtn) {
            editCloseBtn.onclick = (e) => {
                e.stopPropagation();
                this.cancelEditModal();
            };
        }

        saveBtn.onclick = () => this.saveEditModal();
        overlay.onclick = (e) => {
            if (e.target === overlay) this.cancelEditModal();
        };

        delBtn.onclick = async () => {
            const noteId = document.getElementById('edit-note-id').value;
            if (await ToastService.confirm("¿Eliminar nota permanentemente?", "Sí, eliminar", "Cancelar", "danger")) {
                await db.collection('keep_notes').doc(noteId).delete();
                overlay.classList.remove('active');
            }
        };

        archBtn.onclick = async () => {
            const noteId = document.getElementById('edit-note-id').value;
            try {
                const doc = await db.collection('keep_notes').doc(noteId).get();
                if (doc.exists) {
                    const note = doc.data();
                    const nextArchived = !note.isArchived;
                    await db.collection('keep_notes').doc(noteId).update({
                        isArchived: nextArchived,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    ToastService.success(nextArchived ? "Nota archivada" : "Nota desarchivada");
                }
            } catch (error) {
                console.error("Error al archivar/desarchivar:", error);
            }
            overlay.classList.remove('active');
        };
    }

    async openEditModal(noteId) {
        try {
            const doc = await db.collection('keep_notes').doc(noteId).get();
            if (!doc.exists) return;
            const note = doc.data();

            document.getElementById('edit-note-id').value = noteId;
            document.getElementById('edit-title').value = note.title || '';
            
            const card = document.getElementById('edit-modal-card');
            card.className = `keep-modal-content ${note.color || 'k-color-default'} ${note.backgroundImage || ''}`;

            const listContainer = document.getElementById('edit-list-container');
            const bodyInput = document.getElementById('edit-body');
            const listItems = document.getElementById('edit-list-items');

            if (note.type === 'list') {
                listContainer.classList.remove('hidden');
                bodyInput.classList.add('hidden');
                listItems.innerHTML = '';
                (note.checklist || []).forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'keep-edit-list-item';
                    div.innerHTML = `
                        <input type="checkbox" ${item.checked ? 'checked' : ''}>
                        <input type="text" value="${item.text}">
                        <button class="keep-edit-list-del">✕</button>
                    `;
                    div.querySelector('.keep-edit-list-del').onclick = () => div.remove();
                    listItems.appendChild(div);
                });
            } else {
                listContainer.classList.add('hidden');
                bodyInput.classList.remove('hidden');
                bodyInput.value = note.content || '';
                // Trigger auto-resize
                setTimeout(() => {
                    bodyInput.style.height = 'auto';
                    bodyInput.style.height = (bodyInput.scrollHeight) + 'px';
                }, 10);
            }

            const editArchBtn = document.getElementById('edit-archive-btn');
            if (editArchBtn) {
                editArchBtn.title = note.isArchived ? 'Desarchivar' : 'Archivar';
                editArchBtn.textContent = note.isArchived ? '📥' : '📦';
            }

            document.getElementById('keep-edit-modal').classList.add('active');
        } catch (error) {
            console.error("Error abriendo nota:", error);
        }
    }

    async saveEditModal() {
        const modal = document.getElementById('keep-edit-modal');
        if (!modal.classList.contains('active')) return;

        const noteId = document.getElementById('edit-note-id').value;
        const title = document.getElementById('edit-title').value.trim();
        const isListMode = !document.getElementById('edit-list-container').classList.contains('hidden');
        const content = document.getElementById('edit-body').value.trim();
        
        let checklist = [];
        if (isListMode) {
            document.getElementById('edit-list-items').querySelectorAll('.keep-edit-list-item').forEach(el => {
                const text = el.querySelector('input[type="text"]').value.trim();
                const checked = el.querySelector('input[type="checkbox"]').checked;
                if (text) checklist.push({ text, checked });
            });
        }

        // Obtener color y patrón del modal class
        const cardClass = document.getElementById('edit-modal-card').className;
        const colorMatch = cardClass.match(/k-color-[a-z0-9]+/i);
        const color = colorMatch ? colorMatch[0] : 'k-color-default';
        const patternMatch = cardClass.match(/k-bg-[a-z0-9]+/i);
        const backgroundImage = patternMatch ? patternMatch[0] : '';

        try {
            await db.collection('keep_notes').doc(noteId).update({
                title,
                content: isListMode ? '' : content,
                checklist,
                color,
                backgroundImage,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            ToastService.success("Nota actualizada");
        } catch (error) {
            console.error("Error actualizando nota:", error);
            ToastService.error("Error al actualizar la nota.");
        }

        modal.classList.remove('active');
    }

    cancelEditModal() {
        const modal = document.getElementById('keep-edit-modal');
        modal.classList.remove('active');
    }

    formatReminderDate(dateTimeStr) {
        if (!dateTimeStr) return '';
        try {
            const date = new Date(dateTimeStr);
            if (isNaN(date.getTime())) return dateTimeStr;
            const options = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true };
            return date.toLocaleDateString('es-ES', options);
        } catch (e) {
            return dateTimeStr;
        }
    }



    openReminderSetupModal(note) {
        // Create modal overlay dynamically
        const overlay = document.createElement('div');
        overlay.className = 'keep-modal-overlay active';
        overlay.id = 'keep-reminder-setup-modal';
        overlay.style.zIndex = '3100'; // Make sure it floats on top of everything

        // Filter based on user role and area (managers see all, others see only their own area)
        const currentUser = this.app.currentUser || {};
        const isManager = currentUser.role === 'gerente';
        const userArea = currentUser.area || '';

        const filteredMembers = (this.teamMembers || []).filter(member => {
            if (isManager) return true;
            return member.area === userArea;
        });

        const sortedMembers = [...filteredMembers].sort((a, b) => a.name.localeCompare(b.name));

        overlay.innerHTML = `
            <div class="keep-modal-content k-color-default" style="max-width: 420px; border-radius: 24px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05); background: white;">
                <div style="font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.2rem; color: #1a202c; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.4rem;">🔔</span> Programar Recordatorio
                </div>
                
                <!-- Date & Time Picker field -->
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 0.8rem; color: #718096; text-transform: uppercase; margin-bottom: 8px;">Fecha y Hora</label>
                    <div style="position: relative;">
                        <input type="text" id="reminder-modal-datetime" class="keep-close-btn" style="width: 100%; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; box-sizing: border-box; font-family: 'Outfit', sans-serif; font-size: 0.9rem;" placeholder="Seleccionar fecha y hora..." readonly>
                    </div>
                </div>

                <!-- Team Members Checkboxes -->
                <div style="margin-bottom: 24px;">
                    <label style="display: block; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 0.8rem; color: #718096; text-transform: uppercase; margin-bottom: 8px;">Enviar a miembros del equipo</label>
                    <div style="max-height: 180px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 4px;">
                        ${sortedMembers.map(member => {
                            const isChecked = (note.reminderRecipients || []).includes(member.uid);
                            return `
                                <label style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin: 0;" class="member-select-label">
                                    <input type="checkbox" class="reminder-member-checkbox" value="${member.uid}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; min-width: 16px; margin: 0; cursor: pointer; accent-color: #ff7a91;">
                                    <div style="display: flex; flex-direction: column; font-family: 'Outfit', sans-serif;">
                                        <span style="font-weight: 600; font-size: 0.88rem; color: #2d3748; line-height: 1.2;">${member.name}</span>
                                        <span style="font-size: 0.72rem; color: #718096; text-transform: capitalize;">${member.role} • ${member.area || 'Sin área'}</span>
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Footer Buttons -->
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="keep-close-btn" id="reminder-modal-cancel" style="padding: 8px 20px;">Cancelar</button>
                    <button class="keep-save-btn" id="reminder-modal-save" style="padding: 8px 20px; font-weight: 700;">Programar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add dynamically created hover effect style for member select row
        const styleId = 'member-hover-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .member-select-label:hover {
                    background: rgba(255, 122, 145, 0.08) !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Initialize Flatpickr on the custom input inside modal
        let selectedDateStr = note.reminder || '';
        const datetimeInput = document.getElementById('reminder-modal-datetime');
        const fp = flatpickr(datetimeInput, {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            time_24hr: false,
            locale: "es",
            disableMobile: "true",
            defaultDate: note.reminder ? new Date(note.reminder) : null,
            onChange: (selectedDates, dateStr) => {
                selectedDateStr = dateStr;
            }
        });

        // Close handlers
        const closeModal = () => {
            fp.destroy();
            overlay.remove();
        };

        document.getElementById('reminder-modal-cancel').onclick = closeModal;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeModal();
        };

        // Save reminder configuration
        document.getElementById('reminder-modal-save').onclick = async () => {
            if (!selectedDateStr) {
                ToastService.warning("Por favor, selecciona una fecha y hora.");
                return;
            }

            // Proactively request browser notifications permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            const selectedUids = [];
            overlay.querySelectorAll('.reminder-member-checkbox:checked').forEach(cb => {
                selectedUids.push(cb.value);
            });

            try {
                await db.collection('keep_notes').doc(note.id).update({
                    reminder: selectedDateStr,
                    reminderFired: false,
                    reminderRecipients: selectedUids,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                ToastService.success("Recordatorio programado con éxito");
                closeModal();
            } catch (error) {
                console.error("Error al programar recordatorio:", error);
                ToastService.error("No se pudo programar el recordatorio.");
            }
        };
    }

    destroy() {
        if (this.unsubscribe) this.unsubscribe();
    }
}
