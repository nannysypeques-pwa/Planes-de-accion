import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { TaskUtils } from '../utils.js';

export class DashboardView extends View {
    async render() {
        const container = this.createEl('div', 'dashboard-container fade-in');
        const user = this.app.currentUser;

        // Obtener datos iniciales
        const plans = await FirebaseService.getPlansByRole(user);
        const members = await FirebaseService.getAllMembers();
        this.members = members;
        
        // Extraer áreas únicas para filtros
        const areas = [...new Set(members.map(m => m.area).filter(a => !!a))].sort();
        
        // Filtrar miembros para el selector de responsable
        const filteredMembers = user.role === 'gerente' 
            ? members 
            : members.filter(m => m.area === user.area);
        
        // Cargar estado de filtros guardado
        const savedState = JSON.parse(sessionStorage.getItem('dashboard_state') || '{}');
        const defaultStatuses = ['pendiente', 'en_proceso', 'completado'];
        const activeStatuses = savedState.selectedStatuses || defaultStatuses;
        
        const isChecked = (status) => activeStatuses.includes(status) ? 'checked' : '';
        const isSelected = (field, value, defaultValue = 'all') => {
            const savedValue = savedState[field] || defaultValue;
            return savedValue === value ? 'selected' : '';
        };
        
        // Card 1: Planes Activos (Excluyendo terminados, cumplidos y cancelados)
        const activePlans = plans.filter(p => p.status !== 'completado' && p.status !== 'cumplido' && p.status !== 'cancelada' && p.status !== 'cancelado');
        const activePlanIds = activePlans.map(p => p.id);

        // Obtener tareas de los planes activos para medir Cards 2 y 3
        const rawTasks = await FirebaseService.getTasksByPlanIds(activePlanIds);
        const allTasks = TaskUtils.computeDynamicStatuses(rawTasks);

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
                <div class="section-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                    <h2 id="dynamic-title">Detalle de Selección</h2>
                    ${user.role === 'gerente' ? `
                    <div id="dynamic-filter-area-container" style="display: flex; align-items: center; gap: 0.5rem; margin-left: auto;">
                        <label for="dynamic-filter-area" style="font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); text-transform: uppercase; white-space: nowrap;">📂 Filtrar por Área:</label>
                        <select class="filter-select" id="dynamic-filter-area" style="width: auto; min-width: 180px; padding: 0.4rem 2.5rem 0.4rem 1rem; font-size: 0.85rem; height: auto;">
                            <option value="all">Todas las áreas</option>
                            ${areas.map(a => `<option value="${a}">${a}</option>`).join('')}
                        </select>
                    </div>
                    ` : ''}
                    <button class="secondary-btn sm" id="close-dynamic" style="margin-left: ${user.role === 'gerente' ? '0' : 'auto'};">Cerrar detalle</button>
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

                <div class="filters-bar glass-effect" style="margin-top: 1rem; padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem; overflow: visible;">
                    <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: flex-end; overflow: visible;">
                        
                        <div style="flex: 1.5; min-width: 180px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">📂 Área</label>
                            <select class="filter-select" id="filter-area">
                                <option value="all" ${isSelected('filterArea', 'all')}>Todas las áreas</option>
                                ${user.role === 'gerente' ? 
                                    areas.map(a => `<option value="${a}" ${isSelected('filterArea', a)}>${a}</option>`).join('') :
                                    `<option value="${user.area}" selected>${user.area}</option>`
                                }
                            </select>
                        </div>

                        <div style="flex: 1.5; min-width: 180px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">👤 Responsable</label>
                            <select class="filter-select" id="filter-lead">
                                <option value="all" ${isSelected('filterLead', 'all')}>Cualquier responsable</option>
                                ${filteredMembers.map(m => `<option value="${m.uid}" ${isSelected('filterLead', m.uid)}>${m.name}</option>`).join('')}
                            </select>
                        </div>

                        <div style="flex: 1.5; min-width: 220px; position: relative;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">📌 Estado</label>
                            <div class="custom-multiselect" id="status-multiselect-container" style="position: relative; width: 100%;">
                                <div class="multiselect-trigger" id="status-multiselect-trigger" style="background: var(--surface); border: 1.5px solid rgba(210,50,143,0.15); border-radius: 14px; padding: 0.8rem 1.2rem; font-size: 1rem; font-weight: 500; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; cursor: pointer; min-height: 52px; box-sizing: border-box; user-select: none; transition: all 0.3s ease;">
                                    <span id="status-trigger-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Pendiente, En Proceso, Completado</span>
                                    <span id="status-trigger-arrow" style="color: var(--rosa-med); font-size: 0.72rem; margin-left: 0.5rem; flex-shrink: 0; transition: transform 0.2s ease;">▼</span>
                                </div>
                                <div id="status-multiselect-dropdown" class="multiselect-dropdown" style="display: none; position: fixed; background: #ffffff; border: 1.5px solid rgba(210,50,143,0.12); border-radius: 14px; box-shadow: 0 12px 28px rgba(210,50,143,0.1); z-index: 9999; padding: 0.6rem; flex-direction: column; gap: 4px; min-width: 220px; max-height: 250px; overflow-y: auto;">
                                    <label class="multiselect-option" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; color: var(--text-main); font-weight: 500; transition: background 0.15s ease;">
                                        <input type="checkbox" value="pendiente" ${isChecked('pendiente')} style="width: 17px; height: 17px; accent-color: var(--rosa-strong); cursor: pointer; margin: 0; flex-shrink: 0;">
                                        <span>⏳ Pendiente</span>
                                    </label>
                                    <label class="multiselect-option" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; color: var(--text-main); font-weight: 500; transition: background 0.15s ease;">
                                        <input type="checkbox" value="en_proceso" ${isChecked('en_proceso')} style="width: 17px; height: 17px; accent-color: var(--rosa-strong); cursor: pointer; margin: 0; flex-shrink: 0;">
                                        <span>⚡ En Proceso</span>
                                    </label>
                                    <label class="multiselect-option" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; color: var(--text-main); font-weight: 500; transition: background 0.15s ease;">
                                        <input type="checkbox" value="completado" ${isChecked('completado')} style="width: 17px; height: 17px; accent-color: var(--rosa-strong); cursor: pointer; margin: 0; flex-shrink: 0;">
                                        <span>✅ Completado</span>
                                    </label>
                                    <label class="multiselect-option" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; color: var(--text-main); font-weight: 500; transition: background 0.15s ease;">
                                        <input type="checkbox" value="cumplido" ${isChecked('cumplido')} style="width: 17px; height: 17px; accent-color: var(--rosa-strong); cursor: pointer; margin: 0; flex-shrink: 0;">
                                        <span>🔘 Cumplido</span>
                                    </label>
                                    <label class="multiselect-option" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; color: var(--text-main); font-weight: 500; transition: background 0.15s ease;">
                                        <input type="checkbox" value="cancelada" ${isChecked('cancelada')} style="width: 17px; height: 17px; accent-color: var(--rosa-strong); cursor: pointer; margin: 0; flex-shrink: 0;">
                                        <span>🚫 Cancelado</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase;">📅 Periodo</label>
                            <select class="filter-select" id="filter-period">
                                <option value="all" ${isSelected('filterPeriod', 'all')}>Todo el historial</option>
                                <option value="today" ${isSelected('filterPeriod', 'today')}>Hoy</option>
                                <option value="week" ${isSelected('filterPeriod', 'week')}>Esta semana</option>
                                <option value="month" ${isSelected('filterPeriod', 'month')}>Este mes</option>
                                <option value="custom" ${isSelected('filterPeriod', 'custom')}>📅 Rango personalizado</option>
                            </select>
                        </div>

                        <div id="custom-date-range" class="${(savedState.filterPeriod || 'all') === 'custom' ? '' : 'hidden'}" style="display: flex; gap: 1rem; align-items: flex-end; flex: 1 1 100%; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.4rem; text-transform: uppercase;">Desde:</label>
                                <input type="date" id="date-start" class="search-input" value="${savedState.dateStart || ''}" style="width: 100%;">
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.4rem; text-transform: uppercase;">Hasta:</label>
                                <input type="date" id="date-end" class="search-input" value="${savedState.dateEnd || ''}" style="width: 100%;">
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

        // Flags for scroll restoration
        this.historyLoaded = false;
        this.dynamicTasksLoaded = false;
        const savedScroll = sessionStorage.getItem('dashboard_scroll');
        this._isRestoringScroll = !!(savedScroll && parseInt(savedScroll, 10) > 0);

        // State saver
        const saveDashboardState = () => {
            const area = document.getElementById('filter-area')?.value || 'all';
            const lead = document.getElementById('filter-lead')?.value || 'all';
            const period = document.getElementById('filter-period')?.value || 'all';
            const dateStart = document.getElementById('date-start')?.value || '';
            const dateEnd = document.getElementById('date-end')?.value || '';
            
            const selectedStatuses = [];
            document.querySelectorAll('#status-multiselect-dropdown input[type="checkbox"]').forEach(cb => {
                if (cb.checked) selectedStatuses.push(cb.value);
            });

            sessionStorage.setItem('dashboard_state', JSON.stringify({
                filterArea: area,
                filterLead: lead,
                filterPeriod: period,
                dateStart,
                dateEnd,
                selectedStatuses
            }));
        };

        // Scroll listener to save position
        this._scrollListener = () => {
            if (window.location.hash.startsWith('#dashboard')) {
                sessionStorage.setItem('dashboard_scroll', window.scrollY);
            }
        };
        window.addEventListener('scroll', this._scrollListener);

        // Listeners para tarjetas de stats
        const cards = document.querySelectorAll('.stat-card');
        const section = document.getElementById('dynamic-plans-section');
        const closeBtn = document.getElementById('close-dynamic');

        // Card 0 (Planes Activos): Sin acción según requerimiento
        cards[0].style.cursor = 'default';
        
        // Cards 1 y 2 (Tareas): Mostrar detalle de tareas
        cards[1].onclick = () => {
            window.history.pushState({}, '', '#dashboard?view=upcoming');
            if (!this.queryParams) this.queryParams = {};
            this.queryParams.view = 'upcoming';
            this.showFilteredTasks('upcoming');
        };
        cards[2].onclick = () => {
            window.history.pushState({}, '', '#dashboard?view=overdue');
            if (!this.queryParams) this.queryParams = {};
            this.queryParams.view = 'overdue';
            this.showFilteredTasks('overdue');
        };

        closeBtn.onclick = () => {
            section.classList.add('hidden');
            window.history.pushState({}, '', '#dashboard');
            this.queryParams = {};
        };

        const dynamicFilterArea = document.getElementById('dynamic-filter-area');
        if (dynamicFilterArea) {
            dynamicFilterArea.onchange = () => {
                const areaVal = dynamicFilterArea.value;
                const currentView = this.queryParams?.view || 'overdue';
                window.history.replaceState({}, '', `#dashboard?view=${currentView}&area=${encodeURIComponent(areaVal)}`);
                if (!this.queryParams) this.queryParams = {};
                this.queryParams.area = areaVal;
                this.renderDynamicTasksList();
            };
        }

        const newPlanBtn = document.getElementById('new-plan-btn');
        if (newPlanBtn) newPlanBtn.onclick = () => this.app.navigateTo('plans/new');

        const inputs = ['filter-area', 'filter-lead', 'date-start', 'date-end', 'filter-period'];
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
                    saveDashboardState();
                    this.loadHistory();
                };
            }
        });

        // Setup custom multiselect events
        const trigger = document.getElementById('status-multiselect-trigger');
        const dropdown = document.getElementById('status-multiselect-dropdown');
        const checkboxes = document.querySelectorAll('#status-multiselect-dropdown input[type="checkbox"]');
        const triggerText = document.getElementById('status-trigger-text');

        const updateTriggerText = () => {
            const checked = Array.from(checkboxes).filter(cb => cb.checked);
            if (checked.length === 0) {
                triggerText.textContent = "Ninguno seleccionado";
            } else if (checked.length === checkboxes.length) {
                triggerText.textContent = "Todos los estados";
            } else {
                const labels = checked.map(cb => cb.nextElementSibling.textContent.replace(/[⏳⚡✅🔘🚫]/g, '').trim());
                triggerText.textContent = labels.join(', ');
            }
        };

        updateTriggerText();

        const arrowEl = document.getElementById('status-trigger-arrow');

        // Move dropdown to body as a "portal" to escape all overflow:hidden parents
        if (dropdown && !dropdown._isPortal) {
            // Remove any old dropdown from a previous view instantiation
            const oldDropdowns = document.body.querySelectorAll('#status-multiselect-dropdown');
            oldDropdowns.forEach(old => {
                if (old !== dropdown) {
                    old.remove();
                }
            });
            document.body.appendChild(dropdown);
            dropdown._isPortal = true;
        }

        const positionDropdown = () => {
            if (!trigger || !dropdown) return;
            const rect = trigger.getBoundingClientRect();
            const dropdownHeight = dropdown.offsetHeight || 220;
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            if (spaceBelow < dropdownHeight + 10 && spaceAbove > dropdownHeight + 10) {
                // Open upwards
                dropdown.style.top = (rect.top - dropdownHeight - 6) + 'px';
            } else {
                // Open downwards
                dropdown.style.top = (rect.bottom + 6) + 'px';
            }
            dropdown.style.left = rect.left + 'px';
            dropdown.style.width = rect.width + 'px';
        };

        const openDropdown = () => {
            dropdown.style.display = 'flex';
            positionDropdown();
            if (arrowEl) arrowEl.style.transform = 'rotate(180deg)';
            trigger.style.borderColor = 'var(--rosa-med)';
            trigger.style.boxShadow = '0 0 0 4px rgba(236,128,198,0.12)';
        };

        const closeDropdown = () => {
            dropdown.style.display = 'none';
            if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
            trigger.style.borderColor = 'rgba(210,50,143,0.15)';
            trigger.style.boxShadow = 'none';
        };

        // Reposition on scroll/resize so the fixed element follows the trigger
        const scrollHandler = () => {
            if (dropdown && dropdown.style.display === 'flex') positionDropdown();
        };
        window.removeEventListener('scroll', scrollHandler, true);
        window.addEventListener('scroll', scrollHandler, true);
        window.removeEventListener('resize', scrollHandler);
        window.addEventListener('resize', scrollHandler);

        if (trigger && dropdown) {
            trigger.onclick = (e) => {
                e.stopPropagation();
                if (dropdown.style.display === 'flex') {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            };

            document.addEventListener('click', (e) => {
                if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                    closeDropdown();
                }
            });
        }

        checkboxes.forEach(cb => {
            cb.onchange = () => {
                updateTriggerText();
                saveDashboardState();
                this.loadHistory();
            };
        });

        this.loadHistory();

        // Restaurar estado si viene de query params (por ejemplo al volver con botón Atrás)
        if (this.queryParams && this.queryParams.view) {
            this.showFilteredTasks(this.queryParams.view);
        }
    }

    async loadHistory() {
        const container = document.getElementById('plans-history-grid');
        const area = document.getElementById('filter-area').value;
        const lead = document.getElementById('filter-lead').value;
        const selectedStatuses = [];
        document.querySelectorAll('#status-multiselect-dropdown input:checked').forEach(cb => {
            selectedStatuses.push(cb.value);
            if (cb.value === 'cancelada') {
                selectedStatuses.push('cancelado');
            }
        });

        const period = document.getElementById('filter-period').value;
        const start = document.getElementById('date-start').value;
        const end = document.getElementById('date-end').value;

        try {
            const rawPlans = await FirebaseService.getPlansByRole(this.app.currentUser);
            const now = new Date();
            now.setHours(0,0,0,0);

            // 1. Obtener tareas para cálculos dinámicos sobre todos los planes disponibles
            const planIds = rawPlans.map(p => p.id);
            const rawTasks = await FirebaseService.getTasksByPlanIds(planIds);
            const allTasks = TaskUtils.computeDynamicStatuses(rawTasks);
            const tasksByPlan = {};
            allTasks.forEach(t => {
                if (!tasksByPlan[t.plan_id]) tasksByPlan[t.plan_id] = [];
                tasksByPlan[t.plan_id].push(t);
            });

            // 2. Pre-calcular el estado dinámico y el progreso dinámico para cada plan
            rawPlans.forEach(p => {
                const tasks = tasksByPlan[p.id] || [];
                let dynamicStatus = p.status || 'pendiente';
                let dynamicProgress = p.progress || 0;

                if (['cumplido', 'cancelada', 'cancelado'].includes(p.status)) {
                    dynamicStatus = p.status;
                    if (p.status === 'cumplido') {
                        dynamicProgress = 100;
                    }
                } else if (tasks.length > 0) {
                    const total = tasks.length;
                    const counts = tasks.reduce((acc, t) => {
                        acc[t.status] = (acc[t.status] || 0) + 1;
                        return acc;
                    }, {});

                    const completadas = counts['completado'] || 0;
                    const enProceso = counts['en_proceso'] || 0;
                    const pendientes = counts['pendiente'] || 0;
                    const canceladas = counts['cancelada'] || 0;

                    if (completadas === total) {
                        dynamicStatus = 'completado';
                    } else {
                        // Determinar el más frecuente de los estados activos no completados
                        // Excluimos 'completado' porque no todas las tareas están completadas
                        const stats = [
                            { s: 'en_proceso', c: enProceso },
                            { s: 'pendiente', c: pendientes },
                            { s: 'cancelada', c: canceladas }
                        ];
                        stats.sort((a, b) => b.c - a.c);
                        dynamicStatus = stats[0].s;
                    }

                    // Calcular Progreso (% Cronograma)
                    const vencidas = tasks.filter(t => {
                        if (t.status === 'completado' || !t.due_date) return false;
                        const d = new Date(t.due_date + 'T00:00:00');
                        return d < now;
                    }).length;

                    const score = ((completadas * 1) + (enProceso * 0.5) - (vencidas * 0.1)) / total;
                    dynamicProgress = Math.max(0, Math.min(100, Math.round(score * 100)));
                }

                p.dynamicStatus = dynamicStatus;
                p.dynamicProgress = dynamicProgress;
            });

            // 3. Aplicar filtros sobre el estado dinámico y propiedades calculadas
            let plans = rawPlans;

            plans = plans.filter(p => {
                const matchArea = area === 'all' || p.area === area;
                const matchLead = lead === 'all' || p.lead_id === lead;
                const matchStatus = selectedStatuses.includes(p.dynamicStatus);
                return matchArea && matchLead && matchStatus;
            });

            // 4. Filtrar por periodo
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

            // 5. Ordenar cronológicamente (más reciente primero)
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

                if (['cumplido', 'cancelada', 'cancelado'].includes(p.status)) {
                    dynamicStatus = p.status;
                    if (p.status === 'cumplido') {
                        dynamicProgress = 100;
                    }
                } else if (tasks.length > 0) {
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
                        // Determinar el más frecuente de los estados activos no completados
                        // Excluimos 'completado' porque no todas las tareas están completadas
                        const stats = [
                            { s: 'en_proceso', c: enProceso },
                            { s: 'pendiente', c: pendientes },
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

            this.historyLoaded = true;
            this.restoreScrollPosition();

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

        // Reset filter value to 'all' if element exists
        const dynamicFilterArea = document.getElementById('dynamic-filter-area');
        if (dynamicFilterArea) {
            dynamicFilterArea.value = this.queryParams?.area || 'all';
        }

        try {
            const user = this.app.currentUser;
            const plans = await FirebaseService.getPlansByRole(user);
            const activePlans = plans.filter(p => p.status !== 'completado' && p.status !== 'cumplido' && p.status !== 'cancelada' && p.status !== 'cancelado');
            const activePlanIds = activePlans.map(p => p.id);
            
            // Map plan ID to the full plan object (to get its area)
            this.loadedPlansMap = {};
            activePlans.forEach(p => this.loadedPlansMap[p.id] = p);

            const rawTasks = await FirebaseService.getTasksByPlanIds(activePlanIds);
            const allTasks = TaskUtils.computeDynamicStatuses(rawTasks);

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

            // Save state to class instance
            this.currentDynamicTasks = filteredTasks;

            // Fetch assignee user names
            const assignedIds = [...new Set(filteredTasks.map(t => t.assigned_id).filter(id => !!id))];
            this.loadedUserNames = await FirebaseService.getUserNamesByIds(assignedIds);

            // Render
            this.renderDynamicTasksList();
            
            this.dynamicTasksLoaded = true;
            if (this._isRestoringScroll) {
                this.restoreScrollPosition();
            } else {
                section.scrollIntoView({ behavior: 'smooth' });
            }

        } catch (error) {
            console.error(error);
            list.innerHTML = '<p class="error">Error al cargar el detalle de tareas.</p>';
        }
    }

    renderDynamicTasksList() {
        const list = document.getElementById('dynamic-plans-list');
        if (!list) return;

        const dynamicFilterArea = document.getElementById('dynamic-filter-area');
        const selectedArea = dynamicFilterArea ? dynamicFilterArea.value : 'all';

        let displayTasks = this.currentDynamicTasks || [];

        if (selectedArea && selectedArea !== 'all') {
            const memberAreaMap = {};
            if (this.members) {
                this.members.forEach(m => {
                    memberAreaMap[m.uid] = m.area;
                });
            }
            displayTasks = displayTasks.filter(t => {
                const assignedId = t.assigned_id;
                const memberArea = memberAreaMap[assignedId];
                return memberArea === selectedArea;
            });
        }

        if (displayTasks.length === 0) {
            list.innerHTML = '<p class="empty-state">No hay tareas en esta categoría para el área seleccionada.</p>';
            return;
        }

        const now = new Date();
        now.setHours(0,0,0,0);
        const userNames = this.loadedUserNames || {};

        list.innerHTML = `
            <div class="tasks-detail-container animate-up">
                <div class="tasks-detail-grid-header">
                    <div class="grid-h-col">Actividad</div>
                    <div class="grid-h-col">Asignado a</div>
                    <div class="grid-h-col">Fecha Compromiso</div>
                </div>
                ${displayTasks.map(t => {
                    const dueDate = new Date(t.due_date + 'T00:00:00');
                    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
                    const isRed = diffDays <= 0;

                    return `
                    <div class="tasks-detail-grid-row" onclick="location.hash='#plans/detail/${t.plan_id}?taskId=${t.id}'">
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
        `;
    }

    restoreScrollPosition() {
        const needsDynamic = !!(this.queryParams && this.queryParams.view);
        const canRestore = this.historyLoaded && (!needsDynamic || this.dynamicTasksLoaded);
        
        if (canRestore) {
            const savedScroll = sessionStorage.getItem('dashboard_scroll');
            if (savedScroll) {
                const scrollY = parseInt(savedScroll, 10);
                setTimeout(() => {
                    window.scrollTo({ top: scrollY, behavior: 'smooth' });
                }, 100);
            }
            this._isRestoringScroll = false;
        }
    }

    destroy() {
        if (this._scrollListener) {
            window.removeEventListener('scroll', this._scrollListener);
        }
    }
}
