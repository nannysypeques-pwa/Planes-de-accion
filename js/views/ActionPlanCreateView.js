import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class ActionPlanCreateView extends View {
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
                <h1>Nuevo Plan de Acción / Mejora</h1>
                <p>Identificación de problemática y asignación de responsables</p>
            </div>

            <form id="plan-form" class="glass-effect form-card">
                <div class="form-section">
                    <h3>1. Definición del Problema</h3>
                    <div class="input-group">
                        <label>Título del Plan</label>
                        <input type="text" id="title" required placeholder="Ej: Optimización de tiempos en entrega">
                    </div>
                    <div class="input-group">
                        <label>Descripción de la Problemática</label>
                        <textarea id="problem" class="custom-textarea" required placeholder="Describe el problema detectado..."></textarea>
                    </div>
                    <div class="input-group">
                        <label>KPI NOK (Estado actual del indicador)</label>
                        <input type="text" id="kpi_nok" required placeholder="Ej: 65% de entregas a tiempo">
                    </div>
                </div>

                <div class="form-section">
                    <h3>2. Objetivos</h3>
                    <div class="input-group">
                        <label>Objetivo Principal</label>
                        <textarea id="objective" class="custom-textarea" required placeholder="¿Qué queremos lograr?"></textarea>
                    </div>
                    <div class="input-group">
                        <label>KPI esperado (Meta a alcanzar)</label>
                        <input type="text" id="kpi_expected" required placeholder="Ej: 95% de entregas a tiempo">
                    </div>
                </div>

                <div class="form-section">
                    <h3>3. Asignación de Responsabilidad</h3>
                    
                    ${role === 'gerente' ? `
                    <div class="input-group">
                        <label>Coordinador de Área (Seguimiento)</label>
                        <select id="coordinator_id">
                            <option value="">Seleccione coordinador si aplica...</option>
                            ${coordinators.map(c => `<option value="${c.uid}">${c.name}</option>`).join('')}
                        </select>
                        <small>Recibirá notificaciones de seguimiento sin ser el responsable directo.</small>
                    </div>
                    ` : ''}

                    <div class="input-group">
                        <label>Líder de Proyecto (Responsable)</label>
                        ${role === 'miembro' ? `
                            <select id="lead_id" required style="pointer-events: none; background: #f8fafc;">
                                <option value="${this.app.currentUser.uid}" selected>${this.app.currentUser.name} (Tú)</option>
                            </select>
                            <small style="color: var(--rosa-strong); display: block; margin-top: 5px;">Como miembro, automatícamente eres asignado como el líder del plan.</small>
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
                    
                    <div class="input-group">
                        <label>Fecha Límite Compromiso</label>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <input type="date" id="due_date" required style="flex: 1;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0; cursor: pointer; white-space: nowrap;">
                                <input type="checkbox" id="is_recurrent" style="width: 20px; height: 20px;">
                                Actividad Recurrente
                            </label>
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="secondary-btn" onclick="window.history.back()">Cancelar</button>
                    <button type="submit" class="primary-btn">Crear y Notificar</button>
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

        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = "Creando...";

            const leadId = document.getElementById('lead_id').value;
            const leadArea = this.members.find(m => m.uid === leadId)?.area || 'General';

            const planData = {
                title: document.getElementById('title').value,
                problem: document.getElementById('problem').value,
                kpi_nok: document.getElementById('kpi_nok').value,
                objective: document.getElementById('objective').value,
                kpi_expected: document.getElementById('kpi_expected').value,
                coordinator_id: document.getElementById('coordinator_id')?.value || '',
                lead_id: leadId,
                area: leadArea,
                due_date: recurrentCheckbox.checked ? 'recurrent' : dueDateInput.value,
                creator_id: this.app.currentUser.uid,
                creator_name: this.app.currentUser.name,
                status: 'en_proceso',
                progress: 0,
                risk: 'green'
            };

            try {
                const planId = await FirebaseService.createActionPlan(planData);

                // Paso 4: Notificar al Líder
                await FirebaseService.sendNotification(
                    planData.lead_id,
                    "Nuevo Plan Asignado (LÍDER)",
                    `Has sido asignado como líder del plan: ${planData.title}`,
                    `#plans/detail/${planId}`
                );

                // Notificar al Coordinador si existe
                if (planData.coordinator_id) {
                    await FirebaseService.sendNotification(
                        planData.coordinator_id,
                        "Nuevo Plan en Seguimiento",
                        `Has sido asignado para seguimiento del plan: ${planData.title}`,
                        `#plans/detail/${planId}`
                    );
                }

                ToastService.success("Plan creado con éxito. Líder y coordinador notificados.");
                this.app.navigateTo('plans');
            } catch (error) {
                ToastService.error("Error al crear el plan: " + error.message);
                btn.disabled = false;
                btn.textContent = "Crear y Notificar Líder";
            }
        };
    }
}
