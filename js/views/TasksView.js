import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class TasksView extends View {
    constructor(app) {
        super(app);
        this.editingPersonalId = null;
    }

    async render() {
        const container = this.createEl('div', 'tasks-view-container fade-in');
        
        container.innerHTML = `
            <div class="view-header" style="margin-bottom: 2.2rem;">
                <div>
                    <h1>Mis tareas</h1>
                    <p style="color: var(--rosa-med); font-weight: 600;">Control personal y cumplimiento de proyectos</p>
                </div>
            </div>

            <div class="tasks-sections-grid" style="display: flex; gap: 2.5rem; align-items: flex-start; flex-wrap: wrap;">
                
                <!-- SECCIÓN 1: ACTIVIDADES ASIGNADAS (DEL PROYECTO) -->
                <section class="assigned-tasks-section" style="flex: 1; min-width: 350px;">
                    <div class="section-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="font-size: 1.4rem;">🎯 Actividades Asignadas</h2>
                    </div>

                    <div class="apple-tabs" id="task-filter-tabs" style="margin-bottom: 1.5rem;">
                        <button class="apple-tab active" data-filter="all">Todas</button>
                        <button class="apple-tab" data-filter="overdue">Vencidas</button>
                        <button class="apple-tab" data-filter="upcoming">Próximas</button>
                    </div>

                    <div id="assigned-tasks-list" class="tasks-list">
                        <div class="loading-inline">Sincronizando con proyectos...</div>
                    </div>
                </section>

                <!-- SECCIÓN 2: MIS ACTIVIDADES (PENDIENTES LIBRES) -->
                <section class="personal-tasks-section glass-effect" style="flex: 0 0 450px; min-width: 320px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border); padding: 2.5rem;">
                    <div style="margin-bottom: 2rem; border-bottom: 2px solid rgba(210, 50, 143, 0.1); padding-bottom: 1rem;">
                        <h2 style="font-size: 1.5rem; margin-bottom: 0.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.4rem;">📝</span> Mis Actividades</h2>
                        <p style="font-size: 0.9rem; color: var(--text-dim); margin: 0;">Lista libre de pendientes personales</p>
                    </div>

                    <!-- Formulario Rápido Rediseñado -->
                    <div class="quick-add-form" style="margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px dashed var(--border);">
                        <div class="input-group" style="margin-bottom: 1.2rem;">
                            <label style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--rosa-strong); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.6rem;">✨ Nueva Actividad</label>
                            <input type="text" id="personal-task-title" placeholder="¿Qué tienes pendiente hoy?" class="search-input" style="width: 100%; border-radius: 14px; font-size: 1rem; padding: 0.9rem 1.2rem;">
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="input-group">
                                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.5rem;">📅 Fecha</label>
                                <input type="date" id="personal-task-date" class="search-input" style="width: 100%; border-radius: 12px; padding: 0.75rem;">
                            </div>
                            <div class="input-group">
                                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.5rem;">🕐 Hora</label>
                                <input type="time" id="personal-task-time" class="search-input" style="width: 100%; border-radius: 12px; padding: 0.75rem;">
                            </div>
                            <button class="primary-btn" id="add-personal-btn" style="grid-column: span 2; padding: 0.8rem; border-radius: 14px; font-weight: 800; margin-top: 0.5rem; box-shadow: 0 8px 20px rgba(210, 50, 143, 0.25);">Agregar Actividad</button>
                        </div>
                    </div>

                    <div id="personal-tasks-list" class="tasks-list">
                        <div class="loading-inline">Cargando tus recordatorios...</div>
                    </div>
                </section>

            </div>
        `;
        
        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        
        // Listeners Tabs Asignadas
        const tabs = document.querySelectorAll('.apple-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadAssignedTasks(tab.dataset.filter);
            };
        });

        // Listener Agregar Personal
        const addBtn = document.getElementById('add-personal-btn');
        if (addBtn) {
            addBtn.onclick = () => this.handleAddTask();
        }

        // Carga Inicial
        this.loadAssignedTasks('all');
        this.loadPersonalTasks();
    }

    async loadAssignedTasks(filter = 'all') {
        const container = document.getElementById('assigned-tasks-list');
        const now = new Date();
        now.setHours(0,0,0,0);
        
        try {
            const snapshot = await db.collection('tasks')
                .where('assigned_id', '==', this.app.currentUser.uid)
                .get();
            
            let allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 1. Obtener todos los planes involucrados
            const planIds = [...new Set(allTasks.map(t => t.plan_id))];
            const plansSnap = await Promise.all(
                planIds.map(id => db.collection('action_plans').doc(id).get())
            );
            
            const plansMap = {};
            const leadIds = new Set();
            
            plansSnap.forEach(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    plansMap[doc.id] = {
                        id: doc.id,
                        title: data.title,
                        lead_id: data.lead_id
                    };
                    if (data.lead_id) leadIds.add(data.lead_id);
                }
            });

            // 2. Obtener nombres de los líderes
            const leadNames = await FirebaseService.getUserNamesByIds(Array.from(leadIds));

            // 3. Filtrado previo (Siempre excluir canceladas)
            let filteredTasks = allTasks.filter(t => t.status !== 'cancelada');

            if (filter === 'overdue') {
                filteredTasks = filteredTasks.filter(t => {
                    if (!t.due_date || t.status === 'completado') return false;
                    const dueDate = new Date(t.due_date + 'T00:00:00');
                    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                    return diffDays <= 0;
                });
            } else if (filter === 'upcoming') {
                filteredTasks = filteredTasks.filter(t => {
                    if (!t.due_date || t.status === 'completado') return false;
                    const dueDate = new Date(t.due_date + 'T00:00:00');
                    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                    return diffDays > 0 && diffDays <= 2;
                });
            } else {
                filteredTasks = filteredTasks.filter(t => t.status !== 'completado');
            }

            if (filteredTasks.length === 0) {
                container.innerHTML = '<p class="empty-state" style="padding: 2rem;">No hay actividades asignadas pendientes.</p>';
                return;
            }

            // 4. Agrupar por Plan
            const groups = {};
            filteredTasks.forEach(t => {
                if (!groups[t.plan_id]) groups[t.plan_id] = [];
                groups[t.plan_id].push(t);
            });

            // 5. Ordenar grupos por urgencia (tarea más próxima)
            const sortedGroups = Object.entries(groups).map(([planId, tasks]) => {
                tasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                return { planId, tasks, minDate: new Date(tasks[0].due_date) };
            }).sort((a, b) => a.minDate - b.minDate);

            // 6. Renderizado
            container.innerHTML = sortedGroups.map((group, groupIdx) => {
                const plan = plansMap[group.planId] || { title: 'Proyecto Desconocido', lead_id: null };
                const leadName = leadNames[plan.lead_id] || 'No asignado';
                
                return `
                <div class="project-group-container animate-up" style="animation-delay: ${groupIdx * 0.1}s; margin-bottom: 2rem;">
                    <div class="project-group-header glass-effect">
                        <div class="header-main-info toggle-project" data-target="project-${group.planId}">
                            <div class="chevron"></div>
                            <div style="flex: 1;">
                                <h3 class="project-group-title">${plan.title}</h3>
                                <div class="project-group-meta">
                                    <span>👤 <strong>Líder:</strong> ${leadName}</span>
                                    <span style="margin-left: 1rem;">📋 <strong>${group.tasks.length}</strong> tareas</span>
                                </div>
                            </div>
                        </div>
                        <button class="secondary-btn sm view-plan-btn" data-plan-id="${group.planId}" style="flex-shrink: 0; padding: 0.5rem 1rem; font-size: 0.7rem;">
                            📂 Ver Plan
                        </button>
                    </div>
                    
                    <div id="project-${group.planId}" class="project-tasks-list">
                        ${(() => {
                            const parents = group.tasks.filter(t => !t.parent_id);
                            const subtasks = group.tasks.filter(t => t.parent_id);
                            
                            const renderTask = (t, isSub = false) => {
                                const dueDate = new Date(t.due_date + 'T00:00:00');
                                const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                                
                                let dateClass = 'on-time';
                                if (diffDays <= 0) dateClass = 'critical';
                                else if (diffDays <= 2) dateClass = 'warning';

                                let indicator = 'indicator-yellow';
                                if (t.status === 'en_proceso') indicator = 'indicator-blue';
                                else if (t.status === 'completado') indicator = 'indicator-green';
                                else if (t.status === 'cancelada') indicator = 'indicator-cancelada';
                                if (diffDays < 0 && !['completado', 'cancelada'].includes(t.status)) indicator = 'indicator-red';

                                const lastNote = t.lastNote ? `<div class="task-last-note"><strong>💬 ${t.lastNoteBy || 'Nota'}:</strong> ${t.lastNote}</div>` : '';
                                const hasChildren = !isSub && subtasks.some(s => s.parent_id === t.id);

                                return `
                                <div class="task-card-mini ${isSub ? 'is-subtask' : ''} ${isSub ? 'hidden' : ''}" 
                                     data-parent="${isSub ? t.parent_id : ''}"
                                     style="animation-delay: ${groupIdx * 0.1 + (group.tasks.indexOf(t) * 0.05)}s;">
                                    <div class="task-indicator ${indicator}"></div>
                                    <div style="flex: 1; min-width: 0;">
                                        <h4 class="task-title-mini" style="display: flex; align-items: center; gap: 0.4rem;">
                                            ${hasChildren ? `<span class="toggle-sub-mini" data-id="${t.id}" style="cursor: pointer; transition: transform 0.3s; display: inline-block;">⌄</span>` : ''}
                                            ${isSub ? '<span class="subtask-indicator">↳</span>' : ''}
                                            ${t.title}
                                        </h4>
                                        ${lastNote}
                                        <div class="task-mini-meta">
                                            <div class="task-date-badge sm ${dateClass}">
                                                <span class="date-icon">${diffDays <= 0 ? '⚠️' : '📅'}</span>
                                                <span class="date-text" style="font-size: 0.75rem;">${t.due_date}</span>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase;">Estado:</span>
                                                <select class="status-selector-sm" data-id="${t.id}" data-title="${t.title}" style="font-size: 0.65rem; padding: 0.3rem 1.5rem 0.3rem 0.6rem;">
                                                    <option value="pendiente" ${t.status === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                                                    <option value="en_proceso" ${t.status === 'en_proceso' ? 'selected' : ''}>⚡ En Proceso</option>
                                                    <option value="completado" ${t.status === 'completado' ? 'selected' : ''}>✅ Completada</option>
                                                    <option value="cancelada" ${t.status === 'cancelada' ? 'selected' : ''}>🚫 Cancelada</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                `;
                            };

                            return parents.map(p => {
                                const children = subtasks.filter(s => s.parent_id === p.id);
                                return renderTask(p) + children.map(c => renderTask(c, true)).join('');
                            }).join('') + subtasks.filter(s => !parents.some(p => p.id === s.parent_id)).map(s => renderTask(s, true)).join('');
                        })()}
                    </div>
                </div>
                `;
            }).join('');

            // Inyectar Modal de Notas si no existe
            if (!document.getElementById('task-note-modal')) {
                const modalDiv = document.createElement('div');
                modalDiv.id = 'task-note-modal';
                modalDiv.className = 'modal hidden';
                modalDiv.innerHTML = `
                    <div class="modal-content glass-effect" style="max-width: 500px;">
                        <div class="modal-header">
                            <h3 id="note-modal-title">Actualizar Actividad</h3>
                            <button class="modal-close-x" id="close-task-note-modal">✕</button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="note-task-id">
                            <input type="hidden" id="note-new-status">
                            <div class="input-group">
                                <p style="font-size: 0.9rem; color: var(--text-dim); margin-bottom: 1rem;">Estás cambiando el estado a: <strong id="note-status-label" style="color: var(--rosa-strong);"></strong></p>
                                <label>Nota / Observación</label>
                                <textarea id="modal-note-textarea" placeholder="¿Qué avances hubo? (Esta nota será visible para el equipo)" class="search-input" style="width: 100%; height: 100px; padding: 0.8rem; border-radius: var(--radius-md);"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                            <button class="secondary-btn" id="cancel-task-note-modal">Cancelar</button>
                            <button class="primary-btn" id="save-task-note">Guardar Actualización</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalDiv);
            }

            // Listeners toggle
            container.querySelectorAll('.toggle-project').forEach(header => {
                header.onclick = () => {
                    const targetId = header.dataset.target;
                    const target = document.getElementById(targetId);
                    const container = header.closest('.project-group-container');
                    container.classList.toggle('collapsed');
                };
            });
 
            // Listeners toggle subtasks
            container.querySelectorAll('.toggle-sub-mini').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const parentId = btn.dataset.id;
                    const children = container.querySelectorAll(`.task-card-mini[data-parent="${parentId}"]`);
                    children.forEach(c => c.classList.toggle('hidden'));
                    const isCollapsed = children[0]?.classList.contains('hidden');
                    btn.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                };
            });

            // Listeners status (ahora abren modal)
            container.querySelectorAll('.status-selector-sm').forEach(select => {
                select.onchange = (e) => {
                    const newStatus = e.target.value;
                    const taskId = select.dataset.id;
                    const taskTitle = select.dataset.title;
                    this.openNoteModal(taskId, taskTitle, newStatus, filter);
                    // Revertir el select temporalmente hasta que se guarde la nota
                    e.target.value = e.target.defaultValue; 
                };
                // Guardar el valor inicial para revertir si se cancela
                select.defaultValue = select.value;
            });

            // Listeners view plan
            container.querySelectorAll('.view-plan-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    this.app.navigateTo(`plans/detail/${btn.dataset.planId}`);
                };
            });

        } catch (error) {
            console.error(error);
            container.innerHTML = '<p class="error-msg">Error al cargar tareas asignadas: ' + error.message + '</p>';
        }
    }

    openNoteModal(taskId, title, newStatus, currentFilter) {
        const modal = document.getElementById('task-note-modal');
        const titleEl = document.getElementById('note-modal-title');
        const labelEl = document.getElementById('note-status-label');
        const textArea = document.getElementById('modal-note-textarea');
        const saveBtn = document.getElementById('save-task-note');
        
        const statusMap = {
            'pendiente': '⏳ Pendiente',
            'en_proceso': '⚡ En Proceso',
            'completado': '✅ Completada',
            'cancelada': '🚫 Cancelada'
        };

        titleEl.textContent = title;
        labelEl.textContent = statusMap[newStatus] || newStatus;
        textArea.value = '';
        modal.classList.remove('hidden');

        document.getElementById('close-task-note-modal').onclick = () => modal.classList.add('hidden');
        document.getElementById('cancel-task-note-modal').onclick = () => modal.classList.add('hidden');

        saveBtn.onclick = async () => {
            const note = textArea.value.trim();
            if (!note) {
                ToastService.warning("Por favor agrega una nota para el equipo.");
                return;
            }

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = "Guardando...";

                const taskRef = db.collection('tasks').doc(taskId);
                await taskRef.update({
                    status: newStatus,
                    lastNote: note,
                    lastNoteBy: this.app.currentUser.name,
                    lastNoteAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await taskRef.collection('notes').add({
                    text: note,
                    status: newStatus,
                    createdBy: this.app.currentUser.name,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                ToastService.success("Actividad actualizada correctamente.");
                modal.classList.add('hidden');
                this.loadAssignedTasks(currentFilter);
            } catch (error) {
                console.error(error);
                ToastService.error("Error al actualizar la actividad.");
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = "Guardar Actualización";
            }
        };
    }

    async loadPersonalTasks() {
        const container = document.getElementById('personal-tasks-list');
        const now = new Date();
        
        try {
            const tasks = await FirebaseService.getPersonalTasks(this.app.currentUser.uid);
            
            if (tasks.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 4rem 1rem; color: var(--text-dim);">
                        <div style="font-size: 4rem; margin-bottom: 1.5rem; filter: grayscale(1); opacity: 0.3;">📝</div>
                        <p style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">No tienes pendientes personales</p>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.7;">Las actividades que agregues aparecerán aquí.</p>
                    </div>`;
                return;
            }

            const fmtDate = (date, time) => {
                if (!date) return null;
                const d = new Date(date + 'T12:00:00');
                const dateStr = d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
                return time ? `${dateStr} · ${time}` : dateStr;
            };

            const isOverdueCheck = (date, time) => {
                if (!date) return false;
                const isoStr = time ? `${date}T${time}:00` : `${date}T23:59:59`;
                return new Date(isoStr) < now;
            };

            container.innerHTML = tasks.filter(t => t.status !== 'cancelada').map((t, i) => {
                const isDone = t.status === 'completado';
                const isOverdue = !isDone && isOverdueCheck(t.due_date, t.due_time);
                const dateLabel = fmtDate(t.due_date, t.due_time);

                let dateBadgeBg = 'rgba(0,0,0,0.06)';
                let dateBadgeColor = 'var(--text-dim)';
                if (isOverdue)        { dateBadgeBg = '#fee2e2'; dateBadgeColor = '#b91c1c'; }
                else if (t.due_date)  { dateBadgeBg = 'rgba(210,50,143,0.08)'; dateBadgeColor = 'var(--rosa-strong)'; }

                return `
                <div class="personal-item animate-up ${isDone ? 'done' : ''}" 
                     style="animation-delay: ${i * 0.05}s; display: flex; align-items: flex-start; gap: 0.85rem; padding: 1rem 1.1rem;
                            background: ${isDone ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.6)'};
                            border-radius: var(--radius-sm); margin-bottom: 0.65rem;
                            border: 1px solid ${isOverdue ? '#fca5a5' : 'var(--border)'};
                            transition: box-shadow 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
                    
                    <!-- Checkbox -->
                    <label style="display: flex; align-items: center; margin-top: 2px; cursor: pointer; flex-shrink: 0;">
                        <input type="checkbox" id="personal-chk-${t.id}" ${isDone ? 'checked' : ''}
                               style="width: 18px; height: 18px; accent-color: var(--rosa-med); cursor: pointer;">
                    </label>

                    <!-- Info -->
                    <div style="flex: 1; min-width: 0;">
                        <p style="font-weight: 600; font-size: 0.93rem; margin: 0 0 0.3rem;
                                  text-decoration: ${isDone ? 'line-through' : 'none'};
                                  opacity: ${isDone ? 0.5 : 1};
                                  color: ${isOverdue ? '#b91c1c' : 'var(--text-main)'};
                                  white-space: normal; line-height: 1.4;">
                            ${t.title}
                        </p>
                        ${dateLabel ? `
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;
                                     font-size: 0.73rem; font-weight: 700;
                                     background: ${dateBadgeBg}; color: ${dateBadgeColor};
                                     padding: 2px 8px; border-radius: 20px;">
                            ${isOverdue ? '⚠️' : (t.due_time ? '🕐' : '📅')} ${dateLabel}
                        </span>` : ''}
                    </div>

                    <!-- Acciones -->
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;">
                        <button class="edit-personal-btn" data-id="${t.id}"
                                style="background: transparent; border: none; cursor: pointer;
                                       opacity: 0.35; font-size: 1rem; padding: 2px 4px;
                                       transition: opacity 0.2s; border-radius: 6px;"
                                onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">✏️</button>
                                
                        <button class="cancel-personal-btn" data-id="${t.id}" title="Cancelar"
                                 style="background: transparent; border: none; cursor: pointer;
                                        opacity: 0.35; font-size: 1rem; padding: 2px 4px;
                                        transition: opacity 0.2s; border-radius: 6px;"
                                 onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">🚫</button>
                                 
                        <button class="delete-personal-btn" data-id="${t.id}"
                                style="background: transparent; border: none; cursor: pointer;
                                       opacity: 0.35; font-size: 1rem; padding: 2px 4px;
                                       transition: opacity 0.2s; border-radius: 6px;"
                                onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">🗑️</button>
                    </div>
                </div>`;
            }).join('');

            // Listeners checkbox
            container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                chk.onchange = async () => {
                    const taskId = chk.id.replace('personal-chk-', '');
                    await this.togglePersonalStatus(taskId, chk.checked);
                };
            });

            // Listeners editar
            container.querySelectorAll('.edit-personal-btn').forEach(btn => {
                btn.onclick = () => this.editPersonalTask(btn.dataset.id, tasks.find(t => t.id === btn.dataset.id));
            });

            // Listeners cancelar con Modal Custom
            container.querySelectorAll('.cancel-personal-btn').forEach(btn => {
                btn.onclick = async () => {
                    const ok = await ToastService.confirm('¿Cancelar esta actividad? Dejará de ser visible en tus pendientes.', 'Sí, cancelar', 'No');
                    if (ok) {
                        await db.collection('personal_tasks').doc(btn.dataset.id).update({ status: 'cancelada' });
                        this.loadPersonalTasks();
                    }
                };
            });

            // Listeners eliminar con Modal Custom
            container.querySelectorAll('.delete-personal-btn').forEach(btn => {
                btn.onclick = async () => {
                    const ok = await ToastService.confirm('¿Eliminar esta actividad permanentemente?', 'Sí, eliminar', 'Cancelar', 'danger');
                    if (ok) {
                        await FirebaseService.deletePersonalTask(btn.dataset.id);
                        this.loadPersonalTasks();
                    }
                };
            });

        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem; padding: 1rem;">Error al cargar actividades. Intenta recargar.</p>';
        }
    }

    async handleAddTask() {
        const titleInput = document.getElementById('personal-task-title');
        const dateInput  = document.getElementById('personal-task-date');
        const timeInput  = document.getElementById('personal-task-time');
        
        if (!titleInput.value.trim()) {
            ToastService.error("Escribe qué tienes pendiente");
            titleInput.focus();
            return;
        }

        const btn = document.getElementById('add-personal-btn');
        btn.disabled = true;
        btn.textContent = this.editingPersonalId ? 'Guardando...' : 'Creando...';

        try {
            if (this.editingPersonalId) {
                await db.collection('personal_tasks').doc(this.editingPersonalId).update({
                    title: titleInput.value.trim(),
                    due_date: dateInput.value || null,
                    due_time: timeInput.value || null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                ToastService.success("¡Actividad actualizada!");
            } else {
                await FirebaseService.createPersonalTask(
                    this.app.currentUser.uid,
                    titleInput.value.trim(),
                    dateInput.value || null,
                    timeInput.value || null
                );
                ToastService.success("¡Actividad agregada!");
            }
            
            // Reset form
            this.editingPersonalId = null;
            titleInput.value = '';
            dateInput.value  = '';
            timeInput.value  = '';
            btn.textContent = '+ Agregar';
            
            this.loadPersonalTasks();
        } catch (error) {
            ToastService.error("No se pudo procesar la solicitud");
        } finally {
            btn.disabled = false;
        }
    }

    editPersonalTask(taskId, task) {
        this.editingPersonalId = taskId;
        
        const titleInput = document.getElementById('personal-task-title');
        const dateInput  = document.getElementById('personal-task-date');
        const timeInput  = document.getElementById('personal-task-time');
        const btn = document.getElementById('add-personal-btn');

        titleInput.value = task.title;
        dateInput.value = task.due_date || '';
        timeInput.value = task.due_time || '';
        
        btn.textContent = '💾 Actualizar';
        titleInput.focus();
        
        // Scroll al formulario
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async togglePersonalStatus(taskId, isDone) {
        try {
            await db.collection('personal_tasks').doc(taskId).update({
                status: isDone ? 'completado' : 'pendiente'
            });
            this.loadPersonalTasks();
        } catch (error) {
            ToastService.error("Error al actualizar");
        }
    }
}
