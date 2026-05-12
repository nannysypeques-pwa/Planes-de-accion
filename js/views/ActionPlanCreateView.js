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
                <!-- D1 & D2: Equipo y Definición del Problema -->
                <div class="form-section">
                    <div class="section-badge">D1 & D2</div>
                    <h3>Equipo y Definición del Problema</h3>
                    <div class="input-group">
                        <label>Título del Plan (Estratégico)</label>
                        <input type="text" id="title" required placeholder="Ej: KPI Clientes nuevos">
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

                    <div id="reverse-summary" class="reverse-summary-box hidden animate-up">
                        <h4>Validación Lógica (Resumen al revés)</h4>
                        <div id="reverse-list" class="reverse-summary-list"></div>
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

                <div class="form-actions">
                    <button type="button" class="secondary-btn" onclick="window.history.back()">Cancelar</button>
                    <button type="submit" class="primary-btn">Crear Plan de Mejora Continua</button>
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
            const inputs = Array.from(document.querySelectorAll('.why-field'));
            const problem = problemD4Input.value.trim();
            const whys = inputs.map(i => i.value.trim()).filter(v => v !== '');

            if (whys.length > 1) {
                reverseSummary.classList.remove('hidden');
                let html = '';
                for (let i = whys.length - 1; i > 0; i--) {
                    html += `<div class="reverse-item">Porque <strong>${whys[i]}</strong>, entonces <strong>${whys[i - 1]}</strong>.</div>`;
                }
                if (whys[0] && problem) {
                    html += `<div class="reverse-item">Porque <strong>${whys[0]}</strong>, el resultado fue: <strong>${problem}</strong>.</div>`;
                }
                reverseList.innerHTML = html;
            } else {
                reverseSummary.classList.add('hidden');
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

        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = "Creando Plan de Mejora Continua...";

            const leadId = document.getElementById('lead_id').value;
            const leadArea = this.members.find(m => m.uid === leadId)?.area || 'General';

            const whys = Array.from(document.querySelectorAll('.why-field'))
                .map(i => i.value.trim())
                .filter(v => v !== '');

            const planData = {
                title: document.getElementById('title').value,
                problem: document.getElementById('problem').value,
                problem_d4: problemD4Input.value,
                whys: whys,
                prevention: '', // Se definirá en una etapa posterior de revisión
                kpi_nok: document.getElementById('kpi_nok').value,
                objective: "Mejora Continua 8D's", // Autocompletado por metodología
                kpi_expected: document.getElementById('kpi_expected').value,
                coordinator_id: document.getElementById('coordinator_id')?.value || '',
                lead_id: leadId,
                area: leadArea,
                due_date: recurrentCheckbox.checked ? 'recurrent' : dueDateInput.value,
                creator_id: this.app.currentUser.uid,
                creator_name: this.app.currentUser.name,
                status: 'en_proceso',
                progress: 0,
                risk: 'green',
                methodology: '8D'
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
