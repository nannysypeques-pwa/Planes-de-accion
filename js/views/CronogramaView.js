import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class CronogramaView extends View {
    constructor(app) {
        super(app);
        this.allPlans = [];
        this.allTasks = [];
        this.allMembers = [];
        this.currentAreaFilter = 'all';
        this.currentSearchFilter = '';
        this.expandedMembers = new Set();
        this.trackW = 0;
        this.todayIdx = -1;
        this.loadedUids = new Set();
        this.initialLoadDone = false;
    }

    async render() {
        const container = this.createEl('div', 'cronograma-view fade-in');
        const role = this.app.currentUser.role;
        const isManager = role === 'gerente';

        container.innerHTML = `
            <div class="view-header">
                <div class="header-main">
                    <h1>Mi Cronograma</h1>
                    <p style="font-size: 0.9rem; color: var(--text-dim);">Línea de tiempo colaborativa</p>
                </div>
                <div class="chrono-filters glass-effect">
                    ${isManager ? `
                        <select id="area-filter" class="search-input sm">
                            <option value="all">Todas las Áreas</option>
                            <option value="Supervisión">Supervisión</option>
                            <option value="Ventas">Ventas</option>
                            <option value="Operaciones">Operaciones</option>
                            <option value="Relaciones Públicas">Relaciones Públicas</option>
                            <option value="Recursos Humanos">Recursos Humanos</option>
                        </select>
                    ` : ''}
                </div>
            </div>

            <div id="chrono-master-container" class="chrono-master-layout">
                <div class="loading-inline">Sincronizando cronogramas...</div>
            </div>

            <!-- Modal de Nota (Reutilizado) -->
            <div id="status-note-modal" class="modal hidden">
                <div class="modal-content glass-effect" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 id="modal-task-title">Actualizar Actividad</h3>
                        <button class="modal-close-x" id="close-note-modal">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Nuevo Estado</label>
                            <select id="modal-status-select" class="search-input" style="width: 100%;">
                                <option value="pendiente">⏳ Pendiente</option>
                                <option value="en_proceso">⚡ En Proceso</option>
                                <option value="completado">✅ Completada</option>
                            </select>
                        </div>
                        <div class="input-group" style="margin-top: 1.5rem;">
                            <label>Nota / Observación</label>
                            <textarea id="modal-note-text" placeholder="¿Qué avances hay?" class="search-input" style="width: 100%; height: 100px; padding: 0.8rem; border-radius: var(--radius-md);"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                        <button class="secondary-btn" id="cancel-note-modal">Cancelar</button>
                        <button class="primary-btn" id="save-status-note">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;

        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        const areaF = document.getElementById('area-filter');

        if (areaF) areaF.onchange = (e) => { this.currentAreaFilter = e.target.value; this.renderMaster(); };

        // Inicializar expansión con el usuario actual
        this.expandedMembers.add(this.app.currentUser.uid);

        await this.loadInitialData();
    }

    async loadInitialData() {
        try {
            const user = this.app.currentUser;
            
            // 1. Cargar Miembros
            const members = await FirebaseService.getAllMembers();
            if (user.role === 'gerente') {
                this.allMembers = members;
            } else if (user.role === 'coordinador' || user.role === 'coordinadora') {
                this.allMembers = members.filter(m => m.area === user.area || m.uid === user.uid);
            } else {
                this.allMembers = members.filter(m => m.uid === user.uid);
            }

            // 2. Cargar Planes Activos (Necesarios para el contexto de tareas)
            const plansSnap = await db.collection('action_plans').get();
            this.allPlans = plansSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => !['completado', 'cancelado'].includes(p.status));

            // 3. Carga Inicial de Mis Tareas (para definir el rango de fechas inicial)
            this.allTasks = await FirebaseService.getTasksByUserId(user.uid);
            this.loadedUids.add(user.uid);

            // Calcular Rango de Fechas Global
            this.calculateDateRange();
            this.renderMaster();
            
            // Posicionar en hoy al iniciar
            setTimeout(() => this.scrollToToday(), 300);
        } catch (error) {
            console.error(error);
            ToastService.error("Error al sincronizar cronograma");
        }
    }

    calculateDateRange() {
        const DAY_W = 32;
        const today = new Date(); today.setHours(12, 0, 0, 0);

        // Rango de 3 meses solicitado: 1 atrás, 2 adelante (incluyendo el actual)
        const startBase = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endBase = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Fin del mes +2

        const allDates = this.allTasks.flatMap(t => [
            t.start_date ? new Date(t.start_date + 'T12:00:00') : null,
            t.due_date ? new Date(t.due_date + 'T12:00:00') : null,
        ]).filter(d => d && !isNaN(d)).map(d => d.getTime());

        const minTime = Math.min(startBase.getTime(), ...allDates);
        const maxTime = Math.max(endBase.getTime(), ...allDates);
        
        const min = new Date(minTime);
        const max = new Date(maxTime);
        
        const s = new Date(min); s.setDate(s.getDate() - 1);
        const e = new Date(max); e.setDate(e.getDate() + 3);
        this.days = [];
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) this.days.push(new Date(d));

        this.trackW = this.days.length * DAY_W;
        this.todayIdx = this.days.findIndex(d => d.toDateString() === today.toDateString());
    }

    renderMaster() {
        const viewport = document.getElementById('master-viewport');
        const scrollLeft = viewport ? viewport.scrollLeft : null;
        
        const container = document.getElementById('chrono-master-container');
        const currentUser = this.app.currentUser;

        let teamMembers = this.allMembers.filter(m => {
            return this.currentAreaFilter === 'all' || m.area === this.currentAreaFilter;
        });

        const me = teamMembers.find(m => m.uid === currentUser.uid);
        const others = teamMembers.filter(m => m.uid !== currentUser.uid);
        
        // Ordenar por área y luego por nombre
        others.sort((a, b) => {
            const areaA = a.area || '';
            const areaB = b.area || '';
            if (areaA !== areaB) return areaA.localeCompare(areaB);
            return a.name.localeCompare(b.name);
        });
        
        const sortedMembers = me ? [me, ...others] : others;

        container.innerHTML = `
            <div class="chrono-unified-viewport" id="master-viewport">
                <div class="chrono-unified-track" style="width: ${this.trackW + 320}px">
                    <!-- CABECERA DE FECHAS -->
                    ${this.renderStickyHeader()}
                    
                    <!-- CUERPO DEL CRONOGRAMA -->
                    <div class="chrono-rows-container">
                        ${sortedMembers.map(m => {
                            const isExpanded = this.expandedMembers.has(m.uid);
                            const mTasks = this.allTasks.filter(t => t.assigned_id === m.uid);
                            return this.renderMemberRows(m, mTasks, isExpanded);
                        }).join('')}
                    </div>
                </div>
            </div>
            
            <div class="chrono-bottom-legend">
                <div class="gc-legend-item"><span class="gc-legend-dot" style="background:#f59e0b"></span>Pendiente</div>
                <div class="gc-legend-item"><span class="gc-legend-dot" style="background:#3b82f6"></span>En Proceso</div>
                <div class="gc-legend-item"><span class="gc-legend-dot" style="background:#10b981"></span>Completada</div>
                <div class="gc-legend-item"><span class="gc-legend-dot" style="background:#ef4444"></span>Retraso</div>
            </div>
        `;

        // Restaurar posición de scroll
        if (scrollLeft !== null) {
            const nextViewport = document.getElementById('master-viewport');
            if (nextViewport) nextViewport.scrollLeft = scrollLeft;
        }

        this.attachRowEvents();
    }

    scrollToToday() {
        if (this.initialLoadDone) return;
        
        const viewport = document.getElementById('master-viewport');
        if (viewport && this.todayIdx >= 0) {
            const DAY_W = 32;
            const scrollPos = (this.todayIdx * DAY_W) - 160; // Mostrar un poco de contexto previo
            viewport.scrollLeft = Math.max(0, scrollPos);
            this.initialLoadDone = true;
        }
    }

    renderStickyHeader() {
        const DAY_W = 32;
        const monthGroups = [];
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        this.days.forEach(d => {
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!monthGroups.length || monthGroups[monthGroups.length - 1].key !== key) {
                monthGroups.push({ key, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, count: 1 });
            } else { monthGroups[monthGroups.length - 1].count++; }
        });

        return `
            <div class="gc-header-row">
                <div class="gc-sidebar-cell" style="background: var(--rosa-med); color: white; display: flex; align-items: center; font-weight: 800; font-size: 0.8rem;">
                    RESPONSABLE / ACTIVIDAD
                </div>
                <div class="gc-track-container">
                    <div class="gc-months-strip" style="width:${this.trackW}px">
                        ${monthGroups.map(mg => `<div class="gc-month" style="width:${mg.count * DAY_W}px">${mg.label}</div>`).join('')}
                    </div>
                    <div class="gc-days-strip" style="width:${this.trackW}px;">
                        ${this.days.map((d, i) => `<div class="gc-day ${d.getDay() === 0 || d.getDay() === 6 ? 'wknd' : ''} ${i === this.todayIdx ? 'today' : ''}" style="width:${DAY_W}px">${d.getDate()}</div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderMemberRows(member, tasks, isExpanded) {
        // Fila de Cabecera de Miembro (Botón de expansión)
        const headRow = `
            <div class="gc-row-grid member-head-row ${isExpanded ? 'active' : ''}" data-uid="${member.uid}" style="background: rgba(0,0,0,0.02); cursor: pointer;">
                <div class="gc-sidebar-cell">
                    <div class="member-cell-info">
                        <div class="member-chevron" style="transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.3s; font-size: 0.8rem; opacity: 0.5;">▼</div>
                        <div class="avatar-xs-circle">${member.name.charAt(0)}</div>
                        <div style="line-height: 1.1;">
                            <strong style="font-size: 0.85rem;">${member.name}</strong><br>
                            <span style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">${member.area || 'Sin área'}</span>
                        </div>
                    </div>
                </div>
                <div class="gc-track">
                    ${this.renderVLines()}
                </div>
            </div>
        `;

        if (!isExpanded) return headRow;

        // Filas de Tareas si está expandido
        const isLoaded = this.loadedUids.has(member.uid);
        
        if (!isLoaded) {
            return headRow + `<div class="gc-row-grid"><div class="gc-sidebar-cell" style="padding-left: 3rem; color: var(--rosa-med); font-size: 0.75rem;">Cargando actividades...</div><div class="gc-track">${this.renderVLines()}</div></div>`;
        }

        const taskRows = tasks.length === 0 
            ? `<div class="gc-row-grid"><div class="gc-sidebar-cell" style="padding-left: 3rem; font-style: italic; font-size: 0.75rem; color: var(--text-dim);">Sin actividades asignadas</div><div class="gc-track">${this.renderVLines()}</div></div>`
            : tasks.map(t => {
                const statusColor = { pendiente: '#f59e0b', en_proceso: '#3b82f6', completado: '#10b981' };
                const dotColor = statusColor[t.status] || '#ccc';
                
                return `
                    <div class="gc-row-grid">
                        <div class="gc-sidebar-cell">
                            <div class="task-cell-info">
                                <div class="st-dot" style="background: ${dotColor}"></div>
                                <span title="${t.title}">${t.title}</span>
                            </div>
                        </div>
                        <div class="gc-track">
                            ${this.renderVLines()}
                            ${this.renderBars([t])}
                        </div>
                    </div>
                `;
            }).join('');

        return headRow + taskRows;
    }

    renderVLines() {
        const DAY_W = 32;
        return this.days.map((d, i) => `
            <div class="gc-vline ${d.getDay() === 0 || d.getDay() === 6 ? 'wknd' : ''}" style="left:${i * DAY_W + 0.5}px"></div>
        `).join('') + (this.todayIdx >= 0 ? `<div class="gc-today-line" style="left:${this.todayIdx * DAY_W}px"></div>` : '');
    }

    renderBars(tasks) {
        const DAY_W = 32;
        const statusColor = { pendiente: '#f59e0b', en_proceso: '#3b82f6', completado: '#10b981' };
        const today = new Date(); today.setHours(12,0,0,0);
        
        return tasks.map(t => {
            const si = this.dayIdx(t.start_date);
            const di = this.dayIdx(t.due_date);
            if (si < 0 || di < 0) return '';

            const barLeft = si * DAY_W;
            const barWidth = Math.max(DAY_W, (di - si + 1) * DAY_W);
            const color = statusColor[t.status] || statusColor.pendiente;

            const overdueDays = (this.todayIdx > di && t.status !== 'completado') ? (this.todayIdx - di) : 0;

            return `
                <div class="gc-bar task-action-bar" data-id="${t.id}" data-title="${t.title}" data-status="${t.status}"
                     style="left:${barLeft}px; width:${barWidth}px; background:${color};">
                    <span class="gc-bar-label">${t.title}</span>
                </div>
                ${overdueDays > 0 ? `<div class="gc-delay-bar" style="left:${(di + 1) * DAY_W}px; width:${overdueDays * DAY_W}px;"></div>` : ''}
            `;
        }).join('');
    }

    dayIdx(iso) {
        if (!iso) return -1;
        const target = new Date(iso + 'T12:00:00').toDateString();
        return this.days.findIndex(d => d.toDateString() === target);
    }

    attachRowEvents() {
        const currentUser = this.app.currentUser;

        // Toggle Member (Carga diferida)
        document.querySelectorAll('.member-head-row').forEach(row => {
            row.onclick = async () => {
                const uid = row.dataset.uid;
                if (this.expandedMembers.has(uid)) {
                    this.expandedMembers.delete(uid);
                    this.renderMaster();
                } else {
                    if (!this.loadedUids.has(uid)) {
                        try {
                            ToastService.show("Consultando registros...", 'info', 800);
                            
                            const fetchTask = FirebaseService.getTasksByUserId(uid);
                            const timeoutTask = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('timeout')), 4000)
                            );

                            const mTasks = await Promise.race([fetchTask, timeoutTask]);
                            
                            if (mTasks && Array.isArray(mTasks)) {
                                mTasks.forEach(nt => {
                                    if (!this.allTasks.find(ot => ot.id === nt.id)) {
                                        this.allTasks.push(nt);
                                    }
                                });
                            }
                        } catch (err) { 
                            console.error("Error al cargar tareas:", err);
                        } finally {
                            this.loadedUids.add(uid);
                            this.expandedMembers.add(uid);
                            this.renderMaster();
                        }
                    } else {
                        this.expandedMembers.add(uid);
                        this.renderMaster();
                    }
                }
            };
        });

        // Click en tareas (con restricción de permisos)
        document.querySelectorAll('.task-action-bar').forEach(bar => {
            bar.onclick = (e) => {
                e.stopPropagation();
                const taskId = bar.dataset.id;
                const task = this.allTasks.find(t => t.id === taskId);
                if (!task) return;

                const isOwner = task.assigned_id === currentUser.uid || task.helper_id === currentUser.uid;
                if (!isOwner) {
                    return ToastService.warning("Solo lectura.");
                }
                this.openStatusModal(taskId, bar.dataset.title, bar.dataset.status);
            };
        });
    }

    openStatusModal(taskId, title, currentStatus) {
        const modal = document.getElementById('status-note-modal');
        const titleEl = document.getElementById('modal-task-title');
        const select = document.getElementById('modal-status-select');
        const noteText = document.getElementById('modal-note-text');
        const saveBtn = document.getElementById('save-status-note');

        titleEl.textContent = title;
        select.value = currentStatus === 'bloqueado' ? 'pendiente' : currentStatus;
        noteText.value = '';
        modal.classList.remove('hidden');

        saveBtn.onclick = async () => {
            const newStatus = select.value;
            const note = noteText.value.trim();
            if (!note) return ToastService.warning("Por favor agrega una nota.");

            try {
                saveBtn.disabled = true;
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

                ToastService.success("Actividad actualizada");
                modal.classList.add('hidden');
                await this.loadInitialData(); // Sincroniza todo
            } catch (err) {
                console.error(err);
                ToastService.error("Error al actualizar");
            } finally {
                saveBtn.disabled = false;
            }
        };
    }
}
