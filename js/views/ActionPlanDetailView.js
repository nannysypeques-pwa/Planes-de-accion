import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class ActionPlanDetailView extends View {
    constructor(app, planId) {
        super(app);
        this.planId = planId;
        this.plan = null;
        this.taskView = 'list'; // 'list' o 'chronogram'
    }

    async render() {
        const container = this.createEl('div', 'plan-detail-view fade-in');

        try {
            // Cargar datos del plan
            const doc = await db.collection('action_plans').doc(this.planId).get();
            if (!doc.exists) return this.createEl('div', 'error', 'Plan no encontrado');
            this.plan = { id: doc.id, ...doc.data() };

            const isLead = this.app.currentUser.uid === this.plan.lead_id;
            const isManager = ['gerente', 'coordinador', 'coordinadora'].includes(this.app.currentUser.role);
            const isMember = this.plan.members_ids?.includes(this.app.currentUser.uid);
            
            // Regla: Gerente edita todo, coordinador/miembro solo lo que crearon
            const canEdit = this.app.currentUser.role === 'gerente' || 
                           (['coordinador', 'coordinadora', 'miembro'].includes(this.app.currentUser.role) && 
                            this.plan.creator_id === this.app.currentUser.uid);

            const canEditTask = ['gerente', 'coordinador', 'coordinadora'].includes(this.app.currentUser.role) || this.plan.lead_id === this.app.currentUser.uid;

            // Cargar tareas para validar paso 10
            const taskSnap = await db.collection('tasks').where('plan_id', '==', this.planId).get();
            const tasksData = taskSnap.docs.map(doc => doc.data());
            const allTasksCompleted = tasksData.length > 0 && tasksData.every(t => t.status === 'completado');

            container.innerHTML = `
                <div class="view-header">
                    <div class="header-main">
                        <button class="back-link" onclick="window.history.back()">← Volver</button>
                        <h1>${this.escapeHTML(this.plan.title)}</h1>
                        ${canEdit ? `
                            <button class="edit-plan-btn" id="edit-plan-btn">
                                <span>✏️</span> Editar Plan
                            </button>
                        ` : ''}
                    </div>
                    <div class="plan-badges">
                        <span class="badge" style="background: ${this.plan.risk === 'red' ? '#ef4444' : 'var(--rosa-med)'}; color: white;">${this.plan.status}</span>
                    </div>
                </div>

                <div class="plan-grid">
                    <div class="plan-main-info glass-effect">
                        <section>
                            <div class="section-badge">D2</div>
                            <h3>Problemática</h3>
                            <p>${this.escapeHTML(this.plan.problem)}</p>
                            ${this.plan.kpi_nok ? `
                                <div class="kpi-badge kpi-nok">
                                    <strong>KPI NOK:</strong> ${this.escapeHTML(this.plan.kpi_nok)}
                                </div>
                            ` : ''}
                        </section>

                        ${this.plan.whys && this.plan.whys.length > 0 ? `
                        <section class="animate-up">
                            <div class="section-badge">D4</div>
                            <h3>Análisis Causa Raíz (Los ${this.plan.whys.length} Porqués)</h3>
                            <div class="whys-container">
                                ${this.plan.whys.map((w, i) => `
                                    <div class="why-item">
                                        <div class="why-number">${i + 1}</div>
                                        <p class="why-text">${this.escapeHTML(w)}</p>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="reverse-summary-box">
                                <h4>Validación de Lógica (Resumen al revés)</h4>
                                <div class="reverse-summary-list">
                                    ${this.plan.whys.slice().reverse().map((w, i, arr) => {
                                        const current = w;
                                        const next = arr[i + 1];
                                        if (next) {
                                            return `<div class="reverse-item">Porque <strong>${this.escapeHTML(current)}</strong>, entonces <strong>${this.escapeHTML(next)}</strong>.</div>`;
                                        } else {
                                            // Último paso: del porqué 1 al problema de D4 (o el general)
                                            const baseProblem = this.plan.problem_d4 || this.plan.problem;
                                            return `<div class="reverse-item">Porque <strong>${this.escapeHTML(current)}</strong>, el resultado fue: <strong>${this.escapeHTML(baseProblem)}</strong>.</div>`;
                                        }
                                    }).join('')}
                                </div>
                            </div>
                        </section>
                        ` : ''}

                        ${this.plan.prevention ? `
                        <section class="animate-up">
                            <div class="section-badge">D7</div>
                            <h3>Prevención de Recurrencia</h3>
                            <div class="d7-box">
                                <p>${this.escapeHTML(this.plan.prevention)}</p>
                            </div>
                        </section>
                        ` : ''}

                        <section>
                            <h3>Meta Esperada</h3>
                            <p>${this.plan.objective || 'N/A'}</p>
                            ${this.plan.kpi_expected ? `
                                <div class="kpi-badge kpi-expected">
                                    <strong>KPI Meta:</strong> ${this.escapeHTML(this.plan.kpi_expected)}
                                </div>
                            ` : ''}
                        </section>
                        <section>
                            <h3>Recursos</h3>
                            <p>${this.plan.resources ? this.escapeHTML(this.plan.resources) : 'No especificados'}</p>
                        </section>
                        
                        ${isLead && this.plan.status !== 'completado' && allTasksCompleted ? `
                            <div class="completion-zone glass-effect animate-up">
                                <h3>Finalización</h3>
                                <p>Si todas las tareas están listas, marca el proyecto como cumplido para revisión.</p>
                                <button class="primary-btn pulse" id="mark-complete-btn">Marcar como CUMPLIDO</button>
                            </div>
                        ` : ''}

                        ${isManager && this.plan.status === 'en_revision' ? `
                            <div class="manager-review-zone glass-effect animate-up">
                                <h3>Revisión de Gerencia</h3>
                                <p>Valida los resultados antes del cierre definitivo.</p>
                                <div class="form-actions">
                                    <button class="badge" style="background: #ef4444; color: white; border: none; cursor: pointer;" id="reject-plan">Solicitar Ajustes</button>
                                    <button class="badge" style="background: var(--success); color: white; border: none; cursor: pointer;" id="approve-plan">Aprobar y Cerrar</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="plan-sidebar glass-effect">
                        <h3>Detalles de Control</h3>
                        <div class="meta-item">
                            <span>Líder:</span>
                            <strong id="leader-name-display">${this.plan.lead_id === this.app.currentUser.uid ? 'Tú (Líder)' : 'Cargando...'}</strong>
                        </div>
                        <div class="meta-item">
                            <span>Fecha Compromiso:</span>
                            <strong>${this.plan.due_date === 'recurrent' ? 'Actividad Recurrente' : this.plan.due_date}</strong>
                        </div>
                        <div class="meta-item">
                            <span>Progreso:</span>
                            <div class="progress-bar lg"><div class="progress" style="width: ${this.plan.progress}%"></div></div>
                            <small>${this.plan.progress}% completado</small>
                        </div>

                        ${isLead && (!this.plan.members_ids || this.plan.members_ids.length === 0) ? `
                            <div class="lead-actions animate-up">
                                <h4>Selecciona tu Equipo</h4>
                                <button class="primary-btn sm" id="manage-team-btn">Gestionar Equipo</button>
                            </div>
                        ` : `
                            <div class="team-list">
                                <h4>Equipo de Trabajo</h4>
                                <div id="team-members-container" class="avatar-list">
                                    ${this.plan.members_ids?.length > 0 ? 'Cargando miembros...' : '<p>Sin miembros asignados</p>'}
                                </div>
                                ${isLead ? '<button class="secondary-btn sm" id="manage-team-btn">Editar Equipo</button>' : ''}
                            </div>
                        `}
                    </div>
                </div>

                <div class="tasks-section" id="plan-tasks">
                    <div class="section-header">
                        <h2>Tareas</h2>
                        <div class="header-actions">
                            <div class="apple-tabs sm" style="margin-bottom: 0;">
                                <button class="apple-tab ${this.taskView === 'list' ? 'active' : ''}" data-view="list">Lista</button>
                                <button class="apple-tab ${this.taskView === 'chronogram' ? 'active' : ''}" data-view="chronogram">Cronograma</button>
                            </div>
                            ${canEditTask ? '<button class="action-btn sm" id="add-task-btn">+ Nueva Tarea</button>' : ''}
                        </div>
                    </div>
                    <div id="tasks-container" class="tasks-list-container">
                        <!-- Tareas cargadas dinámicamente -->
                        <div class="loading-inline">Cargando tareas...</div>
                    </div>
                </div>

                <!-- Modal de Selección de Equipo -->
                <div id="team-modal" class="modal hidden">
                    <div class="modal-content glass-effect team-modal-content">
                        <div class="modal-header">
                            <div>
                                <h3>Gestionar Equipo</h3>
                                <p style="font-size:0.85rem; color:var(--text-dim); margin-top:0.25rem;">Selecciona los miembros que participarán en este plan</p>
                            </div>
                            <button class="modal-close-x" id="close-modal">✕</button>
                        </div>
                        <div class="modal-body-scroll" id="members-selection-list"></div>
                        <div class="modal-footer">
                            <button class="secondary-btn" id="close-modal-footer">Cancelar</button>
                            <button class="primary-btn" id="save-team">Guardar Equipo</button>
                        </div>
                    </div>
                </div>

                <!-- Modal de Edición de Plan -->
                <div id="edit-plan-modal" class="modal hidden">
                    <div class="modal-content glass-effect plan-edit-modal-content">
                        <div class="modal-header">
                            <div>
                                <h3>Editar Plan de Acción</h3>
                                <p style="font-size: 0.85rem; color: var(--text-dim);">Actualiza la información estratégica del plan</p>
                            </div>
                            <button class="modal-close-x" id="close-edit-modal">✕</button>
                        </div>
                        <div class="modal-body" id="edit-plan-form-container">
                            <!-- Formulario cargado dinámicamente -->
                        </div>
                        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; gap: 0.8rem;">
                                <button class="badge" style="background: #ef4444; color: white; border: none; cursor: pointer; padding: 0.8rem 1.5rem;" id="cancel-plan-btn">Cancelar Proyecto</button>
                                ${this.app.currentUser.role === 'gerente' ? `<button class="badge" style="background: #000; color: white; border: none; cursor: pointer; padding: 0.8rem 1.5rem;" id="delete-plan-btn">Eliminar Permanente</button>` : ''}
                            </div>
                            <div style="display: flex; gap: 1rem;">
                                <button class="secondary-btn" id="cancel-edit-plan">No guardar</button>
                                <button class="primary-btn" id="save-plan-edits">Guardar Cambios</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            return container;
        } catch (error) {
            console.error("Error al renderizar detalle:", error);
            return this.createEl('div', 'error', 'Error al cargar el plan');
        }
    }

    async afterRender() {
        this.app.showNavigation();
        if (!this.plan) return;

        // Cargar Tareas
        this.loadTasks();

        // Cargar Nombres de Miembros
        if (this.plan.members_ids?.length > 0) {
            this.loadTeamMemberNames();
        }

        // Cargar Nombre del Líder si no es el usuario actual
        if (this.plan.lead_id !== this.app.currentUser.uid) {
            this.loadLeaderName();
        }

        const isLead = this.app.currentUser.uid === this.plan.lead_id;
        const isManager = ['gerente', 'coordinador', 'coordinadora'].includes(this.app.currentUser.role);
        const canEdit = this.app.currentUser.role === 'gerente' || 
                       (['coordinador', 'coordinadora', 'miembro'].includes(this.app.currentUser.role) && 
                        this.plan.creator_id === this.app.currentUser.uid);

        const canEditTask = ['gerente', 'coordinador', 'coordinadora'].includes(this.app.currentUser.role) || this.plan.lead_id === this.app.currentUser.uid;

        if (isLead) {
            const mgBtn = document.getElementById('manage-team-btn');
            if (mgBtn) mgBtn.onclick = () => this.toggleTeamModal(true);

            document.getElementById('close-modal').onclick = () => this.toggleTeamModal(false);
            const closeFooterBtn = document.getElementById('close-modal-footer');
            if (closeFooterBtn) closeFooterBtn.onclick = () => this.toggleTeamModal(false);
            document.getElementById('save-team').onclick = () => this.saveTeamSelection();

            const completeBtn = document.getElementById('mark-complete-btn');
            if (completeBtn) completeBtn.onclick = () => this.updatePlanStatus('en_revision');
        }

        // Permitir crear tareas a cualquier persona que tenga permiso de tareas
        if (canEditTask) {
            const addTaskBtn = document.getElementById('add-task-btn');
            if (addTaskBtn) addTaskBtn.onclick = () => this.showTaskForm();
        }

        if (isManager) {
            const approveBtn = document.getElementById('approve-plan');
            if (approveBtn) approveBtn.onclick = () => this.updatePlanStatus('completado');

            const rejectBtn = document.getElementById('reject-plan');
            if (rejectBtn) rejectBtn.onclick = () => this.updatePlanStatus('en_proceso');
        }

        // Configurar botón de edición si tiene permiso
        const editPlanBtn = document.getElementById('edit-plan-btn');
        if (editPlanBtn) {
            editPlanBtn.onclick = () => this.showEditPlanModal();
        }

        // Delegación de eventos para botones de tareas (Editar/Eliminar)
        const tasksContainer = document.getElementById('plan-tasks');
        if (tasksContainer) {
            tasksContainer.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-task');
                const delBtn = e.target.closest('.delete-task');
                
                if (editBtn) {
                    this.showTaskForm(editBtn.dataset.id);
                } else if (delBtn) {
                    this.deleteTask(delBtn.dataset.id);
                } else if (e.target.closest('.subtask')) {
                    const parentId = e.target.closest('.subtask').dataset.id;
                    this.showTaskForm(null, parentId);
                } else if (e.target.closest('.toggle-subtasks')) {
                    const parentId = e.target.closest('.toggle-subtasks').dataset.id;
                    this.toggleSubtasks(parentId);
                }
            });
        }

        const cancelPlanBtn = document.getElementById('cancel-plan-btn');
        if (cancelPlanBtn) cancelPlanBtn.onclick = () => this.cancelPlan();

        const deletePlanBtn = document.getElementById('delete-plan-btn');
        if (deletePlanBtn) deletePlanBtn.onclick = () => this.deletePlanPermanent();

        const closeEditModal = document.getElementById('close-edit-modal');
        if (closeEditModal) closeEditModal.onclick = () => document.getElementById('edit-plan-modal').classList.add('hidden');
        
        const cancelEditPlan = document.getElementById('cancel-edit-plan');
        if (cancelEditPlan) cancelEditPlan.onclick = () => document.getElementById('edit-plan-modal').classList.add('hidden');

        const savePlanBtn = document.getElementById('save-plan-edits');
        if (savePlanBtn) savePlanBtn.onclick = () => this.savePlanEdits();

        // Cambio de vista de tareas
        document.querySelectorAll('.apple-tab[data-view]').forEach(tab => {
            tab.onclick = () => {
                this.taskView = tab.dataset.view;
                document.querySelectorAll('.apple-tab[data-view]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadTasks();
            };
        });

        this.loadTasks();
    }

    async updatePlanStatus(newStatus) {
        try {
            await db.collection('action_plans').doc(this.planId).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Notificaciones de flujo
            if (newStatus === 'en_revision') {
                await FirebaseService.sendNotification(this.plan.creator_id, "Plan en Revisión", `El plan "${this.plan.title}" ha sido marcado como cumplido por el líder.`, `#plans/detail/${this.planId}`);
            }

            ToastService.success("Estado actualizado: " + newStatus);
            this.app.router();
        } catch (error) {
            ToastService.error("Error: " + error.message);
        }
    }

    async deleteTask(taskId) {
        const confirmed = await ToastService.confirm("¿Estás seguro de eliminar esta tarea? Esta acción no se puede deshacer.", "Eliminar", "Cancelar");
        if (!confirmed) return;
        
        try {
            await db.collection('tasks').doc(taskId).delete();
            ToastService.success("Tarea eliminada exitosamente");
            this.loadTasks(); // Recargar la lista
        } catch (error) {
            console.error(error);
            ToastService.error("Error al eliminar la tarea");
        }
    }

    async loadTasks() {
        const container = document.getElementById('tasks-container');
        try {
            const snapshot = await db.collection('tasks').where('plan_id', '==', this.planId).get();
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.tasksData = tasks; // Store for edit access

            if (tasks.length === 0) {
                container.innerHTML = '<div class="empty-state">No hay tareas creadas aún.</div>';
                return;
            }

            const members = await FirebaseService.getAllMembers();
            const membersMap = {};
            members.forEach(m => { membersMap[m.uid] = m; });

            if (this.taskView === 'list') {
                container.innerHTML = this.renderTaskList(tasks, membersMap);
            } else {
                container.innerHTML = this.renderTaskChronogram(tasks, membersMap);
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = 'Error al cargar tareas';
        }
    }

    renderTaskList(tasks, membersMap) {
        const statusConfig = {
            pendiente:   { label: 'Pendiente',  icon: '⏳', cls: 'st-pending' },
            en_proceso:  { label: 'En Proceso', icon: '⚡', cls: 'st-progress' },
            completado:  { label: 'Completado', icon: '✓',  cls: 'st-done' },
        };

        const fmtDate = iso => {
            if (!iso || iso === 'N/A') return 'Sin fecha';
            const d = new Date(iso + 'T12:00:00');
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        };

        const daysLeft = iso => {
            if (!iso) return null;
            const diff = Math.round((new Date(iso + 'T12:00:00') - new Date()) / 86400000);
            return diff;
        };

        const initials = name => (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        const canEditTask = ['gerente', 'coordinador', 'coordinadora'].includes(this.app.currentUser.role) || this.plan.lead_id === this.app.currentUser.uid;

        // Agrupar tareas: padres y sus hijos
        const parents = tasks.filter(t => !t.parent_id);
        const subtasks = tasks.filter(t => t.parent_id);

        const renderSingleRow = (t, isSub = false) => {
            const resp = membersMap[t.assigned_id] || null;
            const help = t.helper_id ? membersMap[t.helper_id] : null;
            const st = statusConfig[t.status] || statusConfig.pendiente;
            const days = daysLeft(t.due_date);
            const timeStatus = days === null ? '' : (days < 0 ? 'st-overdue' : (days <= 3 ? 'st-soon' : 'st-ontime'));
            
            let daysHtml = '';
            if (t.status !== 'completado' && days !== null) {
                if (days < 0)      daysHtml = `<span class="days-chip overdue">⚠️ ${Math.abs(days)} días vencida</span>`;
                else if (days === 0) daysHtml = `<span class="days-chip today">🔔 Vence hoy</span>`;
                else if (days <= 3) daysHtml = `<span class="days-chip soon">🕬 ${days} días</span>`;
                else               daysHtml = `<span class="days-chip normal">📅 ${days} días restantes</span>`;
            } else if (t.status === 'completado') {
                daysHtml = `<span class="days-chip done">✅ Tarea Completada</span>`;
            }

            const hasChildren = subtasks.some(s => s.parent_id === t.id);

            return `
                <div class="task-row-premium ${st.cls} ${timeStatus} ${isSub ? 'is-subtask' : ''} ${isSub ? 'hidden' : ''}" 
                     data-id="${t.id}" 
                     ${isSub ? `data-parent="${t.parent_id}"` : ''}>
                    <div class="task-status-bar"></div>
                    <div class="task-row-content">
                        <div class="task-row-top">
                            <span class="task-status-pill ${st.cls}">${st.icon} ${st.label}</span>
                            ${daysHtml}
                            ${canEditTask ? `
                                <div class="task-actions">
                                    ${!isSub ? `<button class="task-action-btn subtask" data-id="${t.id}">+ SUBTAREA</button>` : ''}
                                    <button class="task-action-btn edit-task" data-id="${t.id}" title="Editar Tarea">✏️</button>
                                    <button class="task-action-btn delete delete-task" data-id="${t.id}" title="Eliminar Tarea">🗑️</button>
                                </div>
                            ` : ''}
                        </div>
                        <h4 class="task-title" style="display: flex; align-items: center; gap: 0.5rem;">
                            ${!isSub && hasChildren ? `<button class="toggle-subtasks" data-id="${t.id}" style="background: none; border: none; cursor: pointer; padding: 0; font-size: 1.2rem; transition: transform 0.3s;">⌄</button>` : ''}
                            ${isSub ? '<span class="subtask-indicator">↳</span>' : ''}
                            ${t.title}
                        </h4>
                        <div class="task-row-meta">
                            <div class="task-person">
                                <div class="avatar-sm">${resp ? initials(resp.name) : '?'}</div>
                                <div>
                                    <span>Responsable</span>
                                    <strong>${resp ? resp.name : 'Sin asignar'}</strong>
                                </div>
                            </div>
                            ${help ? `
                            <div class="task-person helper">
                                <div class="avatar-sm helper">${initials(help.name)}</div>
                                <div>
                                    <span>Apoyo</span>
                                    <strong>${help.name}</strong>
                                </div>
                            </div>` : ''}
                            <div class="task-dates">
                                <div class="date-item">
                                    <span>Inicio</span>
                                    <strong>${fmtDate(t.start_date)}</strong>
                                </div>
                                <div class="date-arrow">→</div>
                                <div class="date-item">
                                    <span>Límite</span>
                                    <strong>${fmtDate(t.due_date)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        return parents.map(p => {
            const children = subtasks.filter(s => s.parent_id === p.id);
            return renderSingleRow(p) + children.map(c => renderSingleRow(c, true)).join('');
        }).join('');
    }

    toggleSubtasks(parentId) {
        const children = document.querySelectorAll(`.task-row-premium[data-parent="${parentId}"]`);
        const btn = document.querySelector(`.toggle-subtasks[data-id="${parentId}"]`);
        children.forEach(c => {
            c.classList.toggle('hidden');
            c.classList.toggle('animate-down');
        });
        if (btn) {
            const isCollapsed = children[0]?.classList.contains('hidden');
            btn.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        }
    }

    renderTaskChronogram(tasks, membersMap) {
        const DAY_W    = 34;   // px per day column
        const NAME_W   = 220;  // px name column

        const fmtShort = iso => {
            if (!iso) return '';
            const d = new Date(iso + 'T12:00:00');
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        };

        const statusColor = {
            pendiente:  '#f59e0b',
            en_proceso: '#10b981',
            completado: '#3b82f6',
            bloqueado:  '#ef4444',
        };

        // ── Build date range ──────────────────────────────────────
        const today = new Date(); today.setHours(12, 0, 0, 0);

        const allDates = tasks.flatMap(t => [
            t.start_date ? new Date(t.start_date + 'T12:00:00') : null,
            t.due_date   ? new Date(t.due_date   + 'T12:00:00') : null,
        ]).filter(d => d && !isNaN(d));

        if (allDates.length === 0)
            return '<div class="empty-state">Las tareas no tienen fechas asignadas para el cronograma.</div>';

        const minDate = new Date(Math.min(...allDates));
        const maxDate = new Date(Math.max(...allDates, today));

        // Pad 3 days on each side
        const rangeStart = new Date(minDate); rangeStart.setDate(rangeStart.getDate() - 3);
        const rangeEnd   = new Date(maxDate);   rangeEnd.setDate(rangeEnd.getDate()   + 4);

        // Array of every day in range
        const days = [];
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1))
            days.push(new Date(d));

        const totalDays  = days.length;
        const trackW     = totalDays * DAY_W;

        // Helper: index of a date in the days array
        const dayIdx = iso => {
            if (!iso) return -1;
            const target = new Date(iso + 'T12:00:00').toDateString();
            return days.findIndex(d => d.toDateString() === target);
        };
        const todayIdx = days.findIndex(d => d.toDateString() === today.toDateString());

        // ── Month header (spanning cells) ─────────────────────────
        const monthGroups = [];
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        days.forEach((d, i) => {
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!monthGroups.length || monthGroups[monthGroups.length - 1].key !== key) {
                monthGroups.push({
                    key,
                    label: `${monthNames[d.getMonth()]} de ${d.getFullYear()}`,
                    count: 0
                });
            }
            monthGroups[monthGroups.length - 1].count++;
        });

        const monthHtml = monthGroups.map(mg =>
            `<div class="gc-month" style="width:${mg.count * DAY_W}px" title="${mg.label}">${mg.label}</div>`
        ).join('');

        // ── Day-number cells ──────────────────────────────────────
        const dayHtml = days.map((d, i) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isToday   = i === todayIdx;
            return `<div class="gc-day ${isWeekend ? 'wknd' : ''} ${isToday ? 'today' : ''}"
                         style="width:${DAY_W}px">${d.getDate()}</div>`;
        }).join('');

        // ── Per-task grid lines & today line (shared HTML) ────────
        const gridLinesHtml = days.map((d, i) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return `<div class="gc-vline ${isWeekend ? 'wknd' : ''}" style="left:${i * DAY_W}px"></div>`;
        }).join('');

        const todayLineHtml = todayIdx >= 0
            ? `<div class="gc-today-line" style="left:${todayIdx * DAY_W}px"></div>`
            : '';

        // ── Task rows ─────────────────────────────────────────────
        const sortedTasks = [];
        const parents = tasks.filter(t => !t.parent_id);
        const subtasks = tasks.filter(t => t.parent_id);
        parents.forEach(p => {
            sortedTasks.push(p);
            subtasks.filter(s => s.parent_id === p.id).forEach(s => sortedTasks.push(s));
        });

        const rowsHtml = sortedTasks.map(t => {
            const si = dayIdx(t.start_date);
            const di = dayIdx(t.due_date);
            const isSub = !!t.parent_id;
            const color = statusColor[t.status] || statusColor.pendiente;
            const initials = (membersMap[t.assigned_id]?.name || '?')
                .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

            let barsHtml = '';

            if (si >= 0 && di >= 0) {
                // Main task bar (start → due date)
                const barLeft  = si * DAY_W;
                const barWidth = Math.max(DAY_W, (di - si + 1) * DAY_W);
                barsHtml += `
                    <div class="gc-bar ${isSub ? 'subtask' : ''}" style="left:${barLeft}px; width:${barWidth}px; background:${color};"
                         title="${t.title} | ${fmtShort(t.start_date)} → ${fmtShort(t.due_date)}">
                        <span class="gc-bar-label">${isSub ? '↳ ' : ''}${t.title}</span>
                    </div>`;

                // Due-date diamond marker
                const markerLeft = (di + 1) * DAY_W - 8;
                barsHtml += `<div class="gc-due-marker" style="left:${markerLeft}px;"
                     title="Fecha objetivo: ${fmtShort(t.due_date)}"></div>`;

                // Delay bar (due_date → today) if overdue and not completed
                if (t.status !== 'completado' && todayIdx > di) {
                    const delayLeft  = (di + 1) * DAY_W;
                    const delayWidth = (todayIdx - di) * DAY_W;
                    const delayDays  = todayIdx - di;
                    barsHtml += `
                        <div class="gc-delay-bar" style="left:${delayLeft}px; width:${delayWidth}px;"
                             title="⚠️ ${delayDays} día(s) de retraso">
                            <span class="gc-bar-label">⚠️ +${delayDays}d retraso</span>
                        </div>`;
                }
            } else {
                barsHtml = `<span class="gc-no-dates">Sin fechas asignadas</span>`;
            }

            const respName = membersMap[t.assigned_id]?.name || 'Sin asignar';
            return `
                <div class="gc-task-row ${isSub ? 'is-subtask' : ''}">
                    <div class="gc-name-cell">
                        <div class="avatar-sm">${initials}</div>
                        <div class="gc-name-info">
                            <span class="gc-task-title" title="${t.title}">${isSub ? '↳ ' : ''}${t.title}</span>
                            <span class="gc-task-resp">${respName}</span>
                        </div>
                    </div>
                    <div class="gc-track" style="width:${trackW}px;">
                        ${gridLinesHtml}
                        ${todayLineHtml}
                        ${barsHtml}
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="gc-wrapper animate-up">
                <div class="gc-scroll">
                    <!-- Row 1: month spans -->
                    <div class="gc-header-row gc-month-row">
                        <div class="gc-name-cell gc-header-label"></div>
                        <div class="gc-months-strip" style="width:${trackW}px">${monthHtml}</div>
                    </div>
                    <!-- Row 2: day numbers -->
                    <div class="gc-header-row gc-days-row">
                        <div class="gc-name-cell gc-header-label">Actividad</div>
                        <div class="gc-days-strip" style="width:${trackW}px;">
                            ${dayHtml}
                            ${todayIdx >= 0 ? `<div class="gc-today-day-marker" style="left:${todayIdx * DAY_W}px; width:${DAY_W}px;">Hoy</div>` : ''}
                        </div>
                    </div>
                    <!-- Task rows -->
                    <div class="gc-body">${rowsHtml}</div>
                </div>
                <!-- Legend -->
                <div class="gc-legend">
                    <span class="gc-legend-item"><span class="gc-legend-dot" style="background:#f59e0b"></span>Pendiente</span>
                    <span class="gc-legend-item"><span class="gc-legend-dot" style="background:#10b981"></span>En Proceso</span>
                    <span class="gc-legend-item"><span class="gc-legend-dot" style="background:#3b82f6"></span>Completado</span>
                    <span class="gc-legend-item"><span class="gc-legend-dot" style="background:#ef4444"></span>Bloqueado</span>
                    <span class="gc-legend-item"><span class="gc-legend-dot delay"></span>Retraso</span>
                    <span class="gc-legend-item"><span class="gc-legend-diamond"></span>Fecha Objetivo</span>
                </div>
            </div>`;
    }

    async loadLeaderName() {
        if (!this.plan.lead_id) return;
        const names = await FirebaseService.getUserNamesByIds([this.plan.lead_id]);
        const display = document.getElementById('leader-name-display');
        if (display && names[this.plan.lead_id]) {
            display.textContent = names[this.plan.lead_id];
        }
    }

    async loadTeamMemberNames() {
        const container = document.getElementById('team-members-container');
        const members = await FirebaseService.getAllMembers();
        const planMembers = members.filter(m => this.plan.members_ids.includes(m.uid));

        container.innerHTML = planMembers.map(m => `
            <div class="member-chip" title="${m.role}">${m.init ? m.init : '👤'} ${m.name}</div>
        `).join('');
    }

    toggleTeamModal(show) {
        const modal = document.getElementById('team-modal');
        modal.classList.toggle('hidden', !show);
        if (show) this.loadMembersForSelection();
    }

    async loadMembersForSelection() {
        const listContainer = document.getElementById('members-selection-list');
        listContainer.innerHTML = '<div class="loading-inline">Cargando miembros...</div>';
        const members = await FirebaseService.getAllMembers();

        listContainer.innerHTML = members.map(m => {
            const initials = (m.name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            const isChecked = this.plan.members_ids?.includes(m.uid);
            const isLead = m.uid === this.plan.lead_id;
            return `
                <label for="m-${m.uid}" class="member-select-card ${isChecked ? 'selected' : ''} ${isLead ? 'is-lead' : ''}">
                    <input type="checkbox" value="${m.uid}" id="m-${m.uid}" 
                        ${isChecked ? 'checked' : ''} ${isLead ? 'disabled' : ''}
                        style="display:none;"
                        onchange="this.closest('.member-select-card').classList.toggle('selected', this.checked)">
                    <div class="member-avatar-lg">${initials}</div>
                    <div class="member-select-info">
                        <strong>${m.name}${isLead ? ' <span class="lead-badge">Líder</span>' : ''}</strong>
                        <span>${m.role || 'Sin puesto'}</span>
                        ${m.area ? `<span class="member-area-tag">${m.area}</span>` : ''}
                    </div>
                    <div class="member-select-check">
                        <div class="check-circle ${isChecked ? 'checked' : ''}">${isChecked ? '✓' : ''}</div>
                    </div>
                </label>
            `;
        }).join('');
    }

    async saveTeamSelection() {
        const checked = Array.from(document.querySelectorAll('#members-selection-list input:checked')).map(i => i.value);
        try {
            await db.collection('action_plans').doc(this.planId).update({
                members_ids: checked
            });

            // Paso 7: Notificar a los miembros
            for (const mid of checked) {
                if (!this.plan.members_ids?.includes(mid)) {
                    await FirebaseService.sendNotification(mid, "Nuevo Equipo", `Has sido agregado al equipo del plan: ${this.plan.title}`, `#plans/detail/${this.planId}`);
                }
            }

            ToastService.success("Equipo actualizado y notificado.");
            this.toggleTeamModal(false);
            this.app.router(); // Recargar vista
        } catch (error) {
            ToastService.error("Error al guardar equipo: " + error.message);
        }
    }

    async showTaskForm(taskId = null, parentId = null) {
        const modal = document.getElementById('task-modal');
        const members = await FirebaseService.getAllMembers();
        const planMembers = members.filter(m => (this.plan.members_ids || []).includes(m.uid) || m.uid === this.plan.lead_id);
        const taskToEdit = taskId ? this.tasksData.find(t => t.id === taskId) : null;
        const currentParentId = taskToEdit ? taskToEdit.parent_id : parentId;

        if (!modal) {
            const div = this.createEl('div', 'modal hidden', '');
            div.id = 'task-modal';
            document.body.appendChild(div);
        }

        const taskModal = document.getElementById('task-modal');
        taskModal.innerHTML = `
            <div class="modal-content glass-effect" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${taskToEdit ? 'Editar Tarea' : (parentId ? 'Nueva Subtarea' : 'Nueva Tarea')}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-dim);">
                        ${parentId ? `Desglosando tarea principal` : `Completa los detalles de la actividad`}
                    </p>
                </div>
                
                <div class="input-group">
                    <label>Nombre de la tarea</label>
                    <input type="text" id="t-title" placeholder="¿Qué se debe hacer?" value="${taskToEdit ? taskToEdit.title : ''}">
                </div>

                <div class="input-row">
                    <div class="input-group">
                        <label>Responsable</label>
                        <select id="t-assign">
                            <option value="">Seleccionar responsable</option>
                            ${planMembers.map(m => `<option value="${m.uid}" ${taskToEdit?.assigned_id === m.uid ? 'selected' : ''}>${m.name} (${m.role})</option>`).join('')}
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Quien ayuda</label>
                        <select id="t-helper">
                            <option value="">Ninguno</option>
                            ${planMembers.map(m => `<option value="${m.uid}" ${taskToEdit?.helper_id === m.uid ? 'selected' : ''}>${m.name} (${m.role})</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="input-row">
                    <div class="input-group">
                        <label>Fecha de asignación</label>
                        <input type="date" id="t-start" value="${taskToEdit?.start_date || new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="input-group">
                        <label>Fecha limite de termino</label>
                        <input type="date" id="t-due" value="${taskToEdit?.due_date || ''}">
                    </div>
                </div>

                <div class="input-group">
                    <label>Estado Inicial</label>
                    <select id="task-status" class="search-input">
                        <option value="pendiente" ${taskToEdit?.status === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                        <option value="en_proceso" ${taskToEdit?.status === 'en_proceso' ? 'selected' : ''}>⚡ En Proceso</option>
                        <option value="completado" ${taskToEdit?.status === 'completado' ? 'selected' : ''}>✅ Completada</option>
                    </select>
                </div>

                <div class="modal-actions">
                    <button class="secondary-btn" onclick="document.getElementById('task-modal').classList.add('hidden')">Cancelar</button>
                    <button class="primary-btn" id="confirm-add-task">${taskToEdit ? 'Guardar Cambios' : 'Guardar Tarea'}</button>
                </div>
            </div>
        `;
        
        taskModal.classList.remove('hidden');

        document.getElementById('confirm-add-task').onclick = async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = "Guardando...";

            const title = document.getElementById('t-title').value;
            const assignedId = document.getElementById('t-assign').value;
            const helperId = document.getElementById('t-helper').value;
            const startDate = document.getElementById('t-start').value;
            const dueDate = document.getElementById('t-due').value;
            const status = document.getElementById('task-status').value;

            if (!title) {
                btn.disabled = false;
                btn.textContent = taskToEdit ? "Guardar Cambios" : "Guardar Tarea";
                return ToastService.warning("El título es obligatorio");
            }
            if (!assignedId) {
                btn.disabled = false;
                btn.textContent = taskToEdit ? "Guardar Cambios" : "Guardar Tarea";
                return ToastService.warning("Asigna un responsable");
            }

            try {
                const taskPayload = {
                    plan_id: this.planId,
                    parent_id: currentParentId || null,
                    title: title,
                    assigned_id: assignedId,
                    helper_id: helperId,
                    start_date: startDate,
                    due_date: dueDate,
                    status: status,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (taskToEdit) {
                    await db.collection('tasks').doc(taskId).update(taskPayload);
                    ToastService.success("Tarea actualizada correctamente.");
                } else {
                    taskPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('tasks').add(taskPayload);
                    ToastService.success("Tarea creada correctamente.");
                    
                    // Notificar responsable SOLO al crear (opcional)
                    await FirebaseService.sendNotification(assignedId, "Nueva Tarea", `Se te ha asignado: ${title}`, "#tasks");
                    if (helperId) {
                        await FirebaseService.sendNotification(helperId, "Apoyo en Tarea", `Ayudarás en: ${title}`, "#tasks");
                    }
                }

                taskModal.classList.add('hidden');
                this.loadTasks();
            } catch (error) {
                console.error(error);
                ToastService.error(taskToEdit ? "Error al actualizar tarea" : "Error al crear tarea");
                btn.disabled = false;
                btn.textContent = taskToEdit ? "Guardar Cambios" : "Guardar Tarea";
            }
        };
    }

    async showEditPlanModal() {
        const modal = document.getElementById('edit-plan-modal');
        const container = document.getElementById('edit-plan-form-container');
        
        const members = await FirebaseService.getAllMembers();
        const groups = members.reduce((acc, m) => {
            const area = m.area || 'Otra Area';
            if (!acc[area]) acc[area] = [];
            acc[area].push(m);
            return acc;
        }, {});

        container.innerHTML = `
            <div class="edit-form-wrap">
                <div class="form-section">
                    <div class="input-group">
                        <label>Título del Plan</label>
                        <input type="text" id="edit-title" value="${this.plan.title || ''}" placeholder="Ej: Optimización de procesos">
                    </div>
                    <div class="input-group">
                        <label>Descripción de la Problemática</label>
                        <textarea id="edit-problem" class="custom-textarea" placeholder="Describe el problema...">${this.plan.problem || ''}</textarea>
                    </div>
                    <div class="input-row-grid">
                        <div class="input-group">
                            <label>KPI NOK (Actual)</label>
                            <input type="text" id="edit-kpi-nok" value="${this.plan.kpi_nok || ''}" placeholder="Ej: 65%">
                        </div>
                        <div class="input-group">
                            <label>KPI Meta (Objetivo)</label>
                            <input type="text" id="edit-kpi-expected" value="${this.plan.kpi_expected || ''}" placeholder="Ej: 95%">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Objetivo Principal</label>
                        <textarea id="edit-objective" class="custom-textarea" placeholder="¿Qué queremos lograr?">${this.plan.objective || ''}</textarea>
                    </div>
                    <div class="input-group">
                        <label>Recursos</label>
                        <textarea id="edit-resources" class="custom-textarea" placeholder="Lista de recursos necesarios...">${this.plan.resources || ''}</textarea>
                    </div>

                    <div class="input-group">
                        <label>Líder de Proyecto</label>
                        <select id="edit-lead-id" required>
                            ${Object.keys(groups).sort().map(area => `
                                <optgroup label="Área: ${area}">
                                    ${groups[area].map(m => `<option value="${m.uid}" ${m.uid === this.plan.lead_id ? 'selected' : ''}>${m.name} (${m.role})</option>`).join('')}
                                </optgroup>
                            `).join('')}
                        </select>
                    </div>

                    <!-- D4: Porqués en Edición -->
                    <div class="form-section-mini">
                        <label>D4: Análisis de Causa Raíz (Los Porqués)</label>
                        <div id="edit-whys-container" class="whys-container">
                            ${(this.plan.whys || []).map((w, i) => `
                                <div class="why-item">
                                    <div class="why-number">${i + 1}</div>
                                    <input type="text" class="edit-why-field" value="${this.escapeHTML(w)}" placeholder="¿Por qué?">
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="add-why-btn sm" id="edit-add-why">+ Añadir Por qué</button>
                    </div>

                    <!-- D7: Prevención en Edición -->
                    <div class="input-group">
                        <label>D7: Prevención de Recurrencia</label>
                        <textarea id="edit-prevention" class="custom-textarea">${this.plan.prevention || ''}</textarea>
                    </div>

                    <div class="input-group">
                        <label>Fecha Compromiso</label>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <input type="date" id="edit-due-date" value="${this.plan.due_date === 'recurrent' ? '' : this.plan.due_date}" ${this.plan.due_date === 'recurrent' ? 'disabled' : ''} style="flex: 1;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0; cursor: pointer; white-space: nowrap; color: var(--rosa-strong); font-weight: 600;">
                                <input type="checkbox" id="edit-is-recurrent" ${this.plan.due_date === 'recurrent' ? 'checked' : ''} style="width: 20px; height: 20px;">
                                Recurrente
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');

        // Lógica para añadir porqués en el modal de edición
        const addWhyEditBtn = document.getElementById('edit-add-why');
        const whysEditContainer = document.getElementById('edit-whys-container');
        addWhyEditBtn.onclick = () => {
            const count = whysEditContainer.querySelectorAll('.why-item').length + 1;
            const div = document.createElement('div');
            div.className = 'why-item';
            div.innerHTML = `
                <div class="why-number">${count}</div>
                <input type="text" class="edit-why-field" placeholder="¿Por qué?">
            `;
            whysEditContainer.appendChild(div);
        };

        // Toggle recurrente
        document.getElementById('edit-is-recurrent').onchange = (e) => {
            const dateInput = document.getElementById('edit-due-date');
            if (e.target.checked) {
                dateInput.disabled = true;
                dateInput.value = '';
            } else {
                dateInput.disabled = false;
            }
        };
    }

    async savePlanEdits() {
        const modal = document.getElementById('edit-plan-modal');
        const btn = document.getElementById('save-plan-edits');
        btn.disabled = true;
        btn.textContent = "Guardando...";

        const whys = Array.from(document.querySelectorAll('.edit-why-field'))
            .map(i => i.value.trim())
            .filter(v => v !== '');

        const editedData = {
            title: document.getElementById('edit-title').value,
            problem: document.getElementById('edit-problem').value,
            whys: whys,
            prevention: document.getElementById('edit-prevention').value,
            kpi_nok: document.getElementById('edit-kpi-nok').value,
            objective: document.getElementById('edit-objective').value,
            kpi_expected: document.getElementById('edit-kpi-expected').value,
            resources: document.getElementById('edit-resources').value,
            lead_id: document.getElementById('edit-lead-id').value,
            due_date: document.getElementById('edit-is-recurrent').checked ? 'recurrent' : document.getElementById('edit-due-date').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('action_plans').doc(this.planId).update(editedData);
            
            // Notificar al líder (como solicitó el usuario)
            await FirebaseService.sendNotification(
                editedData.lead_id,
                "Plan de Acción Actualizado",
                `Se ha actualizado la información del plan: ${editedData.title}. Por favor revisa los cambios.`,
                `#plans/detail/${this.planId}`
            );

            ToastService.success("Plan actualizado con éxito");
            modal.classList.add('hidden');
            this.app.router(); // Recargar vista para ver cambios
        } catch (error) {
            console.error(error);
            ToastService.error("Error al actualizar el plan");
            btn.disabled = false;
            btn.textContent = "Guardar Cambios";
        }
    }

    async cancelPlan() {
        const ok = await ToastService.confirm("⚠️ ¿ESTÁS SEGURO? Al cancelar el plan, todas sus tareas asociadas también se cancelarán.", "Sí, cancelar todo", "Volver");
        if (!ok) return;

        try {
            const btn = document.getElementById('cancel-plan-btn');
            btn.disabled = true;
            btn.textContent = "Procesando...";

            const batch = db.batch();

            // 1. Actualizar Plan a 'cancelada'
            const planRef = db.collection('action_plans').doc(this.planId);
            batch.update(planRef, {
                status: 'cancelada',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Cancelar todas las tareas (se marcan como canceladas)
            const taskSnap = await db.collection('tasks').where('plan_id', '==', this.planId).get();
            taskSnap.docs.forEach(doc => {
                batch.update(doc.ref, { 
                    status: 'cancelada',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            // 3. Nota de historial con UID para reglas de seguridad
            const historyRef = planRef.collection('history').doc();
            batch.set(historyRef, {
                type: 'status_change',
                from: this.plan.status,
                to: 'cancelada',
                note: 'Proyecto y tareas cancelados por Gerencia/Creador.',
                author_id: this.app.currentUser.uid,
                author_name: this.app.currentUser.name,
                author_role: this.app.currentUser.role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();

            ToastService.success("Plan y tareas canceladas correctamente.");
            document.getElementById('edit-plan-modal').classList.add('hidden');
            this.app.navigateTo('plans');
        } catch (error) {
            console.error("Error en cancelación:", error);
            ToastService.error("Fallo al cancelar: " + error.message);
            const btn = document.getElementById('cancel-plan-btn');
            if(btn) {
                btn.disabled = false;
                btn.textContent = "Cancelar Proyecto";
            }
        }
    }

    async deletePlanPermanent() {
        const ok = await ToastService.confirm("🚨 ¡ADVERTENCIA CRÍTICA! Esto borrará el plan y TODAS sus tareas de la base de datos PERMANENTEMENTE. Esta acción no se puede deshacer.", "ELIMINAR TODO", "Cancelar", "danger");
        if (!ok) return;

        try {
            const btn = document.getElementById('delete-plan-btn');
            btn.disabled = true;
            btn.textContent = "Borrando...";

            const batch = db.batch();

            // 1. Borrar Tareas
            const taskSnap = await db.collection('tasks').where('plan_id', '==', this.planId).get();
            taskSnap.docs.forEach(doc => batch.delete(doc.ref));

            // 2. Borrar Plan
            batch.delete(db.collection('action_plans').doc(this.planId));

            await batch.commit();

            ToastService.success("Proyecto eliminado permanentemente.");
            document.getElementById('edit-plan-modal').classList.add('hidden');
            this.app.navigateTo('plans');
        } catch (error) {
            console.error("Error en borrado:", error);
            ToastService.error("Fallo al borrar: " + error.message);
            const btn = document.getElementById('delete-plan-btn');
            if(btn) {
                btn.disabled = false;
                btn.textContent = "Eliminar Permanente";
            }
        }
    }
}
