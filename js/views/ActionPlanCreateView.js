import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class ActionPlanCreateView extends View {
    constructor(app, draftId = null, editId = null) {
        super(app);
        this.draftId = draftId;
        this.editId = editId;
    }

    async render() {
        const container = this.createEl('div', 'create-plan-view fade-in');

        // Múltiples roles pueden crear planes, pero con reglas
        const role = this.app.currentUser.role;
        if (!['gerente', 'coordinador', 'coordinadora', 'miembro'].includes(role)) {
            return this.createEl('div', 'error-container', '<h1>Acceso Denegado</h1><p>No tienes permisos para crear planes.</p>');
        }

        this.members = await FirebaseService.getAllMembers();
        const members = this.members;

        // Agrupar miembros por área para el selector de líder
        const groups = members.reduce((acc, m) => {
            const area = m.area || 'Otra Area';
            if (!acc[area]) acc[area] = [];
            acc[area].push(m);
            return acc;
        }, {});

        const coordinators = members.filter(m => m.role === 'coordinador');

        container.innerHTML = `
            <div class="view-header">
                <h1>${this.editId ? 'Editar Plan de Acción' : 'Nuevo Plan de Acción / Mejora'}</h1>
                <p>${this.editId ? 'Modifica la información estratégica del plan' : 'Identificación de problemática y asignación de responsables'}</p>
            </div>

            <form id="plan-form" class="glass-effect form-card">
                <!-- D1 & D2: Equipo y Definición del Problema -->
                <div class="form-section">
                    <div class="section-badge">D1 & D2</div>
                    <h3>Equipo y Definición del Problema</h3>
                    <div class="input-group">
                        <label>Título del Plan (Estratégico)</label>
                        <input type="text" id="title" required placeholder="Ej: KPI Clientes nuevos">
                    </div>
                    <div class="input-group">
                        <label style="color: var(--rosa-strong); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Objetivo Principal</label>
                        <textarea id="objective" class="custom-textarea" required placeholder="Describe el objetivo del proyecto" style="min-height: 80px;"></textarea>
                    </div>
                    <div class="input-group">
                        <label>Descripción de la Problemática (¿Qué está pasando?)</label>
                        <textarea id="problem" class="custom-textarea" required placeholder="Describe el problema detectado..."></textarea>
                    </div>

                    <div class="input-group">
                        <label>KPI NOK (Estado actual del indicador)</label>
                        <input type="text" id="kpi_nok" required placeholder="Ej: 2 clientes nuevos promedio por mes">
                    </div>

                    <div class="input-row">
                        <div class="input-group">
                            <label>Líder de Proyecto (Responsable)</label>
                            ${role === 'miembro' ? `
                                <select id="lead_id" required style="pointer-events: none; background: #f8fafc;">
                                    <option value="${this.app.currentUser.uid}" selected>${this.app.currentUser.name} (Tú)</option>
                                </select>
                            ` : `
                                <select id="lead_id" required>
                                    <option value="">Seleccione un líder...</option>
                                    ${Object.keys(groups).sort().map(area => `
                                        <optgroup label="Área: ${area}">
                                            ${groups[area].map(m => `<option value="${m.uid}">${m.name} (${m.role})</option>`).join('')}
                                        </optgroup>
                                    `).join('')}
                                </select>
                            `}
                        </div>
                        ${role === 'gerente' ? `
                        <div class="input-group">
                            <label>Coordinador (Seguimiento)</label>
                            <select id="coordinator_id">
                                <option value="">Ninguno...</option>
                                ${coordinators.map(c => `<option value="${c.uid}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- D4: Análisis de Causa Raíz (5 Porqués) -->
                <div class="form-section">
                    <div class="section-badge">D4</div>
                    <h3>Análisis de Causa Raíz (Los 5 Porqués)</h3>
                    <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1rem;">Profundiza en la causa raíz preguntando "¿Por qué?" sucesivamente.</p>
                    <div class="input-group" style="margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1.5rem;">
                        <label style="color: var(--rosa-strong); font-weight: 800;">Problema a analizar:</label>
                        <input type="text" id="problem_d4" required placeholder="Ej: No se cumplió el total de clientes nuevos en Puebla" style="font-size: 1.1rem; border-color: var(--rosa-light);">
                    </div>

                    <div id="whys-container" class="whys-container">
                        <!-- Se cargan dinámicamente -->
                    </div>
                    <button type="button" id="add-why-btn" class="add-why-btn">+ Agregar otro Por qué</button>

                    <div id="reverse-summary" class="reverse-summary-box animate-up" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--rosa-light); border-radius: 8px; border: 1px dashed var(--rosa-strong);">
                        <h4 style="color: var(--rosa-strong); margin-bottom: 0.5rem;">Validación Lógica (Resumen al revés)</h4>
                        <div id="reverse-list" class="reverse-summary-list" style="color: var(--text-dim); font-size: 0.9rem; font-style: italic;">
                            Llena al menos dos "Por qués" para visualizar la validación automática.
                        </div>
                    </div>
                </div>

                <!-- 5 Porqués Causa Raíz -->
                <div class="form-section">
                    <div class="section-badge" style="background: var(--primary);">D4+</div>
                    <h3>5 por qué's causa raíz</h3>
                    <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1rem;">Si de la sección anterior surgieron varias causas raíz, añade una sección de 5 por qués para cada una y analízalas a detalle.</p>
                    
                    <div id="root-causes-scroll-container" style="display: flex; overflow-x: auto; gap: 2rem; padding-bottom: 1rem; width: 100%;">
                        <!-- Bloques generados dinámicamente -->
                    </div>
                    <button type="button" id="add-root-cause-btn" class="secondary-btn" style="margin-top: 1rem;">+ Agregar 5 por qué's causa raíz</button>
                </div>

                <!-- Lluvia de Ideas -->
                <div class="form-section" id="brainstorm-section" style="display:none;">
                    <div class="section-badge" style="background: var(--secondary);">D5</div>
                    <h3>Lluvia de Ideas &mdash; Soluciones por Causa Raíz</h3>
                    <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem;">Para cada causa raíz, anota todas las ideas posibles y marca las más viables para destacarlas.</p>
                    <div id="brainstorm-panels-container" style="display: flex; flex-direction: column; gap: 2rem;">
                        <!-- Paneles generados dinámicamente -->
                    </div>
                </div>

                <!-- Tareas -->
                <div class="form-section" id="tasks-section" style="display:none;">
                    <div class="section-badge" style="background: var(--azul-deep);">D6</div>
                    <h3>Tareas de Acción Iniciales</h3>
                    <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem;">Las ideas viables se agregan automáticamente aquí. Asigna responsables y fechas para comenzar la ejecución.</p>
                    <div id="form-tasks-container" style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- Tareas generadas dinámicamente -->
                    </div>
                </div>

                <div class="form-section">
                    <h3>Metas y Compromiso</h3>
                    <div class="input-row">
                        <div class="input-group" style="flex: 1;">
                            <label>KPI Meta (Esperado a alcanzar)</label>
                            <input type="text" id="kpi_expected" required placeholder="Ej: 3 clientes nuevos promedio por mes">
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <label>Fecha Límite Compromiso</label>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <input type="date" id="due_date" required style="flex: 1;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0; cursor: pointer; white-space: nowrap;">
                                <input type="checkbox" id="is_recurrent" style="width: 20px; height: 20px;">
                                Recurrente
                            </label>
                        </div>
                    </div>
                </div>

                <div class="form-actions" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    ${this.editId ? `
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" id="cancel-plan-btn" class="badge" style="background: #ef4444; color: white; border: none; cursor: pointer; padding: 0.8rem 1.4rem; border-radius: 8px; font-weight: 600;">Cancelar Plan</button>
                            ${this.app.currentUser.role === 'gerente' ? '<button type="button" id="delete-plan-btn" class="badge" style="background: #111; color: white; border: none; cursor: pointer; padding: 0.8rem 1.4rem; border-radius: 8px; font-weight: 600;">Eliminar Permanente</button>' : ''}
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" class="secondary-btn" onclick="window.history.back()">Volver sin guardar</button>
                            <button type="button" id="save-draft-btn" class="secondary-btn" style="border: 1px solid var(--primary); color: var(--primary);">Guardar Borrador</button>
                            <button type="button" id="save-changes-btn" class="primary-btn">Crear Plan</button>
                        </div>
                    ` : `
                        <button type="button" class="secondary-btn" onclick="window.history.back()">Cancelar</button>
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" id="save-draft-btn" class="secondary-btn" style="border: 1px solid var(--primary); color: var(--primary);">Guardar Borrador</button>
                            <button type="submit" class="primary-btn">Crear Plan de Mejora Continua</button>
                        </div>
                    `}
                </div>
            </form>
        `;

        return container;
    }

    afterRender() {
        this.app.showNavigation();
        const form = document.getElementById('plan-form');
        const dueDateInput = document.getElementById('due_date');
        const recurrentCheckbox = document.getElementById('is_recurrent');
        const whysContainer = document.getElementById('whys-container');
        const addWhyBtn = document.getElementById('add-why-btn');
        const reverseSummary = document.getElementById('reverse-summary');
        const reverseList = document.getElementById('reverse-list');
        const problemD4Input = document.getElementById('problem_d4');

        // Lógica de múltiples Causas Raíz
        const rootCausesContainer = document.getElementById('root-causes-scroll-container');
        const addRootCauseBtn = document.getElementById('add-root-cause-btn');
        let rootCauseCount = 0;

        const createRootCauseBlock = () => {
            rootCauseCount++;
            const currentBlockId = rootCauseCount;
            const block = document.createElement('div');
            block.className = 'root-cause-block form-card';
            block.style = 'min-width: 320px; flex: 0 0 auto; background: #fff; padding: 1.5rem; border-radius: 8px; border: 1px solid #eaeaea; position: relative; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);';
            
            block.innerHTML = `
                <button type="button" class="remove-root-cause-btn" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #ef4444; font-size: 1.5rem; line-height: 1; cursor: pointer;" title="Eliminar">&times;</button>
                <h4 style="margin-bottom: 1rem; font-size: 1rem; color: var(--rosa-strong);">Causa Raíz #${currentBlockId}</h4>
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label>Causa a analizar:</label>
                    <input type="text" class="rc-problem-input" required placeholder="Ej: Falta de capacitación" style="border-color: var(--rosa-light);">
                </div>
                <div class="rc-whys-container" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;"></div>
                <button type="button" class="add-rc-why-btn secondary-btn sm" style="width: 100%; border: 1px dashed var(--rosa-light); color: var(--rosa-strong);">+ Agregar Por qué</button>
            `;
            rootCausesContainer.appendChild(block);

            const whysContainer = block.querySelector('.rc-whys-container');
            const addRcWhyBtn = block.querySelector('.add-rc-why-btn');
            const problemInput = block.querySelector('.rc-problem-input');
            const removeBtn = block.querySelector('.remove-root-cause-btn');

            const brainstormContainer = document.getElementById('brainstorm-panels-container');
            const brainstormSection = document.getElementById('brainstorm-section');

            block.dataset.blockId = currentBlockId;

            const syncBrainstormTitle = () => {
                const panel = brainstormContainer.querySelector(`[data-brainstorm-id="${currentBlockId}"]`);
                if (panel) {
                    const title = panel.querySelector('.bs-cause-title');
                    const val = problemInput.value.trim();
                    if (title) title.textContent = val || `Causa Raíz #${currentBlockId}`;
                }
            };

            problemInput.addEventListener('input', syncBrainstormTitle);

            removeBtn.onclick = () => {
                block.remove();
                const panel = brainstormContainer.querySelector(`[data-brainstorm-id="${currentBlockId}"]`);
                if (panel) panel.remove();
                if (brainstormContainer.children.length === 0) {
                    brainstormSection.style.display = 'none';
                }
            };

            // Crear panel de brainstorming correspondiente
            createBrainstormPanel(currentBlockId, '');
            brainstormSection.style.display = 'block';
            
            // Si hay ideas precargadas (modo edición), dispararlas al panel
            if (addRootCauseBtn.dataset.pendingIdeas) {
                const pendingIdeas = JSON.parse(addRootCauseBtn.dataset.pendingIdeas);
                delete addRootCauseBtn.dataset.pendingIdeas;
                // Dar tiempo mínimo al DOM
                setTimeout(() => {
                    const newPanel = brainstormContainer.querySelector(`[data-brainstorm-id="${currentBlockId}"]`);
                    if (newPanel) {
                        newPanel.dispatchEvent(new CustomEvent('load-ideas', { detail: pendingIdeas }));
                    }
                }, 50);
            }

            let rcWhyCount = 0;

            const updateRcLabels = () => {
                const inputs = Array.from(block.querySelectorAll('.rc-why-field'));
                const labels = Array.from(block.querySelectorAll('.rc-why-label'));
                const problem = problemInput.value.trim() || '...';
                labels.forEach((label, i) => {
                    const prevValue = i === 0 ? problem : (inputs[i - 1].value.trim() || '...');
                    label.innerHTML = `¿Por qué <strong>${prevValue}</strong>?`;
                });
            };

            problemInput.oninput = () => updateRcLabels();

            const createRcWhyField = () => {
                rcWhyCount++;
                const div = document.createElement('div');
                div.className = 'why-item';
                div.style = 'margin-bottom: 0; padding: 0.75rem; border-left: 3px solid var(--rosa-light); background: #fdfdfd; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);';
                div.innerHTML = `
                    <div class="input-group why-input" style="margin-bottom: 0;">
                        <label class="rc-why-label why-label" style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 4px;">¿Por qué...?</label>
                        <input type="text" class="rc-why-field why-field" placeholder="Respuesta..." style="padding: 0.6rem; font-size: 0.9rem;">
                    </div>
                `;
                whysContainer.appendChild(div);
                
                const input = div.querySelector('input');
                input.oninput = () => updateRcLabels();
            };

            for(let i=0; i<5; i++) createRcWhyField();

            addRcWhyBtn.onclick = () => {
                createRcWhyField();
                updateRcLabels();
            };
        };

        addRootCauseBtn.onclick = () => createRootCauseBlock();

        // ====== LLUVIA DE IDEAS ======
        const createBrainstormPanel = (blockId, causeLabel, existingIdeas = []) => {
            const container = document.getElementById('brainstorm-panels-container');
            const panel = document.createElement('div');
            panel.dataset.brainstormId = blockId;
            panel.style.cssText = 'background: #fff; border: 1px solid #eaeaea; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.04);';
            panel.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid #f0f0f0;">
                    <div style="width: 10px; height: 10px; background: var(--secondary); border-radius: 50%; flex-shrink: 0;"></div>
                    <h4 class="bs-cause-title" style="margin: 0; font-size: 1rem; color: var(--secondary); font-weight: 700;">${causeLabel || `Causa Raíz #${blockId}`}</h4>
                </div>
                <div class="bs-ideas-grid" style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; min-height: 60px;">
                    <div class="bs-empty-hint" style="color: var(--text-dim); font-size: 0.85rem; font-style: italic; display: flex; align-items: center; gap: 0.5rem;">
                        💡 Agrega ideas usando el campo de abajo...
                    </div>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <input type="text" class="bs-idea-input" placeholder="Escribe una idea de solución..." 
                        style="flex: 1; padding: 0.65rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s;"
                        onfocus="this.style.borderColor='var(--secondary)'" onblur="this.style.borderColor='#e2e8f0'">
                    <button type="button" class="bs-add-idea-btn" style="padding: 0.65rem 1.25rem; background: var(--secondary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; font-size: 0.9rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">+ Agregar idea</button>
                </div>
            `;
            container.appendChild(panel);

            const ideasGrid = panel.querySelector('.bs-ideas-grid');
            const ideaInput = panel.querySelector('.bs-idea-input');
            const addIdeaBtn = panel.querySelector('.bs-add-idea-btn');

            const addIdeaCard = (text, viable = false) => {
                const emptyHint = ideasGrid.querySelector('.bs-empty-hint');
                if (emptyHint) emptyHint.remove();

                const ideaId = 'idea_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                
                const card = document.createElement('div');
                card.className = 'bs-idea-card';
                card.dataset.viable = viable ? 'true' : 'false';
                card.dataset.ideaId = ideaId;
                card.style.cssText = `
                    display: flex; align-items: center; gap: 0.5rem;
                    padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.85rem;
                    border: 2px solid ${viable ? 'var(--secondary)' : '#e2e8f0'};
                    background: ${viable ? 'rgba(5, 174, 230, 0.08)' : '#fafafa'};
                    max-width: 100%; cursor: default; transition: all 0.2s;
                    position: relative; width: fit-content;
                `;
                card.innerHTML = `
                    <span class="bs-idea-text" style="line-height: 1.3; color: ${viable ? 'var(--azul-deep)' : '#374151'}; font-weight: ${viable ? '600' : '400'}; padding-right: 0.5rem;">${text}</span>
                    <div style="display: flex; flex-direction: row; align-items: center; gap: 0.3rem; flex-shrink: 0; margin-left: auto;">
                        <button type="button" class="bs-viable-btn" title="${viable ? 'Quitar viable' : 'Marcar como viable'}"
                            style="background: none; border: 1px solid ${viable ? 'var(--secondary)' : '#d1d5db'}; border-radius: 5px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem; color: ${viable ? 'var(--secondary)' : '#9ca3af'}; transition: all 0.2s; white-space: nowrap;">
                            ${viable ? '⭐ Viable' : '☆ Viable'}
                        </button>
                        <button type="button" class="bs-remove-idea-btn" title="Eliminar idea"
                            style="background: none; border: 1px solid #fca5a5; border-radius: 5px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem; color: #ef4444; transition: all 0.2s; font-weight: bold;">
                            ✕
                        </button>
                    </div>
                `;

                card.querySelector('.bs-viable-btn').onclick = () => {
                    const isViable = card.dataset.viable === 'true';
                    const newViable = !isViable;
                    card.dataset.viable = newViable ? 'true' : 'false';
                    card.style.borderColor = newViable ? 'var(--secondary)' : '#e2e8f0';
                    card.style.background = newViable ? 'rgba(5, 174, 230, 0.08)' : '#fafafa';
                    const textEl = card.querySelector('.bs-idea-text');
                    textEl.style.color = newViable ? 'var(--azul-deep)' : '#374151';
                    textEl.style.fontWeight = newViable ? '600' : '400';
                    const btn = card.querySelector('.bs-viable-btn');
                    btn.textContent = newViable ? '⭐ Viable' : '☆ Viable';
                    btn.style.borderColor = newViable ? 'var(--secondary)' : '#d1d5db';
                    btn.style.color = newViable ? 'var(--secondary)' : '#9ca3af';
                    btn.title = newViable ? 'Quitar viable' : 'Marcar como viable';
                    
                    // Sync with tasks
                    if (typeof window.syncViableIdeaTask === 'function') {
                        window.syncViableIdeaTask(card.dataset.ideaId, text, newViable);
                    }
                };

                card.querySelector('.bs-remove-idea-btn').onclick = () => {
                    card.remove();
                    // Eliminar tarea si existía
                    if (typeof window.syncViableIdeaTask === 'function') {
                        window.syncViableIdeaTask(card.dataset.ideaId, text, false);
                    }
                    if (ideasGrid.children.length === 0) {
                        const hint = document.createElement('div');
                        hint.className = 'bs-empty-hint';
                        hint.style.cssText = 'color: var(--text-dim); font-size: 0.85rem; font-style: italic; display: flex; align-items: center; gap: 0.5rem;';
                        hint.textContent = '💡 Agrega ideas usando el campo de abajo...';
                        ideasGrid.appendChild(hint);
                    }
                };

                ideasGrid.appendChild(card);
            };

            const submitIdea = () => {
                const text = ideaInput.value.trim();
                if (!text) return;
                addIdeaCard(text, false);
                ideaInput.value = '';
                ideaInput.focus();
            };

            addIdeaBtn.onclick = submitIdea;
            ideaInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); submitIdea(); }
            });

            // Cargar ideas existentes (al editar/borrador)
            existingIdeas.forEach(idea => addIdeaCard(idea.text, idea.viable));

            panel.addEventListener('load-ideas', (e) => {
                const ideas = e.detail;
                ideas.forEach(idea => {
                    addIdeaCard(idea.text, idea.viable);
                    // Si la idea es viable, crear tarea correspondiente
                    if (idea.viable && typeof window.syncViableIdeaTask === 'function') {
                        // Buscar la tarjeta recién creada por su texto para obtener el ideaId
                        const cards = ideasGrid.querySelectorAll('.bs-idea-card');
                        const newCard = Array.from(cards).find(c => c.querySelector('.bs-idea-text')?.textContent?.trim() === idea.text && c.dataset.viable === 'true');
                        if (newCard) {
                            window.syncViableIdeaTask(newCard.dataset.ideaId, idea.text, true);
                        }
                    }
                });
            });

            return panel;
        };

        // ====== TAREAS (D6) ======
        const tasksContainer = document.getElementById('form-tasks-container');
        const tasksSection = document.getElementById('tasks-section');
        
        window.syncViableIdeaTask = (ideaId, title, isViable) => {
            if (isViable) {
                // Evitar duplicados: si ya existe un bloque con data-idea-id igual, ignorar
                const existingIdea = tasksContainer.querySelector(`.form-task-block[data-idea-id="${ideaId}"]`);
                if (existingIdea) return;

                // Evitar duplicados con tareas ya guardadas en Firestore (mismo título)
                const savedTasks = tasksContainer.querySelectorAll('.form-task-block[data-task-id]');
                const titleLower = title.trim().toLowerCase();
                for (const saved of savedTasks) {
                    const savedTitle = saved.querySelector('.task-title-input')?.value.trim().toLowerCase();
                    if (savedTitle === titleLower) return; // Ya existe como tarea guardada
                }

                createTaskBlock({ id: ideaId, title, isNew: true });
            } else {
                const block = document.querySelector(`.form-task-block[data-idea-id="${ideaId}"]`);
                if (block) block.remove();
            }
            tasksSection.style.display = tasksContainer.children.length > 0 ? 'block' : 'none';
        };

        const statusConfig = {
            pendiente:  { label: 'Pendiente',  icon: '⏳', cls: 'st-pending' },
            en_proceso: { label: 'En Proceso', icon: '⚡', cls: 'st-progress' },
            completado: { label: 'Completado', icon: '✓',  cls: 'st-done' },
            cancelada:  { label: 'Cancelada',  icon: '✕',  cls: 'st-overdue' },
        };

        const createTaskBlock = (task) => {
            const currentStatus = task.status || 'pendiente';
            const st = statusConfig[currentStatus] || statusConfig.pendiente;
            const membersOptions = this.members.map(m => `<option value="${m.uid}">${m.name}</option>`).join('');

            const getInitials = (uid) => {
                const m = this.members.find(member => member.uid === uid);
                if (!m) return '?';
                return (m.name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            };

            const block = document.createElement('div');
            block.className = `form-task-block task-row-premium ${st.cls}`;
            if (task.isNew) {
                block.dataset.ideaId = task.id;
            } else {
                block.dataset.taskId = task.id;
            }

            block.innerHTML = `
                <div class="task-status-bar"></div>
                <div class="task-row-content" style="padding: 0.7rem 1.2rem !important;">
                    <div class="task-row-top" style="margin-bottom: 0.3rem !important;">
                        <select class="task-status task-status-pill ${st.cls}" style="border: none !important; cursor: pointer; font-size: 0.72rem !important; font-weight: 700 !important; padding: 3px 10px !important; border-radius: 20px !important; letter-spacing: 0.3px !important; outline: none !important; width: auto !important; appearance: none; -webkit-appearance: none; -moz-appearance: none;">
                            <option value="pendiente" ${currentStatus === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="en_proceso" ${currentStatus === 'en_proceso' ? 'selected' : ''}>⚡ En Proceso</option>
                            <option value="completado" ${currentStatus === 'completado' ? 'selected' : ''}>✓ Completado</option>
                        </select>
                        <div class="task-actions">
                            <button type="button" class="task-action-btn delete remove-task-btn" title="Eliminar tarea">🗑️</button>
                        </div>
                    </div>
                    <input type="text" class="task-title task-title-input"
                        value="${task.title || ''}" placeholder="Nombre de la tarea" required
                        style="border: 1px solid transparent !important; background: transparent !important; width: 100% !important; outline: none !important; font-size: 0.95rem !important; font-weight: 700 !important; color: var(--text-main) !important; margin-bottom: 0.4rem !important; padding: 0.1rem 0 !important; cursor: text; border-radius: 4px;"
                        onfocus="this.style.borderColor='var(--secondary)'; this.style.background='#f0fbff'; this.style.paddingLeft='0.5rem';"
                        onblur="this.style.borderColor='transparent'; this.style.background='transparent'; this.style.paddingLeft='0';">
                    <div class="task-row-meta" style="gap: 1rem 1.5rem !important;">
                        <div class="task-person">
                            <div class="avatar-sm avatar-assigned" style="width: 30px !important; height: 30px !important; font-size: 0.68rem !important;">${task.assigned_id ? getInitials(task.assigned_id) : '?'}</div>
                            <div>
                                <span style="display: block; font-size: 0.68rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; margin-bottom: 2px;">Responsable</span>
                                <select class="task-assigned" required style="border: 1px solid #e2e8f0 !important; background: #f8fafc url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>&quot;) no-repeat right 8px center / 12px !important; font-size: 0.82rem !important; font-weight: 700 !important; color: var(--text-main) !important; padding: 0.25rem 1.8rem 0.25rem 0.5rem !important; outline: none !important; width: auto !important; margin: 0 !important; box-shadow: none !important; cursor: pointer; border-radius: 6px !important; appearance: none !important; -webkit-appearance: none !important; -moz-appearance: none !important;"
                                    onfocus="this.style.borderColor='var(--secondary)';"
                                    onblur="this.style.borderColor='#e2e8f0';">
                                    <option value="">Seleccionar...</option>
                                    ${membersOptions}
                                </select>
                            </div>
                        </div>
                        <div class="task-person helper">
                            <div class="avatar-sm helper avatar-helper" style="width: 30px !important; height: 30px !important; font-size: 0.68rem !important;">${task.helper_id ? getInitials(task.helper_id) : '?'}</div>
                            <div>
                                <span style="display: block; font-size: 0.68rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; margin-bottom: 2px;">Apoyo</span>
                                <select class="task-helper" style="border: 1px solid #e2e8f0 !important; background: #f8fafc url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>&quot;) no-repeat right 8px center / 12px !important; font-size: 0.82rem !important; font-weight: 700 !important; color: var(--text-main) !important; padding: 0.25rem 1.8rem 0.25rem 0.5rem !important; outline: none !important; width: auto !important; margin: 0 !important; box-shadow: none !important; cursor: pointer; border-radius: 6px !important; appearance: none !important; -webkit-appearance: none !important; -moz-appearance: none !important;"
                                    onfocus="this.style.borderColor='var(--secondary)';"
                                    onblur="this.style.borderColor='#e2e8f0';">
                                    <option value="">Ninguno</option>
                                    ${membersOptions}
                                </select>
                            </div>
                        </div>
                        <div class="task-dates" style="border: 1px solid var(--border) !important; background: rgba(0,0,0,0.02) !important; padding: 0.35rem 0.7rem !important; border-radius: 8px !important; display: flex !important; align-items: center !important; gap: 0.6rem !important; margin-left: auto;">
                            <div class="date-item">
                                <span style="display: block; font-size: 0.68rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; margin-bottom: 2px;">Inicio</span>
                                <input type="date" class="task-start-date" value="${task.start_date || ''}" required
                                    style="border: 1px solid transparent !important; background: transparent !important; font-size: 0.8rem !important; font-weight: 700 !important; color: var(--text-main) !important; outline: none !important; padding: 0.1rem 0.2rem !important; cursor: pointer; width: auto !important; box-shadow: none !important; border-radius: 4px;"
                                    onfocus="this.style.borderColor='var(--secondary)'; this.style.background='#f0fbff';"
                                    onblur="this.style.borderColor='transparent'; this.style.background='transparent';">
                            </div>
                            <div class="date-arrow" style="color: var(--text-dim); font-size: 0.9rem;">→</div>
                            <div class="date-item">
                                <span style="display: block; font-size: 0.68rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; margin-bottom: 2px;">Límite</span>
                                <input type="date" class="task-due-date" value="${task.due_date || ''}" required
                                    style="border: 1px solid transparent !important; background: transparent !important; font-size: 0.8rem !important; font-weight: 700 !important; color: var(--text-main) !important; outline: none !important; padding: 0.1rem 0.2rem !important; cursor: pointer; width: auto !important; box-shadow: none !important; border-radius: 4px;"
                                    onfocus="this.style.borderColor='var(--secondary)'; this.style.background='#f0fbff';"
                                    onblur="this.style.borderColor='transparent'; this.style.background='transparent';">
                            </div>
                        </div>
                    </div>
                </div>
            `;

            if (task.assigned_id) block.querySelector('.task-assigned').value = task.assigned_id;
            if (task.helper_id) block.querySelector('.task-helper').value = task.helper_id;

            // Actualizar avatar al cambiar responsable
            block.querySelector('.task-assigned').onchange = (e) => {
                const uid = e.target.value;
                block.querySelector('.avatar-assigned').textContent = getInitials(uid);
            };

            // Actualizar avatar al cambiar apoyo
            block.querySelector('.task-helper').onchange = (e) => {
                const uid = e.target.value;
                block.querySelector('.avatar-helper').textContent = getInitials(uid);
            };

            // Actualizar clases de status al cambiar
            block.querySelector('.task-status').onchange = (e) => {
                const newSt = statusConfig[e.target.value] || statusConfig.pendiente;
                block.className = `form-task-block task-row-premium ${newSt.cls}`;
                const pill = block.querySelector('.task-status');
                pill.className = `task-status task-status-pill ${newSt.cls}`;
            };

            block.querySelector('.remove-task-btn').onclick = () => {
                if (task.isNew) {
                    block.remove();
                } else {
                    block.dataset.deleted = "true";
                    block.style.display = 'none';
                }
                tasksSection.style.display = tasksContainer.querySelectorAll('.form-task-block:not([data-deleted="true"])').length > 0 ? 'block' : 'none';
            };

            tasksContainer.appendChild(block);
            tasksSection.style.display = 'block';
        };

        // Las tareas se cargarán junto con el plan en la lógica de edición (más abajo),
        // usando Promise.all para garantizar orden correcto y evitar duplicados.

        let whyCount = 0;

        const createWhyField = () => {
            whyCount++;
            const div = document.createElement('div');
            div.className = 'why-item';
            div.innerHTML = `
                <div class="why-number">${whyCount}</div>
                <div class="input-group why-input">
                    <label class="why-label" style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 5px;">¿Por qué...?</label>
                    <input type="text" class="why-field" placeholder="Escribe la respuesta..." data-index="${whyCount}">
                </div>
            `;
            whysContainer.appendChild(div);

            const input = div.querySelector('input');
            input.oninput = () => {
                updateLabels();
                updateReverseSummary();
            };
        };

        const updateLabels = () => {
            const inputs = Array.from(document.querySelectorAll('.why-field'));
            const labels = Array.from(document.querySelectorAll('.why-label'));
            const problem = problemD4Input.value.trim() || '...';

            labels.forEach((label, i) => {
                const prevValue = i === 0 ? problem : (inputs[i - 1].value.trim() || '...');
                label.innerHTML = `¿Por qué <strong>${prevValue}</strong>?`;
            });
        };

        const updateReverseSummary = () => {
            const inputs = Array.from(document.querySelectorAll('#whys-container .why-field'));
            const problem = problemD4Input.value.trim();
            const whys = inputs.map(i => i.value.trim()).filter(v => v !== '');

            if (whys.length > 1) {
                let html = '';
                for (let i = whys.length - 1; i > 0; i--) {
                    html += `<div class="reverse-item" style="margin-bottom: 0.5rem;">Porque <strong>${whys[i]}</strong>, entonces <strong>${whys[i - 1]}</strong>.</div>`;
                }
                if (whys[0] && problem) {
                    html += `<div class="reverse-item" style="margin-bottom: 0.5rem;">Porque <strong>${whys[0]}</strong>, el resultado fue: <strong>${problem}</strong>.</div>`;
                }
                reverseList.innerHTML = html;
            } else {
                reverseList.innerHTML = 'Llena al menos dos "Por qués" para visualizar la validación automática.';
            }
        };



        // Inicializar con 5 porqués
        for (let i = 0; i < 5; i++) createWhyField();

        addWhyBtn.onclick = () => {
            createWhyField();
            updateLabels();
        };

        problemD4Input.oninput = () => {
            updateLabels();
            updateReverseSummary();
        };

        if (!form) return;

        // Lógica de toggle para actividad recurrente
        recurrentCheckbox.onchange = (e) => {
            if (e.target.checked) {
                dueDateInput.disabled = true;
                dueDateInput.required = false;
                dueDateInput.value = '';
            } else {
                dueDateInput.disabled = false;
                dueDateInput.required = true;
            }
        };

        // ====== FUNCIÓN AUXILIAR PARA POBLAR FORMULARIO ======
        const populateForm = (data) => {
            if (data.title) document.getElementById('title').value = data.title;
            if (data.objective) document.getElementById('objective').value = data.objective;
            if (data.problem) document.getElementById('problem').value = data.problem;
            if (data.kpi_nok) document.getElementById('kpi_nok').value = data.kpi_nok;

            const leadSelect = document.getElementById('lead_id');
            if (data.lead_id && leadSelect.querySelector(`option[value="${data.lead_id}"]`)) {
                leadSelect.value = data.lead_id;
            }
            const coordSelect = document.getElementById('coordinator_id');
            if (data.coordinator_id && coordSelect && coordSelect.querySelector(`option[value="${data.coordinator_id}"]`)) {
                coordSelect.value = data.coordinator_id;
            }

            if (data.problem_d4) {
                problemD4Input.value = data.problem_d4;
                problemD4Input.dispatchEvent(new Event('input'));
            }

            if (data.whys && data.whys.length > 0) {
                const inputs = document.querySelectorAll('#whys-container .why-field');
                data.whys.forEach((w, i) => {
                    if (inputs[i]) {
                        inputs[i].value = w;
                        inputs[i].dispatchEvent(new Event('input'));
                    }
                });
            }

            if (data.root_causes_analysis && data.root_causes_analysis.length > 0) {
                data.root_causes_analysis.forEach((rc) => {
                    addRootCauseBtn.click();
                    const blocks = document.querySelectorAll('.root-cause-block');
                    const currentBlock = blocks[blocks.length - 1];
                    const rcProblemInput = currentBlock.querySelector('.rc-problem-input');
                    rcProblemInput.value = rc.problem;
                    rcProblemInput.dispatchEvent(new Event('input'));
                    if (rc.whys && rc.whys.length > 0) {
                        const whyInputs = currentBlock.querySelectorAll('.rc-why-field');
                        rc.whys.forEach((w, idx) => {
                            if (whyInputs[idx]) {
                                whyInputs[idx].value = w;
                                whyInputs[idx].dispatchEvent(new Event('input'));
                            }
                        });
                    }
                });
            }

            if (data.kpi_expected) document.getElementById('kpi_expected').value = data.kpi_expected;
            if (data.due_date === 'recurrent') {
                recurrentCheckbox.checked = true;
                recurrentCheckbox.dispatchEvent(new Event('change'));
            } else if (data.due_date) {
                dueDateInput.value = data.due_date;
            }

            // Cargar ideas de brainstorming
            if (data.brainstorming && data.brainstorming.length > 0) {
                // Los paneles se crean en el bloque root_causes_analysis de arriba.
                // Usamos un dataset temporal en el botón para pasarle las ideas a cada panel.
                // Pero como los paneles ya fueron creados, los buscamos directamente.
                setTimeout(() => {
                    data.brainstorming.forEach((bsData, idx) => {
                        const panel = document.querySelector(`[data-brainstorm-id="${idx + 1}"]`);
                        if (panel && bsData.ideas && bsData.ideas.length > 0) {
                            panel.dispatchEvent(new CustomEvent('load-ideas', { detail: bsData.ideas }));
                        }
                    });
                }, 300);
            }
        };

        // ====== LÓGICA DE BORRADOR ======
        if (this.draftId) {
            FirebaseService.getActionPlan(this.draftId).then(draftData => {
                if (draftData && draftData.status === 'borrador') populateForm(draftData);
            }).catch(e => console.error("Error al cargar borrador:", e));
        }

        // ====== LÓGICA DE EDICIÓN ======
        // Cargamos plan y tareas simultáneamente, pero renderizamos tareas PRIMERO
        // para que syncViableIdeaTask no genere duplicados al popular el brainstorming.
        if (this.editId) {
            Promise.all([
                FirebaseService.getActionPlan(this.editId),
                FirebaseService.getTasksByPlanIds([this.editId])
            ]).then(([planData, tasks]) => {
                // 1. Primero renderizar tareas guardadas en Firestore
                if (tasks && tasks.length > 0) {
                    tasks.forEach(task => createTaskBlock(task));
                }
                // 2. Luego popular el formulario (brainstorming se ejecuta 300ms después,
                //    cuando las tareas ya están en el DOM → no habrá duplicados)
                if (planData) populateForm(planData);
            }).catch(e => console.error("Error al cargar plan para editar:", e));
        }

        // ====== HELPER: RECOPILAR DATOS DEL FORMULARIO ======
        const collectPlanData = () => {
            const leadId = document.getElementById('lead_id').value;
            const leadArea = this.members.find(m => m.uid === leadId)?.area || 'General';
            const whys = Array.from(document.querySelectorAll('#whys-container .why-field'))
                .map(i => i.value.trim()).filter(v => v !== '');
            const rootCausesBlocks = Array.from(document.querySelectorAll('.root-cause-block'));
            const rootCausesAnalysis = rootCausesBlocks.map(block => {
                const problem = block.querySelector('.rc-problem-input').value.trim();
                const blockWhys = Array.from(block.querySelectorAll('.rc-why-field'))
                    .map(i => i.value.trim()).filter(v => v !== '');
                return { problem, whys: blockWhys };
            }).filter(rc => rc.problem !== '' || rc.whys.length > 0);

            // Recopilar ideas de brainstorming por panel
            const brainstormingData = Array.from(
                document.querySelectorAll('#brainstorm-panels-container [data-brainstorm-id]')
            ).map(panel => {
                const causeTitle = panel.querySelector('.bs-cause-title')?.textContent || '';
                const ideas = Array.from(panel.querySelectorAll('.bs-idea-card')).map(card => ({
                    text: card.querySelector('.bs-idea-text')?.textContent?.trim() || '',
                    viable: card.dataset.viable === 'true'
                })).filter(idea => idea.text !== '');
                return { cause_label: causeTitle, ideas };
            }).filter(bs => bs.ideas.length > 0);
            
            // Recopilar Tareas
            const formTasks = Array.from(document.querySelectorAll('.form-task-block')).map(block => {
                return {
                    id: block.dataset.taskId || block.dataset.ideaId || null,
                    isNew: !block.dataset.taskId,
                    deleted: block.dataset.deleted === "true",
                    title: block.querySelector('.task-title-input')?.value.trim() || '',
                    assigned_id: block.querySelector('.task-assigned')?.value || '',
                    helper_id: block.querySelector('.task-helper')?.value || '',
                    start_date: block.querySelector('.task-start-date')?.value || '',
                    due_date: block.querySelector('.task-due-date')?.value || '',
                    status: block.querySelector('.task-status')?.value || 'pendiente'
                };
            }).filter(t => t.title !== '' || t.deleted);

            return {
                title: document.getElementById('title').value,
                problem: document.getElementById('problem').value,
                problem_d4: problemD4Input.value,
                whys,
                root_causes_analysis: rootCausesAnalysis,
                brainstorming: brainstormingData,
                kpi_nok: document.getElementById('kpi_nok').value,
                objective: document.getElementById('objective').value,
                kpi_expected: document.getElementById('kpi_expected').value,
                coordinator_id: document.getElementById('coordinator_id')?.value || '',
                lead_id: leadId,
                area: leadArea,
                due_date: recurrentCheckbox.checked ? 'recurrent' : dueDateInput.value,
                methodology: '8D',
                form_tasks: formTasks
            };
        };

        // ====== HELPER: VALIDAR CAMPOS REQUERIDOS ======
        const validateRequiredFields = (data) => {
            const errors = [];
            if (!data.title.trim()) errors.push('Título del Plan');
            if (!data.objective.trim()) errors.push('Objetivo Principal');
            if (!data.problem.trim()) errors.push('Descripción de la Problemática');
            if (!data.kpi_nok.trim()) errors.push('KPI NOK');
            if (!data.lead_id) errors.push('Líder de Proyecto');
            if (!data.kpi_expected.trim()) errors.push('KPI Meta');
            if (!data.due_date && !recurrentCheckbox.checked) errors.push('Fecha Límite Compromiso');
            return errors;
        };

        // ====== GUARDAR BORRADOR (modo nuevo Y edición) ======
        const saveDraftBtn = document.getElementById('save-draft-btn');
        if (saveDraftBtn) {
            saveDraftBtn.onclick = async () => {
                saveDraftBtn.disabled = true;
                saveDraftBtn.textContent = "Guardando...";
                const planData = collectPlanData();
                const targetId = this.draftId || this.editId || null;
                try {
                    const id = await FirebaseService.saveActionPlanDraft(
                        { ...planData, creator_id: this.app.currentUser.uid, creator_name: this.app.currentUser.name },
                        targetId
                    );
                    this.draftId = id;
                    ToastService.success("Borrador guardado exitosamente");
                    this.app.navigateTo('plans');
                } catch (error) {
                    ToastService.error("Error al guardar borrador: " + error.message);
                    saveDraftBtn.disabled = false;
                    saveDraftBtn.textContent = "Guardar Borrador";
                }
            };
        }

        // ====== GUARDAR CAMBIOS (solo modo edición, con validación) ======
        const saveChangesBtn = document.getElementById('save-changes-btn');
        if (saveChangesBtn && this.editId) {
            saveChangesBtn.onclick = async () => {
                const planData = collectPlanData();
                const errors = validateRequiredFields(planData);
                if (errors.length > 0) {
                    ToastService.error(`Por favor llena los campos requeridos: ${errors.join(', ')}`);
                    return;
                }
                saveChangesBtn.disabled = true;
                saveChangesBtn.textContent = "Creando Plan...";
                try {
                    const { form_tasks, ...purePlanData } = planData;
                    await FirebaseService.updateActionPlan(this.editId, purePlanData);
                    
                    // Procesar Tareas
                    if (form_tasks && form_tasks.length > 0) {
                        for (const task of form_tasks) {
                            if (task.deleted && !task.isNew && task.id && !task.id.startsWith('idea_')) {
                                await FirebaseService.deleteTask(task.id);
                            } else if (!task.deleted) {
                                const taskToSave = {
                                    plan_id: this.editId,
                                    title: task.title,
                                    assigned_id: task.assigned_id,
                                    helper_id: task.helper_id,
                                    start_date: task.start_date,
                                    due_date: task.due_date,
                                    status: task.status
                                };
                                if (task.isNew || (task.id && task.id.startsWith('idea_'))) {
                                    await FirebaseService.createTask(taskToSave);
                                } else {
                                    await FirebaseService.updateTask(task.id, taskToSave);
                                }
                            }
                        }
                    }

                    ToastService.success("Plan y tareas actualizados con éxito.");
                    this.app.navigateTo(`plans/detail/${this.editId}`);
                } catch (error) {
                    ToastService.error("Error al actualizar: " + error.message);
                    saveChangesBtn.disabled = false;
                    saveChangesBtn.textContent = "Crear Plan";
                }
            };
        }

        // ====== CANCELAR PLAN (modo edición) ======
        const cancelPlanBtn = document.getElementById('cancel-plan-btn');
        if (cancelPlanBtn && this.editId) {
            cancelPlanBtn.onclick = async () => {
                const ok = await ToastService.confirm(
                    "⚠️ ¿ESTÁS SEGURO? Al cancelar el plan, todas sus tareas asociadas también se cancelarán.",
                    "Sí, cancelar todo", "Volver"
                );
                if (!ok) return;
                cancelPlanBtn.disabled = true;
                cancelPlanBtn.textContent = "Procesando...";
                try {
                    const batch = db.batch();
                    const planRef = db.collection('action_plans').doc(this.editId);
                    batch.update(planRef, { status: 'cancelada', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    const taskSnap = await db.collection('tasks').where('plan_id', '==', this.editId).get();
                    taskSnap.docs.forEach(doc => batch.update(doc.ref, { status: 'cancelada', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
                    await batch.commit();
                    ToastService.success("Plan y tareas canceladas correctamente.");
                    this.app.navigateTo('plans');
                } catch (error) {
                    ToastService.error("Error al cancelar: " + error.message);
                    cancelPlanBtn.disabled = false;
                    cancelPlanBtn.textContent = "Cancelar Plan";
                }
            };
        }

        // ====== ELIMINAR PLAN PERMANENTE (solo gerente) ======
        const deletePlanBtn = document.getElementById('delete-plan-btn');
        if (deletePlanBtn && this.editId) {
            deletePlanBtn.onclick = async () => {
                const ok = await ToastService.confirm(
                    "🚨 ¡ADVERTENCIA CRÍTICA! Esto borrará el plan y TODAS sus tareas de la base de datos PERMANENTEMENTE. Esta acción no se puede deshacer.",
                    "ELIMINAR TODO", "Cancelar"
                );
                if (!ok) return;
                deletePlanBtn.disabled = true;
                deletePlanBtn.textContent = "Borrando...";
                try {
                    const batch = db.batch();
                    const taskSnap = await db.collection('tasks').where('plan_id', '==', this.editId).get();
                    taskSnap.docs.forEach(doc => batch.delete(doc.ref));
                    batch.delete(db.collection('action_plans').doc(this.editId));
                    await batch.commit();
                    ToastService.success("Proyecto eliminado permanentemente.");
                    this.app.navigateTo('plans');
                } catch (error) {
                    ToastService.error("Error al eliminar: " + error.message);
                    deletePlanBtn.disabled = false;
                    deletePlanBtn.textContent = "Eliminar Permanente";
                }
            };
        }

        // ====== CREAR PLAN (modo nuevo, con validación de campos) ======
        form.onsubmit = async (e) => {
            e.preventDefault();
            if (this.editId) return; // El botón submit no aplica en modo edición

            const planData = collectPlanData();
            const errors = validateRequiredFields(planData);
            if (errors.length > 0) {
                ToastService.error(`Por favor llena los campos requeridos: ${errors.join(', ')}`);
                return;
            }

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = "Creando Plan...";

            try {
                const { form_tasks, ...purePlanData } = planData;
                const fullPlanData = {
                    ...purePlanData,
                    prevention: '',
                    creator_id: this.app.currentUser.uid,
                    creator_name: this.app.currentUser.name,
                    status: 'en_proceso',
                    progress: 0,
                    risk: 'green',
                };
                const planId = await FirebaseService.createActionPlan(fullPlanData, this.draftId);

                await FirebaseService.sendNotification(
                    planData.lead_id,
                    "Nuevo Plan Asignado (LÍDER)",
                    `Has sido asignado como líder del plan: ${planData.title}`,
                    `#plans/detail/${planId}`
                );

                if (planData.coordinator_id) {
                    await FirebaseService.sendNotification(
                        planData.coordinator_id,
                        "Nuevo Plan en Seguimiento",
                        `Has sido asignado para seguimiento del plan: ${planData.title}`,
                        `#plans/detail/${planId}`
                    );
                }
                
                // Procesar Tareas
                if (form_tasks && form_tasks.length > 0) {
                    for (const task of form_tasks) {
                        if (!task.deleted) {
                            const taskToSave = {
                                plan_id: planId,
                                title: task.title,
                                assigned_id: task.assigned_id,
                                helper_id: task.helper_id,
                                start_date: task.start_date,
                                due_date: task.due_date,
                                status: task.status
                            };
                            await FirebaseService.createTask(taskToSave);
                        }
                    }
                }

                ToastService.success("Plan de Mejora Continua y tareas creados.");
                this.app.navigateTo('plans');
            } catch (error) {
                ToastService.error("Error al crear plan: " + error.message);
                btn.disabled = false;
                btn.textContent = "Crear Plan de Mejora Continua";
            }
        };
    }
}
