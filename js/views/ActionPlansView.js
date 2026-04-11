import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class ActionPlansView extends View {
    async render() {
        const container = this.createEl('div', 'plans-container fade-in');
        
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Mis planes</h1>
                    <p style="color: var(--rosa-med); font-weight: 600;">Gestión directa de tareas y cumplimiento por proyecto</p>
                </div>
                ${['gerente', 'coordinador', 'coordinadora', 'miembro'].includes(this.app.currentUser.role) ? 
                    '<button class="primary-btn sm" id="new-plan-btn">+ Crear Nuevo Proyecto</button>' : ''}
            </div>
            
            <div class="filters-bar glass-effect" style="margin-top: 2rem; padding: 1.5rem; border-radius: var(--radius-md);">
                <div style="flex: 1; position: relative;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 700; color: var(--rosa-strong); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">🔍 Filtrar mis proyectos</label>
                    <div style="position: relative;">
                        <input type="text" placeholder="Buscar por nombre..." class="search-input" id="search-plans" style="padding-left: 3rem; width: 100%;">
                        <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); opacity: 0.7;">🔎</span>
                    </div>
                </div>
            </div>

            <div class="plans-grid-list" id="my-plans-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; margin-top: 2rem;">
                <div class="loading-inline">Cargando mis proyectos...</div>
            </div>
        `;
        
        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        const newPlanBtn = document.getElementById('new-plan-btn');
        if (newPlanBtn) newPlanBtn.onclick = () => this.app.navigateTo('plans/new');

        const searchInput = document.getElementById('search-plans');
        if (searchInput) {
            searchInput.oninput = () => this.loadMyPlans();
        }

        this.loadMyPlans();
    }

    async loadMyPlans() {
        const container = document.getElementById('my-plans-grid');
        const search = document.getElementById('search-plans').value.toLowerCase();

        try {
            const allPlans = await FirebaseService.getPlansByRole(this.app.currentUser);
            
            // FILTRO CRÍTICO: Solo donde soy el líder
            let myPlans = allPlans.filter(p => p.lead_id === this.app.currentUser.uid);
            
            if (search) {
                myPlans = myPlans.filter(p => p.title.toLowerCase().includes(search));
            }

            if (myPlans.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1; padding: 4rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📂</div>
                        <h3>No tienes proyectos asignados como líder</h3>
                        <p>Los proyectos que lideres aparecerán aquí para que gestiones sus tareas.</p>
                    </div>`;
                return;
            }

            container.innerHTML = myPlans.map((p, i) => `
                <div class="plan-card-item glass-effect animate-up" data-id="${p.id}" style="animation-delay: ${i * 0.1}s; border-top: 6px solid ${p.risk === 'red' ? '#ef4444' : 'var(--rosa-med)'}; padding: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <span class="badge" style="background: var(--rosa-light); color: var(--rosa-strong);">${p.status}</span>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-dim);">ID: ${p.id.substring(0,6)}</span>
                    </div>
                    
                    <h3 style="margin-bottom: 1rem; font-size: 1.3rem;">${p.title}</h3>
                    <p style="color: var(--text-dim); font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">${p.objective.substring(0, 120)}...</p>
                    
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem; font-weight: 600;">
                            <span>Progreso de Ejecución</span>
                            <span>${p.progress}%</span>
                        </div>
                        <div class="progress-bar" style="height: 10px;"><div class="progress" style="width: ${p.progress}%; background: linear-gradient(90deg, var(--rosa-med), var(--rosa-strong));"></div></div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <button class="primary-btn sm view-detail" data-id="${p.id}">Gestionar Tareas</button>
                        <button class="secondary-btn sm view-detail" data-id="${p.id}">Ver Equipo</button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.view-detail').forEach(btn => {
                btn.onclick = () => this.app.navigateTo(`plans/detail/${btn.dataset.id}`);
            });

        } catch (error) {
            console.error(error);
            container.innerHTML = 'Error al cargar tus proyectos.';
        }
    }
}
