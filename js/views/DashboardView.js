import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';

export class DashboardView extends View {
    async render() {
        const container = this.createEl('div', 'dashboard-container fade-in');
        const user = this.app.currentUser;

        // Obtener datos iniciales
        const plans = await FirebaseService.getPlansByRole(user);
        const members = await FirebaseService.getAllMembers();
        
        // Extraer áreas únicas para filtros
        const areas = [...new Set(members.map(m => m.area).filter(a => !!a))].sort();
        
        // Filtrar miembros para el selector de responsable
        const filteredMembers = user.role === 'gerente' 
            ? members 
            : members.filter(m => m.area === user.area);
        
        // Card 1: Planes Activos (Excluyendo terminados y cancelados)
        const activePlans = plans.filter(p => p.status !== 'completado' && p.status !== 'cancelada');
        const activePlanIds = activePlans.map(p => p.id);

        // Obtener tareas de los planes activos para medir Cards 2 y 3
        const allTasks = await FirebaseService.getTasksByPlanIds(activePlanIds);

        const now = new Date();
        now.setHours(0,0,0,0);
        
        const limitUpcoming = new Date(now);
        limitUpcoming.setDate(now.getDate() + 2);
        limitUpcoming.setHours(23,59,59,999);

        // Card 2: Tareas a vencer (Próximos 1 a 2 días - Mañana y Pasado Mañana)
        const tasksUpcoming = allTasks.filter(t => {
            if (!t.due_date || t.status === 'completado') return false;
            const dueDate = new Date(t.due_date + 'T00:00:00');
            const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
            return diffDays > 0 && diffDays <= 2;
        }).length;

        // Card 3: Tareas vencidas (Hoy o anteriores)
        const tasksOverdue = allTasks.filter(t => {
            if (!t.due_date || t.status === 'completado') return false;
            const dueDate = new Date(t.due_date + 'T00:00:00');
            const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
            return diffDays <= 0;
        }).length;

        // Card 4: Cumplimiento global (Completados vs No Cancelados)
        const completedCount = plans.filter(p => p.status === 'completado').length;
        const validPlansCount = plans.filter(p => p.status !== 'cancelada').length;
        const compliance = validPlansCount > 0 ? Math.round((completedCount / validPlansCount) * 100) : 0;

        container.innerHTML = `
            <div class="dashboard-header">
                <h1>Hola, ${user.name}</h1>
                <p>Resumen de ejecución | Rol: <strong>${(user.role === 'coordinador' || user.role === 'coordinadora') ? 'COORDINADORA' : user.role.toUpperCase()}</strong></p>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card animate-up" style="border-top: 6px solid var(--rosa-med)">
                    <div class="stat-value" style="background: linear-gradient(135deg, var(--rosa-med), var(--rosa-strong)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${activePlans.length}</div>
                    <div class="stat-label">Planes Activos</div>
                </div>
                <div class="stat-card animate-up" style="animation-delay: 0.1s; border-top: 6px solid var(--amarillo-med)">
                    <div class="stat-value" style="background: linear-gradient(135deg, var(--amarillo-med), var(--rosa-med)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${tasksUpcoming}</div>
                    <div class="stat-label">Tareas a Vencer</div>
                </div>
                <div class="stat-card animate-up" style="animation-delay: 0.2s; border-top: 6px solid #ef4444">
                    <div class="stat-value" style="background: linear-gradient(135deg, #ef4444, #991b1b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${tasksOverdue}</div>
                    <div class="stat-label">Tareas Vencidas</div>
                </div>
                <div class="stat-card animate-up" style="animation-delay: 0.3s; border-top: 6px solid var(--azul-fosfo)">
                    <div class="stat-value" style="background: linear-gradient(135deg, var(--azul-fosfo), var(--azul-deep)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${compliance}%</div>
                    <div class="stat-label">Cumplimiento Global</div>
                </div>
            </div>

            <section class="dynamic-plans-section hidden" id="dynamic-plans-section">
                <div class="section-header">
                    <h2 id="dynamic-title">Detalle de Selección</h2>
                    <button class="secondary-btn sm" id="close-dynamic">Cerrar detalle</button>
                </div>
                <div id="dynamic-plans-list"></div>
            </section>

            <section class="history-section">
                <div class="section-header">
                    <h2>Historial y Seguimiento General</h2>
                    <div class="header-actions">
                        ${['gerente', 'coordinador', 'coordinadora', 'miembro'].includes(user.role) ?
                '<button class="action-btn sm" id="new-plan-btn">+ Nuevo Plan</button>' : ''}
                    </div>
                </div>

                <div class="filters-bar glass-effect" style="margin-top: 1rem; padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                    <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: flex-end;">
                        
                        <div style="flex: 1.5; min-width: 180px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">📂 Área</label>
                            <select class="filter-select" id="filter-area">
                                <option value="all">Todas las áreas</option>
                                ${user.role === 'gerente' ? 
                                    areas.map(a => `<option value="${a}">${a}</option>`).join('') :
                                    `<option value="${user.area}" selected>${user.area}</option>`
                                }
                            </select>
                        </div>

                        <div style="flex: 1.5; min-width: 180px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">👤 Responsable</label>
                            <select class="filter-select" id="filter-lead">
                                <option value="all">Cualquier responsable</option>
                                ${filteredMembers.map(m => `<option value="${m.uid}">${m.name}</option>`).join('')}
                            </select>
                        </div>

                        <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">📌 Estado</label>
                            <select class="filter-select" id="filter-status">
                                <option value="all">Todos los estados</option>
                                <option value="pendiente">⏳ Pendiente</option>
                                <option value="en_proceso">⚡ En Proceso</option>
                                <option value="completado">✅ Completado</option>
                                <option value="cancelada">🚫 Cancelada</option>
                            </select>
                        </div>

                        <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">📅 Periodo</label>
                            <select class="filter-select" id="filter-period">
                                <option value="all">Todo el historial</option>
                                <option value="today">Hoy</option>
                                <option value="week">Esta semana</option>
                                <option value="month">Este mes</option>
                                <option value="custom">📅 Rango personalizado</option>
                            </select>
                        </div>

                        <div id="custom-date-range" class="hidden" style="display: flex; gap: 1rem; align-items: flex-end; flex: 1 1 100%; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.4rem; text-transform: uppercase;">Desde:</label>
                                <input type="date" id="date-start" class="search-input" style="width: 100%;">
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.4rem; text-transform: uppercase;">Hasta:</label>
                                <input type="date" id="date-end" class="search-input" style="width: 100%;">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="plans-list-wrapper" id="plans-history-grid">
                    <div class="loading-inline">Iniciando historial...</div>
                </div>
            </section>
        `;

        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        const user = this.app.currentUser;
        const plans = await FirebaseService.getPlansByRole(user);

        // Listeners para tarjetas de stats
        const cards = document.querySelectorAll('.stat-card');
        const section = document.getElementById('dynamic-plans-section');
        const closeBtn = document.getElementById('close-dynamic');

        // Card 0 (Planes Activos): Sin acción según requerimiento
        cards[0].style.cursor = 'default';
        
        // Cards 1 y 2 (Tareas): Mostrar detalle de tareas
        cards[1].onclick = () => this.showFilteredTasks('upcoming');
        cards[2].onclick = () => this.showFilteredTasks('overdue');

        closeBtn.onclick = () => section.classList.add('hidden');

        const newPlanBtn = document.getElementById('new-plan-btn');
        if (newPlanBtn) newPlanBtn.onclick = () => this.app.navigateTo('plans/new');

        const inputs = ['filter-area', 'filter-lead', 'filter-status', 'date-start', 'date-end', 'filter-period'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onchange = () => {
                    if (id === 'filter-period') {
                        const customRange = document.getElementById('custom-date-range');
                        if (el.value === 'custom') {
                            customRange.classList.remove('hidden');
                        } else {
                            customRange.classList.add('hidden');
                        }
                    }
                    this.loadHistory();
                };
            }
        });

        this.loadHistory();
    }

    async loadHistory() {
        const container = document.getElementById('plans-history-grid');
        const area = document.getElementById('filter-area').value;
        const lead = document.getElementById('filter-lead').value;
        const status = document.getElementById('filter-status').value;
        const period = document.getElementById('filter-period').value;
        const start = document.getElementById('date-start').value;
        const end = document.getElementById('date-end').value;

        try {
            let plans = await FirebaseService.getPlansByRole(this.app.currentUser);
            
            // Lógica por defecto: Si no hay filtros aplicados, solo mostrar activos (no completados ni cancelados)
            const isNeutral = (area === 'all' && lead === 'all' && status === 'all' && period === 'all');
            
            if (isNeutral) {
                plans = plans.filter(p => p.status !== 'completado' && p.status !== 'cancelada');
            }

            // Aplicar filtros específicos
            plans = plans.filter(p => {
                const matchArea = area === 'all' || p.area === area;
                const matchLead = lead === 'all' || p.lead_id === lead;
                const matchStatus = status === 'all' || p.status === status;
                return matchArea && matchLead && matchStatus;
            });

            // Filtrar por periodo
            const now = new Date();
            now.setHours(0,0,0,0);
            
            plans = plans.filter(p => {
                if (period === 'all') return true;
                if (!p.createdAt) return false;
                const pDate = p.createdAt.toDate();
                pDate.setHours(0,0,0,0);
                
                if (period === 'today') {
                    return pDate.getTime() === now.getTime();
                } else if (period === 'week') {
                    const weekAgo = new Date(now);
                    weekAgo.setDate(now.getDate() - 7);
                    return pDate >= weekAgo;
                } else if (period === 'month') {
                    return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
                } else if (period === 'custom') {
                    if (!start || !end) return true;
                    const dStart = new Date(start + 'T00:00:00');
                    const dEnd = new Date(end + 'T23:59:59');
                    return pDate >= dStart && pDate <= dEnd;
                }
                return true;
            });

            // Ordenar cronológicamente (más reciente primero)
            plans.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || new Date(0);
                const dateB = b.createdAt?.toDate() || new Date(0);
                return dateB - dateA;
            });

            if (plans.length === 0) {
                container.innerHTML = '<div class="empty-state">No se encontraron planes para este periodo.</div>';
                return;
            }

            // Cargar todos los miembros para mapeo rápido
            const allMembers = await FirebaseService.getAllMembers();
            const membersMap = {};
            allMembers.forEach(m => { membersMap[m.uid] = m; });

            // NUEVO: Obtener tareas para cálculos dinámicos
            const planIds = plans.map(p => p.id);
            const allTasks = await FirebaseService.getTasksByPlanIds(planIds);
            const tasksByPlan = {};
            allTasks.forEach(t => {
                if (!tasksByPlan[t.plan_id]) tasksByPlan[t.plan_id] = [];
                tasksByPlan[t.plan_id].push(t);
            });

            const headerHtml = `
                <div class="plans-list-header">
                    <div>Nombre del proyecto</div>
                    <div>Responsable</div>
                    <div>Equipo</div>
                    <div>Inicio</div>
                    <div>Término</div>
                    <div>Estado</div>
                    <div>Cronograma</div>
                </div>
            `;

            const listHtml = plans.map((p, i) => {
                const startDate = p.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) || 'N/A';
                const dueDate = p.due_date === 'recurrent' ? 'Recurrente' : (p.due_date ? new Date(p.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'S/F');
                
                const leader = membersMap[p.lead_id] || { name: 'S/A', init: '?' };
                const teamIds = p.members_ids || [];
                
                // Limitar equipo a 3 avatares + indicador
                const visibleTeam = teamIds.slice(0, 3);
                const extraTeam = teamIds.length > 3 ? teamIds.length - 3 : 0;

                // LÓGICA DINÁMICA DE ESTADO Y PROGRESO
                const tasks = tasksByPlan[p.id] || [];
                let dynamicStatus = p.status || 'pendiente';
                let dynamicProgress = p.progress || 0;

                if (tasks.length > 0) {
                    const now = new Date();
                    now.setHours(0,0,0,0);

                    // 1. Calcular Estado por mayoría
                    const counts = tasks.reduce((acc, t) => {
                        acc[t.status] = (acc[t.status] || 0) + 1;
                        return acc;
                    }, {});

                    const total = tasks.length;
                    const completadas = counts['completado'] || 0;
                    const enProceso = counts['en_proceso'] || 0;
                    const pendientes = counts['pendiente'] || 0;
                    const canceladas = counts['cancelada'] || 0;

                    if (completadas === total) {
                        dynamicStatus = 'completado';
                    } else {
                        // Determinar el más frecuente (excluyendo canceladas si hay otras)
                        const stats = [
                            { s: 'en_proceso', c: enProceso },
                            { s: 'pendiente', c: pendientes },
                            { s: 'completado', c: completadas },
                            { s: 'cancelada', c: canceladas }
                        ];
                        stats.sort((a, b) => b.c - a.c);
                        dynamicStatus = stats[0].s;
                    }

                    // 2. Calcular Progreso (% Cronograma)
                    // Fórmula: (Completadas * 1 + EnProceso * 0.5 - VencidasNoHechas * 0.1) / Total
                    const vencidas = tasks.filter(t => {
                        if (t.status === 'completado' || !t.due_date) return false;
                        const d = new Date(t.due_date + 'T00:00:00');
                        return d < now;
                    }).length;

                    const score = ((completadas * 1) + (enProceso * 0.5) - (vencidas * 0.1)) / total;
                    dynamicProgress = Math.max(0, Math.min(100, Math.round(score * 100)));
                }

                return `
                <div class="plan-list-row animate-up view-detail" data-id="${p.id}" style="animation-delay: ${i * 0.05}s;">
                    <div class="plan-col project-name" data-label="Proyecto">${p.title}</div>
                    
                    <div class="plan-col" data-label="Responsable">
                        <div class="avatar-circle" title="${leader.name}">${leader.init || leader.name.charAt(0)}</div>
                    </div>
                    
                    <div class="plan-col" data-label="Equipo">
                        <div class="avatar-stack">
                            ${visibleTeam.map(tid => {
                                const m = membersMap[tid] || { name: '?', init: '?' };
                                return `<div class="avatar-circle" title="${m.name}">${m.init || m.name.charAt(0)}</div>`;
                            }).join('')}
                            ${extraTeam > 0 ? `<div class="avatar-circle more-members shadow-soft">+${extraTeam}</div>` : ''}
                            ${teamIds.length === 0 ? '<span style="font-size: 0.7rem; opacity: 0.5;">Sin equipo</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="plan-col" data-label="Inicio">${startDate}</div>
                    
                    <div class="plan-col" data-label="Término">${dueDate}</div>
                    
                    <div class="plan-col" data-label="Estado">
                        <span class="status-pill status-${dynamicStatus}">${dynamicStatus.replace('_', ' ')}</span>
                    </div>
                    
                    <div class="plan-col" data-label="Cronograma">
                        <div class="progress-container">
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${dynamicProgress}%"></div>
                            </div>
                            <span class="progress-text">${dynamicProgress}%</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            container.innerHTML = headerHtml + listHtml;

            // Eventos para ver detalle
            container.querySelectorAll('.view-detail').forEach(btn => {
                btn.onclick = () => this.app.navigateTo(`plans/detail/${btn.dataset.id}`);
            });

        } catch (error) {
            console.error(error);
            container.innerHTML = 'Error al cargar el historial.';
        }
    }

    async showFilteredTasks(type) {
        const section = document.getElementById('dynamic-plans-section');
        const list = document.getElementById('dynamic-plans-list');
        const title = document.getElementById('dynamic-title');
        const now = new Date();
        now.setHours(0,0,0,0);

        section.classList.remove('hidden');
        list.innerHTML = '<div class="loading-inline">Cargando detalle de tareas...</div>';

        try {
            const user = this.app.currentUser;
            const plans = await FirebaseService.getPlansByRole(user);
            const activePlans = plans.filter(p => p.status !== 'completado' && p.status !== 'cancelada');
            const activePlanIds = activePlans.map(p => p.id);
            const plansMap = {};
            activePlans.forEach(p => plansMap[p.id] = p.title);

            const allTasks = await FirebaseService.getTasksByPlanIds(activePlanIds);

            let filteredTasks = [];
            if (type === 'upcoming') {
                title.textContent = "Tareas Próximas a Vencer (Mañana y Pasado)";
                filteredTasks = allTasks.filter(t => {
                    if (!t.due_date || t.status === 'completado') return false;
                    const dueDate = new Date(t.due_date + 'T00:00:00');
                    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                    return diffDays > 0 && diffDays <= 2;
                });
            } else {
                title.textContent = "Tareas Vencidas (Hoy o anteriores)";
                filteredTasks = allTasks.filter(t => {
                    if (!t.due_date || t.status === 'completado') return false;
                    const dueDate = new Date(t.due_date + 'T00:00:00');
                    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                    return diffDays <= 0;
                });
            }

            if (filteredTasks.length === 0) {
                list.innerHTML = '<p class="empty-state">No hay tareas en esta categoría.</p>';
                return;
            }

            // Obtener nombres de responsables
            const assignedIds = [...new Set(filteredTasks.map(t => t.assigned_id).filter(id => !!id))];
            const userNames = await FirebaseService.getUserNamesByIds(assignedIds);

            list.innerHTML = `
                <div class="tasks-detail-container animate-up">
                    <div class="tasks-detail-grid-header">
                        <div class="grid-h-col">Actividad</div>
                        <div class="grid-h-col">Asignado a</div>
                        <div class="grid-h-col">Fecha Compromiso</div>
                    </div>
                    ${filteredTasks.map(t => {
                        const dueDate = new Date(t.due_date + 'T00:00:00');
                        const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                        const isRed = diffDays <= 0;

                        return `
                        <div class="tasks-detail-grid-row" onclick="location.hash='#plans/detail/${t.plan_id}'">
                            <div class="grid-row-col task-name-cell">
                                <div class="task-icon-dot ${isRed ? 'overdue' : 'upcoming'}"></div>
                                <span>${t.title}</span>
                            </div>
                            <div class="grid-row-col task-assigned-cell">
                                <div class="avatar-mini">${(userNames[t.assigned_id] || 'S').charAt(0)}</div>
                                <span>${userNames[t.assigned_id] || 'Sin asignar'}</span>
                            </div>
                            <div class="grid-row-col task-date-cell">
                                <span class="date-badge ${isRed ? 'overdue' : 'upcoming'}">
                                    ${t.due_date}
                                </span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            `;
            
            section.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error(error);
            list.innerHTML = '<p class="error">Error al cargar el detalle de tareas.</p>';
        }
    }
}
