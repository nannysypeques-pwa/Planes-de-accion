import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class VacacionesView extends View {
    constructor(app) {
        super(app);
        this.stats = null;
        this._unsubscribe = null; // Listener en tiempo real
    }
    async render() {
        const container = this.createEl('div', 'vacaciones-view fade-in');
        const user = this.app.currentUser;
        
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Mi Descanso y Vacaciones</h1>
                    <p style="color: var(--rosa-med); font-weight: 600;">Gestiona tus días libres por ley y visualiza aprobaciones</p>
                </div>
            </div>

            <div class="glass-effect glass-container-padding" style="margin-top: 2rem; border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: 2rem;">
                
                <div class="responsive-flex-layout">
                    
                    ${user.role !== 'gerente' ? `
                    <!-- Columna Izquierda: Información y Solicitud -->
                    <div class="responsive-column">
                        <div id="vacation-stats-card" style="background: linear-gradient(135deg, var(--rosa-light) 0%, #fff 100%); border-radius: var(--radius-md); padding: 2rem; box-shadow: 0 10px 25px rgba(210, 50, 143, 0.08); border: 1px solid rgba(210, 50, 143, 0.1); margin-bottom: 2rem; position: relative; overflow: hidden;">
                            <div style="position: absolute; right: -20px; top: -20px; font-size: 8rem; opacity: 0.05;">🏖️</div>
                            <h3 style="color: var(--azul-deep); font-size: 1.1rem; margin-bottom: 1.5rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Mis Días Disponibles</h3>
                            
                            <div style="display: flex; align-items: baseline; gap: 10px;">
                                <span id="vac-available" style="font-size: 4rem; font-weight: 800; line-height: 1; background: linear-gradient(135deg, var(--rosa-strong), var(--rosa-med)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">--</span>
                                <span style="font-size: 1.2rem; font-weight: 600; color: var(--text-dim);">días</span>
                            </div>
                            
                            <div style="display: flex; gap: 1.5rem; margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 1.5rem;">
                                <div>
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Totales</div>
                                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--azul-deep);" id="vac-total">--</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Aprobados</div>
                                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--azul-deep);" id="vac-used">--</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">En Trámite</div>
                                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--amarillo-strong);" id="vac-pending">--</div>
                                </div>
                            </div>
                        </div>

                        <div class="form-card" style="box-shadow: none; border: 1px solid var(--border);">
                            <h3 style="margin-bottom: 1.5rem; color: var(--azul-deep);">Solicitar Vacaciones</h3>
                            <form id="request-vacation-form">
                                <div class="input-group">
                                    <label>Selecciona los días a disfrutar</label>
                                    <input type="text" id="vac-dates" required placeholder="Haz clic para abrir el calendario y seleccionar los días">
                                </div>
                                <div class="input-group">
                                    <label>Total de días solicitados</label>
                                    <input type="number" id="vac-days-req" required min="1" placeholder="0" readonly style="background: var(--bg-light); border-color: transparent; font-weight: 800; color: var(--rosa-strong); pointer-events: none;">
                                    <small id="vac-remaining-text" style="color: var(--azul-med); font-weight: 600; display: block; margin-top: 5px;"></small>
                                </div>
                                
                                <button type="submit" class="primary-btn" style="width: 100%; margin-top: 1rem;" id="submit-vac-btn">Enviar Solicitud</button>
                            </form>
                        </div>
                    </div>
                    ` : ''}
 
                    <!-- Columna Derecha: Historial y Bandeja de Aprobación -->
                    <div class="responsive-column" style="flex: ${user.role === 'gerente' ? '1' : '2'};">
                        ${user.role === 'gerente' ? `
                            <div id="vac-chrono-wrapper" style="margin-bottom: 3rem;">
                                <h3 style="margin-bottom: 1rem; color: var(--azul-deep);">Cronograma de Vacaciones</h3>
                                <div id="vacation-chrono-container" style="border: 1px solid var(--border); border-radius: var(--radius-md); overflow-x: auto; background: white; white-space: nowrap; position: relative;">
                                    <div class="loading-inline" style="padding: 2rem;">Construyendo cronograma...</div>
                                </div>
                            </div>
                        ` : ''}

                        ${['coordinador', 'coordinadora', 'gerente'].includes(user.role) ? `
                            <div id="approvals-section" style="${user.role !== 'gerente' ? 'margin-bottom: 3rem;' : ''}">
                                <h3 style="margin-bottom: 1rem; color: var(--azul-deep); display: flex; justify-content: space-between; align-items: center;">
                                    Bandeja de Aprobaciones
                                    <span class="badge" style="background: var(--amarillo-light); color: var(--amarillo-strong); font-size: 0.7rem;">Por Autorizar</span>
                                </h3>
                                <div id="approvals-list" style="display: ${user.role === 'gerente' ? 'grid' : 'flex'}; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; flex-direction: column;">
                                    <div class="loading-inline">Cargando solicitudes...</div>
                                </div>
                            </div>
                        ` : ''}

                        ${user.role !== 'gerente' ? `
                        <div>
                            <h3 style="margin-bottom: 1rem; color: var(--text-main);">Mi Historial de Solicitudes</h3>
                            <div id="my-requests-list" style="display: flex; flex-direction: column; gap: 1rem;">
                                <div class="loading-inline">Cargando historial...</div>
                            </div>
                        </div>
                        ` : ''}

                    </div>

                </div>

                ${['coordinador', 'coordinadora', 'gerente'].includes(user.role) ? `
                    <div style="margin-top: 1rem; padding-top: 2rem; border-top: 1px dashed var(--border);">
                        <h3 style="margin-bottom: 1.5rem; color: var(--azul-deep);">Saldos Vacacionales del Equipo</h3>
                        <div id="team-vacations-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                            <div class="loading-inline">Calculando saldos del equipo...</div>
                        </div>
                    </div>
                ` : ''}

            </div>
        `;
        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        
        // Actualizar el cache del usuario para obtener campos recién guardados (como hire_date) sin tener que reloguear
        const freshData = await FirebaseService.getCurrentUserProfile(this.app.currentUser.uid);
        if (freshData) {
            this.app.currentUser = { ...this.app.currentUser, ...freshData };
            localStorage.setItem('user_session', JSON.stringify(this.app.currentUser));
        }

        const user = this.app.currentUser;
        
        // Comprobar si tiene fecha de ingreso
        if (user.role !== 'gerente') {
            if (!user.hire_date) {
                const statsCard = document.getElementById('vacation-stats-card');
                if (statsCard) {
                    statsCard.innerHTML = `
                        <div style="text-align: center; padding: 2rem 0;">
                            <span style="font-size: 3rem;">📅</span>
                            <h3 style="color: var(--rosa-strong); margin-top: 1rem;">Falta Fecha de Ingreso</h3>
                            <p style="color: var(--text-dim);">Pide a tu gerente que actualice tu fecha de ingreso en la sección "Gestión de Equipo" para poder calcular tus vacaciones.</p>
                        </div>
                    `;
                }
                const btn = document.getElementById('submit-vac-btn');
                if (btn) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                }
            } else {
                this.loadStats();
            }
        }

        this.listenToLists();
        
        if (['coordinador', 'coordinadora', 'gerente'].includes(user.role)) {
            this.loadTeamStats(user);
        }

        const dateInput = document.getElementById('vac-dates');
        if (dateInput && window.flatpickr) {
            // Check if styles were loaded, if not wait or ignore (handled by browser)
            flatpickr(dateInput, {
                mode: "multiple",
                dateFormat: "Y-m-d",
                locale: "es",
                onChange: (selectedDates) => {
                    const count = selectedDates.length;
                    document.getElementById('vac-days-req').value = count;
                    const submitBtn = document.getElementById('submit-vac-btn');
                    if (this.stats && this.stats.available !== undefined) {
                        const rem = this.stats.available - count;
                        const tip = document.getElementById('vac-remaining-text');
                        if (rem >= 0) {
                            tip.textContent = `Después de tu solicitud te restarán ${rem} días disponibles.`;
                            tip.style.color = 'var(--azul-deep)';
                            if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
                        } else {
                            tip.textContent = `⚠️ Excedes tu saldo por ${Math.abs(rem)} días. Reduce tu selección.`;
                            tip.style.color = '#ef4444';
                            if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
                        }
                    }
                }
            });
        }

        const form = document.getElementById('request-vacation-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.submitRequest();
            };
        }
    }

    async loadStats() {
        try {
            const user = this.app.currentUser;
            this.stats = await FirebaseService.getUserVacationStats(user);
            
            document.getElementById('vac-total').textContent = this.stats.total;
            document.getElementById('vac-used').textContent = this.stats.used;
            document.getElementById('vac-pending').textContent = this.stats.pending;
            document.getElementById('vac-available').textContent = this.stats.available;
        } catch (e) {
            console.error("Error al cargar stats:", e);
        }
    }

    async submitRequest() {
        if (!this.stats || this.stats.available <= 0) {
            return ToastService.error("No cuentas con días disponibles para solicitar.");
        }

        const datesStr = document.getElementById('vac-dates').value;
        const days = parseInt(document.getElementById('vac-days-req').value) || 0;

        if (days === 0) {
            return ToastService.error("Debes seleccionar al menos un día en el calendario.");
        }

        if (days > this.stats.available) {
            return ToastService.error(`Solo tienes ${this.stats.available} días disponibles. Estás solicitando ${days}.`);
        }

        const arr = datesStr.split(', ');
        arr.sort();
        const start = arr[0] || '';
        const end = arr[arr.length - 1] || '';

        const btn = document.getElementById('submit-vac-btn');
        btn.disabled = true;
        btn.textContent = "Enviando...";

        try {
            await FirebaseService.requestVacation({
                uid: this.app.currentUser.uid,
                name: this.app.currentUser.name,
                area: this.app.currentUser.area,
                start_date: start,
                end_date: end,
                full_dates: datesStr,
                days_requested: days
            });

            ToastService.success("Solicitud enviada correctamente.");
            document.getElementById('request-vacation-form').reset();
            
            await this.loadStats();
            // onSnapshot actualiza el historial en tiempo real
        } catch (e) {
            ToastService.error("Error al enviar: " + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Enviar Solicitud";
        }
    }

    listenToLists() {
        const user = this.app.currentUser;

        // Cancelar listener anterior si existía
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        let query;
        if (user.role === 'coordinador' || user.role === 'coordinadora') {
            // Coordinador ve todas las solicitudes de su área
            query = db.collection('vacation_requests').where('area', '==', user.area);
        } else if (user.role === 'gerente') {
            // Gerente ve absolutamente todo
            query = db.collection('vacation_requests');
        } else {
            // Miembro ve solo sus propias solicitudes (eficiente + suficiente)
            query = db.collection('vacation_requests').where('uid', '==', user.uid);
        }

        this._unsubscribe = query.onSnapshot(snap => {
            const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const myRequests = requests.filter(r => r.uid === user.uid);

            let approvals = [];
            if (user.role === 'coordinador' || user.role === 'coordinadora') {
                approvals = requests.filter(r => r.uid !== user.uid && r.status === 'pendiente');
            } else if (user.role === 'gerente') {
                approvals = requests.filter(r => r.uid !== user.uid && (
                    r.status === 'aprobado_coordinador' || r.status === 'pendiente'
                ));
            }

            this.renderMyRequests(myRequests);

            if (['coordinador', 'coordinadora', 'gerente'].includes(user.role)) {
                this.renderApprovals(approvals);
            }

            if (user.role === 'gerente') {
                this.renderChronogram(requests);
            }

            // Refrescar saldo propio (miembro y coordinador cuando sus propias solicitudes cambian de estado)
            if (user.role !== 'gerente') {
                this.loadStats();
            }

            // Refrescar saldos del equipo en tiempo real (para coordinador y gerente)
            // Se llama con un pequeño debounce para no saturar si hay varios cambios simultáneos
            if (['coordinador', 'coordinadora', 'gerente'].includes(user.role)) {
                clearTimeout(this._teamStatsDebounce);
                this._teamStatsDebounce = setTimeout(() => {
                    this.loadTeamStats(user);
                }, 800);
            }

        }, err => {
            console.error('Error en listener de vacaciones:', err);
        });
    }

    destroy() {
        // Llamado cuando la vista se desmonta
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }

    renderMyRequests(list) {
        const container = document.getElementById('my-requests-list');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 1rem;">No tienes solicitudes previas.</div>';
            return;
        }

        const canEditStatuses = ['pendiente']; // Solo editable cuando está pendiente (no aprobada aún)

        container.innerHTML = list.map(req => {
            const st = this.getStatusConfig(req.status);
            const canEdit = canEditStatuses.includes(req.status);
            return `
                <div class="vacation-req-card" id="reqcard-${req.id}">
                    <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 700; color: var(--azul-deep); font-size: 1.05rem;">
                                ${req.days_requested} días solicitados
                            </div>
                            <div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 4px;">
                                <strong>Fechas:</strong> ${req.full_dates || req.start_date + ' al ' + req.end_date}
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                            <div class="status-pill ${st.cls}">${st.label}</div>
                            ${canEdit ? `<button class="btn-edit-req" data-id="${req.id}" data-dates="${req.full_dates || ''}" data-originaldays="${req.days_requested}" style="font-size: 0.75rem; color: var(--azul-med); background: none; border: 1px solid var(--azul-med); border-radius: 8px; padding: 2px 10px; cursor: pointer;">✏️ Editar</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Eventos de edición
        container.querySelectorAll('.btn-edit-req').forEach(btn => {
            btn.onclick = () => this.openEditRequest(btn.dataset.id, btn.dataset.dates, parseInt(btn.dataset.originaldays) || 0);
        });
    }

    openEditRequest(reqId, currentDatesStr, originalDays = 0) {
        // Si ya hay un editor abierto, cerrarlo
        const existing = document.getElementById('edit-req-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'edit-req-modal';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 1rem;">
                <div class="glass-effect" style="background: white; border-radius: var(--radius-lg); padding: 2rem; max-width: 450px; width: 100%; box-shadow: 0 25px 60px rgba(0,0,0,0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="color: var(--azul-deep);">✏️ Editar Solicitud</h3>
                        <button id="close-edit-modal" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--text-dim);">✕</button>
                    </div>
                    <div class="input-group">
                        <label>Selecciona los nuevos días</label>
                        <input type="text" id="edit-vac-dates" placeholder="Abre el calendario para seleccionar" style="width: 100%;">
                    </div>
                    <div class="input-group">
                        <label>Total de días</label>
                        <input type="number" id="edit-vac-count" readonly placeholder="0" style="background: var(--bg-light); pointer-events: none; font-weight: 800; color: var(--rosa-strong);">
                        <small id="edit-vac-hint" style="display: block; margin-top: 4px; font-size: 0.8rem;"></small>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button id="cancel-edit-req" class="secondary-btn" style="flex: 1;">Cancelar</button>
                        <button id="save-edit-req" class="primary-btn" style="flex: 1;" data-id="${reqId}">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Inicializar flatpickr dentro del modal
        const currentDates = currentDatesStr ? currentDatesStr.split(', ').filter(Boolean) : [];
        if (window.flatpickr) {
            flatpickr('#edit-vac-dates', {
                mode: 'multiple',
                dateFormat: 'Y-m-d',
                locale: 'es',
                defaultDate: currentDates,
                onChange: (selectedDates) => {
                    const count = selectedDates.length;
                    document.getElementById('edit-vac-count').value = count;
                    const saveBtn = document.getElementById('save-edit-req');
                    const hintEl = document.getElementById('edit-vac-hint');
                    if (this.stats) {
                        // El saldo disponible actual ya descuenta los días originales de esta solicitud.
                        // Necesitamos sumarlos de vuelta para ver cuántos podemos reasignar.
                        const budgetForEdit = (this.stats.available || 0) + originalDays;
                        const rem = budgetForEdit - count;
                        if (rem >= 0) {
                            if (hintEl) { hintEl.textContent = `Puedes usar hasta ${budgetForEdit} días. Restarán ${rem} libres.`; hintEl.style.color = 'var(--azul-deep)'; }
                            if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
                        } else {
                            if (hintEl) { hintEl.textContent = `⚠️ Excedes tu saldo en ${Math.abs(rem)} días.`; hintEl.style.color = '#ef4444'; }
                            if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.6'; }
                        }
                    }
                }
            });
            document.getElementById('edit-vac-count').value = currentDates.length;
        }

        document.getElementById('close-edit-modal').onclick = () => modal.remove();
        document.getElementById('cancel-edit-req').onclick = () => modal.remove();
        document.getElementById('save-edit-req').onclick = () => this.saveEditRequest(reqId, modal, originalDays);
    }

    async saveEditRequest(reqId, modal, originalDays = 0) {
        const datesStr = document.getElementById('edit-vac-dates').value;
        const days = parseInt(document.getElementById('edit-vac-count').value) || 0;

        if (days === 0) {
            return ToastService.error('Debes seleccionar al menos un día.');
        }

        // Validar saldo: disponible actual + días originales >= nuevos días solicitados
        if (this.stats) {
            const budgetForEdit = (this.stats.available || 0) + originalDays;
            if (days > budgetForEdit) {
                return ToastService.error(`Solo tienes ${budgetForEdit} días disponibles para esta solicitud. Estás intentando usar ${days}.`);
            }
        }

        const confirmed = await this.showBeautifulConfirm(
            '¿Guardar cambios?',
            '¿Deseas guardar las modificaciones en esta solicitud de vacaciones?',
            'Sí, Guardar'
        );
        if (!confirmed) return;

        const arr = datesStr.split(', ').filter(Boolean).sort();
        const start = arr[0] || '';
        const end = arr[arr.length - 1] || '';

        const saveBtn = document.getElementById('save-edit-req');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        try {
            await db.collection('vacation_requests').doc(reqId).update({
                full_dates: datesStr,
                start_date: start,
                end_date: end,
                days_requested: days,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            ToastService.success('Solicitud actualizada correctamente.');
            modal.remove();
            // El listener onSnapshot actualizará la UI automáticamente
        } catch (err) {
            console.error('Error editando solicitud:', err);
            ToastService.error('Error al guardar los cambios.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar Cambios';
        }
    }

    showBeautifulConfirm(title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar') {
        return new Promise((resolve) => {
            // Quitar cualquier confirm previo
            const prev = document.getElementById('beautiful-confirm-overlay');
            if (prev) prev.remove();

            const overlay = document.createElement('div');
            overlay.id = 'beautiful-confirm-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 10000;
                background: rgba(20, 20, 50, 0.55);
                backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                padding: 1.5rem;
                animation: fadeIn 0.15s ease;
            `;

            overlay.innerHTML = `
                <div style="
                    background: white;
                    border-radius: var(--radius-lg);
                    padding: 2rem 2.5rem;
                    max-width: 380px;
                    width: 100%;
                    box-shadow: 0 30px 80px rgba(210, 50, 143, 0.18), 0 8px 30px rgba(0,0,0,0.12);
                    text-align: center;
                    animation: slideUp 0.2s ease;
                ">
                    <div style="font-size: 2.8rem; margin-bottom: 0.8rem;">🏖️</div>
                    <h3 style="color: var(--azul-deep); font-size: 1.2rem; margin-bottom: 0.5rem; font-weight: 800;">${title}</h3>
                    <p style="color: var(--text-dim); font-size: 0.92rem; margin-bottom: 1.8rem; line-height: 1.5;">${message}</p>
                    <div style="display: flex; gap: 0.8rem; justify-content: center;">
                        <button id="bconfirm-cancel" style="
                            flex: 1; padding: 0.7rem 1rem;
                            border: 1.5px solid var(--border);
                            border-radius: var(--radius-md);
                            background: white;
                            color: var(--text-dim);
                            font-size: 0.9rem;
                            font-weight: 700;
                            cursor: pointer;
                            transition: var(--transition);
                        ">${cancelLabel}</button>
                        <button id="bconfirm-ok" style="
                            flex: 1; padding: 0.7rem 1rem;
                            border: none;
                            border-radius: var(--radius-md);
                            background: linear-gradient(135deg, var(--rosa-strong), var(--rosa-med));
                            color: white;
                            font-size: 0.9rem;
                            font-weight: 800;
                            cursor: pointer;
                            box-shadow: 0 4px 15px rgba(210, 50, 143, 0.35);
                            transition: var(--transition);
                        ">${confirmLabel}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const cleanup = (result) => {
                overlay.style.animation = 'fadeIn 0.1s ease reverse';
                setTimeout(() => overlay.remove(), 100);
                resolve(result);
            };

            document.getElementById('bconfirm-ok').onclick = () => cleanup(true);
            document.getElementById('bconfirm-cancel').onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    }

    renderApprovals(list) {
        const container = document.getElementById('approvals-list');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 1.5rem;">Todo al día. No hay solicitudes pendientes.</div>';
            return;
        }

        container.innerHTML = list.map(req => {
            return `
                <div class="vacation-req-card approval-card" data-id="${req.id}">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <div style="flex: 1;">
                            <div style="font-weight: 800; color: var(--azul-deep); font-size: 1.1rem;">${this.escapeHTML(req.name)}</div>
                            <div style="font-size: 0.85rem; color: var(--rosa-strong); font-weight: 700; margin-bottom: 4px;">Área: ${this.escapeHTML(req.area) || 'N/A'}</div>
                            <div style="color: var(--text-dim); font-size: 0.9rem;">
                                Solicita <strong>${req.days_requested} días</strong><br>
                                (${req.start_date} al ${req.end_date})
                            </div>
                            <div style="margin-top: 6px; font-size: 0.8rem; opacity: 0.6;">
                                Estado actual: ${this.getStatusConfig(req.status).label}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                            <button class="primary-btn sm btn-approve" data-id="${req.id}" style="background: var(--azul-med);">✅ Aprobar</button>
                            <button class="secondary-btn sm btn-reject" data-id="${req.id}" style="color: #ef4444; border-color: #ef4444;">❌ Rechazar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-approve').forEach(btn => {
            btn.onclick = () => this.handleAction(btn.dataset.id, 'approve');
        });

        container.querySelectorAll('.btn-reject').forEach(btn => {
            btn.onclick = () => this.handleAction(btn.dataset.id, 'reject');
        });
    }

    async handleAction(id, action) {
        const confirmMsg = action === 'approve' ? "¿Aprobar esta solicitud?" : "¿Rechazar esta solicitud de vacaciones?";
        const confirmed = await ToastService.confirm(confirmMsg, action === 'approve' ? 'Sí, Aprobar' : 'Sí, Rechazar');
        if (!confirmed) return;

        try {
            const role = this.app.currentUser.role;
            let newStatus;
            
            if (action === 'reject') {
                newStatus = 'rechazado';
            } else {
                // Si es coordinador, pasa a aprobación gerencia, si es gerente ya está aprobado final.
                if (role === 'coordinador' || role === 'coordinadora') {
                    newStatus = 'aprobado_coordinador';
                } else if (role === 'gerente') {
                    newStatus = 'aprobado_gerencia';
                }
            }

            await db.collection('vacation_requests').doc(id).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: this.app.currentUser.uid
            });

            // Notificar al solicitante
            const reqDoc = await db.collection('vacation_requests').doc(id).get();
            const reqData = reqDoc.data();
            const applicantId = reqData.uid;
            
            let notifTitle = "Actualización de Vacaciones";
            let notifBody = "";
            if (newStatus === 'aprobado_gerencia') {
                notifTitle = "✅ Vacaciones Autorizadas";
                notifBody = `Tu solicitud para el periodo ${reqData.start_date || reqData.full_dates} ha sido autorizada por gerencia.`;
            } else if (newStatus === 'aprobado_coordinador') {
                notifTitle = "⏳ Vacaciones en Trámite";
                notifBody = `Tu coordinador ha aprobado tu solicitud. Pendiente de validación final por gerencia.`;
            } else if (newStatus === 'rechazado') {
                notifTitle = "❌ Solicitud Rechazada";
                notifBody = `Tu solicitud de vacaciones ha sido rechazada. Por favor contacta a tu líder.`;
            }

            if (notifBody) {
                const { FirebaseService } = await import('../services/FirebaseService.js');
                await FirebaseService.sendNotification(applicantId, notifTitle, notifBody, "#vacaciones");
            }

            ToastService.success(action === 'approve' ? "Solicitud aprobada y notificada" : "Solicitud rechazada y notificada");
            // onSnapshot actualiza la bandeja en tiempo real
            
        } catch (e) {
            ToastService.error("Error: " + e.message);
        }
    }

    getStatusConfig(status) {
        switch(status) {
            case 'pendiente': return { label: '⏳ En revisión (Coordinador)', cls: 'status-pendiente' };
            case 'aprobado_coordinador': return { label: '⏳ Trámite (Gerencia)', cls: 'status-en_proceso' };
            case 'aprobado_gerencia':
            case 'aprobado': return { label: '✅ Aprobado', cls: 'status-completado' };
            case 'rechazado': return { label: '❌ Rechazado', cls: 'status-overdue' }; // reusing red
            default: return { label: status, cls: '' };
        }
    }

    async loadTeamStats(user) {
        const grid = document.getElementById('team-vacations-grid');
        if (!grid) return;

        try {
            const allUsers = await FirebaseService.getAllMembers();
            let team = [];

            if (user.role === 'gerente') {
                // Gerente ve a miembros y coordinadores de toda la agencia
                team = allUsers.filter(u => u.uid !== user.uid && ['miembro', 'coordinador', 'coordinadora'].includes(u.role));
            } else {
                // Coordinador ve a los miembros de su propia área
                team = allUsers.filter(u => u.uid !== user.uid && u.area === user.area && u.role === 'miembro');
            }

            if (team.length === 0) {
                grid.innerHTML = '<div class="empty-state">No tienes equipo a cargo o no hay usuarios registrados.</div>';
                return;
            }

            // Calcular stats de cada uno
            const teamWithStats = await Promise.all(team.map(async u => {
                const stats = await FirebaseService.getUserVacationStats(u);
                return { ...u, stats };
            }));

            // Sort by available days (optional) or name
            teamWithStats.sort((a, b) => a.name.localeCompare(b.name));

            grid.innerHTML = teamWithStats.map(m => {
                const s = m.stats;
                const hasSetup = !!m.hire_date;
                const available = hasSetup ? s.available : '0';

                return `
                    <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; transition: var(--transition); box-shadow: var(--shadow-soft);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.8rem;">
                                <div style="width: 35px; height: 35px; border-radius: 50%; background: linear-gradient(135deg, var(--rosa-light), var(--rosa-med)); display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--rosa-strong); font-size: 0.9rem;">
                                    ${m.name.charAt(0)}
                                </div>
                                <div>
                                    <div style="font-weight: 800; color: var(--azul-deep); font-size: 0.95rem;">${this.escapeHTML(m.name)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">${m.role} • ${this.escapeHTML(m.area) || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-light); border-radius: var(--radius-sm); padding: 1rem; text-align: center;">
                            <div style="font-size: 2rem; font-weight: 800; color: ${hasSetup ? 'var(--rosa-strong)' : 'var(--text-dim)'}; line-height: 1;">
                                ${available}
                            </div>
                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-dim); margin-top: 4px;">días disponibles</div>
                            ${this.app.currentUser.role === 'gerente' && hasSetup ? `
                                <div style="margin-top: 0.8rem; display: flex; justify-content: center;">
                                    <button class="vac-edit-trigger shadow-sm" data-uid="${m.uid}" style="background:rgba(255,255,255,0.8); border:1px solid #ddd; cursor:pointer; font-size:1.1rem; padding: 4px 12px; border-radius: 12px; transition:0.2s;" onmouseover="this.style.background='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.8)'" title="Editar días disponibles">✏️ Editar</button>
                                </div>
                                <div id="vac-edit-${m.uid}" style="display:none; margin-top: 0.8rem; align-items:center; justify-content:center; gap:5px; flex-direction:column;">
                                    <div style="display:flex; gap:5px; align-items:center;">
                                        <input type="number" id="vac-input-${m.uid}" value="${available}" style="width:50px; text-align:center; border:1px solid #ddd; border-radius:4px; padding:4px;">
                                        <button class="vac-save-btn" data-uid="${m.uid}" data-base="${s.baseTotal}" data-used="${s.used}" data-pending="${s.pending}" style="background:#10b981; color:white; border:none; border-radius:4px; padding:5px 8px; font-weight:700; cursor:pointer;" title="Guardar cambios">✓</button>
                                        <button class="vac-cancel-btn" data-uid="${m.uid}" style="background:var(--bg-light); color:var(--text-dim); border:1px solid #ddd; border-radius:4px; padding:4px 8px; font-weight:700; cursor:pointer;" title="Cancelar">✕</button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div style="text-align: center; margin-top: 0.8rem; font-size: 0.8rem; color: #ef4444; font-weight: 600;">
                            ${hasSetup ? '' : 'Falta Fecha de Ingreso'}
                        </div>
                    </div>
                `;
            }).join('');

            // Asignar eventos de ajuste manual si es gerente
            if (user.role === 'gerente') {
                grid.onclick = async (e) => {
                    const editBtn = e.target.closest('.vac-edit-trigger');
                    if (editBtn) {
                        const uid = editBtn.dataset.uid;
                        document.getElementById('vac-edit-' + uid).style.display = 'flex';
                        editBtn.parentElement.style.display = 'none';
                        return;
                    }

                    const cancelBtn = e.target.closest('.vac-cancel-btn');
                    if (cancelBtn) {
                        const uid = cancelBtn.dataset.uid;
                        document.getElementById('vac-edit-' + uid).style.display = 'none';
                        document.querySelector(`.vac-edit-trigger[data-uid="${uid}"]`).parentElement.style.display = 'flex';
                        return;
                    }

                    const saveBtn = e.target.closest('.vac-save-btn');
                    if (saveBtn) {
                        const uid = saveBtn.dataset.uid;
                        const inputEl = document.getElementById('vac-input-' + uid);
                        const inputVal = parseInt(inputEl.value, 10);
                        if (isNaN(inputVal)) return;

                        const ok = await ToastService.confirm('¿Estás seguro de establecer esta cantidad como los días disponibles para este usuario? El ajuste se mantendrá de forma manual y alterará su saldo de la Ley.');
                        if (!ok) return;
                        
                        const base = parseInt(saveBtn.dataset.base, 10) || 0;
                        const used = parseInt(saveBtn.dataset.used, 10) || 0;
                        const pending = parseInt(saveBtn.dataset.pending, 10) || 0;
                        
                        // Cálculo del bono absoluto necesario: nuevo_adj = inputVal - baseTotal + used + pending
                        const newManualAdj = inputVal - base + used + pending;
                        
                        try {
                            const originalHtml = saveBtn.innerHTML;
                            saveBtn.innerHTML = '...';
                            saveBtn.disabled = true;
                            inputEl.disabled = true;
                            
                            await FirebaseService.setManualVacationAdjustment(uid, newManualAdj);
                            await this.loadTeamStats(user); // refrescar UI
                            
                        } catch (err) {
                            console.error('Error ajustando vacación:', err);
                            saveBtn.disabled = false;
                            inputEl.disabled = false;
                            saveBtn.innerHTML = 'Error';
                        }
                    }
                };
            }

        } catch (e) {
            console.error("Error al cargar saldos del equipo:", e);
            grid.innerHTML = '<div class="error-msg">Error al cargar saldos del equipo.</div>';
        }
    }

    renderChronogram(allReqs) {
        const container = document.getElementById('vacation-chrono-container');
        if (!container) return;

        // Filtrar solo pendientes o aprobados
        const validReqs = allReqs.filter(r => ['pendiente', 'aprobado_coordinador', 'aprobado_gerencia', 'aprobado'].includes(r.status));

        // Rango: Mes anterior, Mes actual, Mes Siguiente
        const today = new Date();
        const startBase = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endBase = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        
        const days = [];
        for (let d = new Date(startBase); d <= endBase; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }

        const DAY_W = 35; // px por día
        const TRACK_W = days.length * DAY_W;
        
        // Agrupar requests por User
        const userMap = {};
        validReqs.forEach(req => {
            if (!userMap[req.uid]) {
                userMap[req.uid] = { name: req.name, reqs: [] };
            }
            userMap[req.uid].reqs.push(req);
        });

        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        
        // Render meses header
        let monthsHtml = '';
        let currentMonthStr = "";
        let currentMonthCount = 0;
        
        days.forEach(d => {
            const mStr = monthNames[d.getMonth()] + ' ' + d.getFullYear();
            if (mStr !== currentMonthStr) {
                if (currentMonthCount > 0) {
                    monthsHtml += `<div style="display: inline-block; width: ${currentMonthCount * DAY_W}px; text-align: center; font-weight: 800; font-size: 0.8rem; color: var(--rosa-strong); border-right: 1px solid #eaeaea; padding: 5px 0;">${currentMonthStr}</div>`;
                }
                currentMonthStr = mStr;
                currentMonthCount = 1;
            } else {
                currentMonthCount++;
            }
        });
        monthsHtml += `<div style="display: inline-block; width: ${currentMonthCount * DAY_W}px; text-align: center; font-weight: 800; font-size: 0.8rem; color: var(--rosa-strong); padding: 5px 0;">${currentMonthStr}</div>`;

        // Render days header
        let daysHtml = days.map(d => {
            const isWknd = d.getDay() === 0 || d.getDay() === 6;
            const isToday = d.toDateString() === today.toDateString();
            return `<div style="display: inline-block; width: ${DAY_W}px; text-align: center; font-size: 0.75rem; border-right: 1px solid #f0f0f0; background: ${isWknd ? '#fafafa' : 'transparent'}; color: ${isToday ? 'var(--rosa-strong)' : 'var(--text-main)'}; font-weight: ${isToday ? '800' : 'normal'}; padding: 4px 0;">${d.getDate()}</div>`;
        }).join('');

        // V-lines for track backgound
        const bgLines = days.map(d => {
            const isWknd = d.getDay() === 0 || d.getDay() === 6;
            const isToday = d.toDateString() === today.toDateString();
            let borderStyle = isWknd ? '1px dashed #f0f0f0' : '1px solid #f5f5f5';
            if (isToday) borderStyle = '1px solid var(--rosa-light)';
            return `<div style="position: absolute; top: 0; bottom: 0; left: 0; margin-left:-1px; border-right: ${borderStyle}; width: ${DAY_W}px; ${isWknd ? 'background: #fcfcfc;' : ''}"></div>`;
        }).join('');

        // Generar filas
        let rowsHtml = '';
        const sortedUsers = Object.values(userMap).sort((a,b) => a.name.localeCompare(b.name));

        if (sortedUsers.length === 0) {
            rowsHtml = `<div style="padding: 2rem; color: var(--text-dim); text-align: center; width: 100%;">No hay vacaciones programadas en este periodo.</div>`;
        }

        sortedUsers.forEach(u => {
            rowsHtml += `
                <div style="display: flex; position: relative; border-bottom: 1px solid #f0f0f0; align-items: stretch;">
                    <div style="flex-shrink: 0; width: 180px; padding: 0.8rem; border-right: 1px solid var(--border); background: white; position: sticky; left: 0; z-index: 10; display: flex; align-items: center; box-shadow: 2px 0 5px rgba(0,0,0,0.02);">
                        <div style="font-weight: 700; font-size: 0.85rem; color: var(--azul-deep); white-space: normal; line-height: 1.2;">${u.name}</div>
                    </div>
                    <div style="position: relative; width: ${TRACK_W}px; min-height: 48px; flex-shrink: 0;">
                        <div style="display: flex; width: 100%; height: 100%; position: absolute;">
                            ${bgLines}
                        </div>
            `;
            
            // Barras de vacacion
            u.reqs.forEach(req => {
                if (!req.full_dates && !req.start_date) return;
                
                let renderStart, renderEnd;
                if (req.full_dates) {
                    const sorted = req.full_dates.split(', ').sort();
                    renderStart = new Date(sorted[0] + 'T12:00:00');
                    renderEnd = new Date(sorted[sorted.length - 1] + 'T12:00:00');
                } else {
                    renderStart = new Date(req.start_date + 'T12:00:00');
                    renderEnd = new Date(req.end_date + 'T12:00:00');
                }

                if (isNaN(renderStart) || isNaN(renderEnd)) return;

                // Day index calculation
                const si = days.findIndex(d => d.toDateString() === renderStart.toDateString());
                const ei = days.findIndex(d => d.toDateString() === renderEnd.toDateString());
                
                // Si la vacación está completamente fuera del rango, ignorar
                if ((si === -1 && renderStart > endBase) || (ei === -1 && renderEnd < startBase)) return;

                // Ajustar si cruza límites visuales
                const drawSi = si >= 0 ? si : 0;
                const drawEi = ei >= 0 ? ei : days.length - 1;

                const leftPx = drawSi * DAY_W;
                const widthPx = ((drawEi - drawSi) + 1) * DAY_W;

                const isApproved = ['aprobado_gerencia', 'aprobado'].includes(req.status);
                const color = isApproved ? '#10b981' : 'var(--amarillo-strong)';
                const label = isApproved ? 'Autorizado' : 'Pendiente';

                rowsHtml += `
                    <div
                        class="chrono-vac-bar"
                        data-id="${req.id}"
                        data-name="${u.name}"
                        data-days="${req.days_requested}"
                        data-approved="${isApproved}"
                        title="${u.name} • ${req.days_requested} días • ${label}${isApproved ? ' — Clic para eliminar' : ''}"
                        style="position: absolute; left: ${leftPx}px; width: ${widthPx}px; top: 12px; height: 24px; background: ${color}; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); cursor: ${isApproved ? 'pointer' : 'default'}; display: flex; align-items: center; overflow: hidden; padding: 0 6px; transition: filter 0.15s ease;">
                        <span style="color: white; font-size: 0.65rem; font-weight: 800; white-space: nowrap;">${label}</span>
                        ${isApproved ? '<span style="color: rgba(255,255,255,0.7); font-size: 0.6rem; margin-left: 4px;">&#x1F5D1;</span>' : ''}
                    </div>
                `;
            });

            rowsHtml += `</div></div>`;
        });

        // Estructura Master
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; width: max-content; min-width: 100%;">
                <div style="display: flex; border-bottom: 1px solid var(--border); background: #fafafa; position: sticky; top: 0; z-index: 11;">
                    <div style="width: 180px; flex-shrink: 0; border-right: 1px solid var(--border); background: #fafafa; position: sticky; left: 0; z-index: 12; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase;">
                        Colaborador
                    </div>
                    <div>
                        <div style="background: white; border-bottom: 1px solid #f0f0f0;">
                            ${monthsHtml}
                        </div>
                        <div style="display: flex;">
                            ${daysHtml}
                        </div>
                    </div>
                </div>
                ${rowsHtml}
            </div>
        `;

        // Scroll automatico al dia de hoy
        setTimeout(() => {
            const todayIdx = days.findIndex(d => d.toDateString() === today.toDateString());
            if (todayIdx >= 0) {
                const scrollPos = (todayIdx * DAY_W) - 200;
                container.scrollLeft = Math.max(0, scrollPos);
            }
        }, 100);

        // Adjuntar eventos de clic en barras (solo para gerente, solo aprobadas)
        container.querySelectorAll('.chrono-vac-bar[data-approved="true"]').forEach(bar => {
            bar.onmouseenter = () => { bar.style.filter = 'brightness(0.85) saturate(1.2)'; };
            bar.onmouseleave = () => { bar.style.filter = 'none'; };
            bar.onclick = async () => {
                const nombre = bar.dataset.name;
                const dias = bar.dataset.days;
                const reqId = bar.dataset.id;

                const confirmed = await this.showBeautifulConfirm(
                    'Eliminar Vacaciones Autorizadas',
                    `¿Deseas eliminar los ${dias} días autorizados de <strong>${nombre}</strong>? Esta acción no se puede deshacer y los días serán restituidos a su saldo.`,
                    '🗑️ Sí, Eliminar'
                );

                if (!confirmed) return;

                try {
                    await db.collection('vacation_requests').doc(reqId).delete();
                    ToastService.success(`Vacaciones de ${nombre} eliminadas. Los días han sido reintegrados a su saldo.`);
                    // onSnapshot actualiza automáticamente el cronograma y saldos
                } catch (err) {
                    console.error('Error eliminando solicitud:', err);
                    ToastService.error('Error al eliminar las vacaciones.');
                }
            };
        });
    }
}
