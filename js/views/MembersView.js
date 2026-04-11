import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class MembersView extends View {
    async render() {
        if (this.app.currentUser.role !== 'gerente') {
            return this.createEl('div', 'error', 'Acceso restringido');
        }

        const container = this.createEl('div', 'members-view fade-in');
        
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Gestión del Equipo</h1>
                    <p style="color: var(--rosa-med); font-weight: 600;">Administra usuarios, roles y áreas de trabajo</p>
                </div>
                <button class="primary-btn" id="add-member-btn" style="width: auto; padding: 0.8rem 2rem;">+ Nuevo Miembro</button>
            </div>

            <div class="glass-effect" style="border-radius: var(--radius-lg); overflow-x: auto; margin-top: 2rem; -webkit-overflow-scrolling: touch;">
                <table class="data-table" style="min-width: 700px; width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Área</th>
                            <th>Rol</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="members-tbody">
                        <tr><td colspan="4" style="text-align: center; padding: 3rem;">Cargando equipo...</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Modal para Agregar/Editar -->
            <div id="member-modal" class="modal hidden">
                <div class="modal-content glass-effect">
                    <h3 id="modal-title">Agregar Nuevo Usuario</h3>
                    <div class="input-group">
                        <label>Nombre Completo</label>
                        <input type="text" id="m-name" placeholder="Ej: Juan Pérez">
                    </div>
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="m-email" placeholder="usuario@agencia.com">
                    </div>
                    <div class="input-group" id="pass-group">
                        <label>Contraseña Temporary</label>
                        <input type="text" id="m-pass" placeholder="••••••••">
                    </div>
                    <div class="input-group">
                        <label>Rol en el Sistema</label>
                        <select id="m-role">
                            <option value="miembro">Miembro de Equipo</option>
                            <option value="coordinador">Coordinador de Área</option>
                            <option value="gerente">Gerente General</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Fecha de Ingreso</label>
                        <input type="date" id="m-hire-date" placeholder="Cuándo ingresó a la empresa" required>
                        <small>Utilizada automáticamente para el cálculo de vacaciones LFT.</small>
                    </div>
                    <div class="input-group">
                        <label>Área de Trabajo</label>
                        <select id="m-area">
                            <option value="Ventas">Ventas</option>
                            <option value="Supervisión">Supervisión</option>
                            <option value="Relaciones Públicas">Relaciones Públicas</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Operaciones">Operaciones</option>
                            <option value="Recursos Humanos">Recursos Humanos</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button class="secondary-btn" id="close-member-modal">Cancelar</button>
                        <button class="primary-btn" id="save-member-btn">Guardar Usuario</button>
                    </div>
                </div>
            </div>
        `;
        
        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        this.loadMembers();

        document.getElementById('add-member-btn').onclick = () => this.showModal();
        document.getElementById('close-member-modal').onclick = () => this.hideModal();
        document.getElementById('save-member-btn').onclick = () => this.saveMember();
    }

    async loadMembers() {
        const tbody = document.getElementById('members-tbody');
        const members = await FirebaseService.getAllMembers(); // Necesitaremos actualizar esto para que gerente vea a todos
        
        // Nota: getAllMembers en FirebaseService ya hace esto, pero para el Gerente traeremos todo
        const snapshot = await db.collection('users').get();
        const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

        tbody.innerHTML = allUsers.map((u, i) => {
            const isMe = u.uid === this.app.currentUser.uid;
            return `
                <tr class="animate-up" style="animation-delay: ${i * 0.05}s">
                    <td>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--rosa-light), var(--rosa-med)); display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--rosa-strong);">
                                ${u.name.charAt(0)}
                            </div>
                            <div>
                                <div style="font-weight: 700;">${u.name} ${isMe ? '<span style="color: var(--rosa-med)">(Tú)</span>' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--text-dim);">${u.email}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge" style="background: var(--azul-light); color: var(--azul-deep);">${u.area || 'N/A'}</span></td>
                    <td><span class="badge" style="background: var(--amarillo-light); color: #854d0e;">${u.role}</span></td>
                    <td>
                        <div class="header-actions">
                            <button class="secondary-btn sm edit-btn" data-id="${u.uid}">Editar</button>
                            <button class="secondary-btn sm reset-pass-btn" data-email="${u.email}" title="Enviar correo de restablecimiento">Restablecer</button>
                            ${!isMe ? `<button class="risk-red badge delete-btn" data-id="${u.uid}" style="border:none; cursor:pointer;">Borrar</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = () => this.showModal(allUsers.find(u => u.uid === btn.dataset.id));
        });

        tbody.querySelectorAll('.reset-pass-btn').forEach(btn => {
            btn.onclick = async () => {
                const email = btn.dataset.email;
                const ok = await ToastService.confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`);
                if (ok) {
                    try {
                        await FirebaseService.sendPasswordResetEmail(email);
                        ToastService.success("Correo de restablecimiento enviado correctamente.");
                    } catch (e) {
                        ToastService.error("Error al enviar correo: " + e.message);
                    }
                }
            };
        });

        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = async () => {
                const ok = await ToastService.confirm("¿Estás seguro de borrar este usuario? Perderá acceso al sistema.", "Sí, borrar", "Cancelar", "danger");
                if (ok) {
                    try {
                        await db.collection('users').doc(btn.dataset.id).delete();
                        ToastService.success("Usuario eliminado.");
                        this.loadMembers();
                    } catch (e) {
                        ToastService.error("Error al borrar: " + e.message);
                    }
                }
            };
        });
    }

    showModal(member = null) {
        const modal = document.getElementById('member-modal');
        const title = document.getElementById('modal-title');
        const passGroup = document.getElementById('pass-group');
        
        this.editingId = member ? member.uid : null;
        title.textContent = member ? 'Editar Usuario' : 'Agregar Nuevo Usuario';
        passGroup.classList.toggle('hidden', !!member); // Solo mostrar pass si es nuevo

        document.getElementById('m-name').value = member ? member.name : '';
        document.getElementById('m-email').value = member ? member.email : '';
        document.getElementById('m-role').value = member ? member.role : 'miembro';
        document.getElementById('m-area').value = member ? member.area : 'Ventas';
        document.getElementById('m-hire-date').value = member && member.hire_date ? member.hire_date : '';

        modal.classList.remove('hidden');
    }

    hideModal() {
        document.getElementById('member-modal').classList.add('hidden');
    }

    async saveMember() {
        const name = document.getElementById('m-name').value;
        const email = document.getElementById('m-email').value;
        const role = document.getElementById('m-role').value;
        const area = document.getElementById('m-area').value;
        const password = document.getElementById('m-pass').value;
        const hire_date = document.getElementById('m-hire-date').value;
        
        if (!name || !email || !hire_date) return alert("Completa los datos obligatorios (Nombre, Email, Fecha de Ingreso).");

        try {
            if (this.editingId) {
                // Caso: Edición de perfil existente
                await db.collection('users').doc(this.editingId).update({ name, role, area, hire_date });
                ToastService.success("Usuario actualizado correctamente.");
            } else {
                // ... (lógica de creación)
                const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");
                try {
                    const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                    const newUid = userCredential.user.uid;

                    await db.collection('users').doc(newUid).set({
                        uid: newUid,
                        name: name,
                        email: email,
                        role: role,
                        area: area,
                        hire_date: hire_date,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert(`¡Éxito! Usuario "${name}" creado y registrado en el sistema.`);
                } finally {
                    // Siempre eliminar la instancia secundaria para liberar recursos
                    await secondaryApp.delete();
                }
            }
            this.hideModal();
            this.loadMembers();
        } catch (e) {
            console.error(e);
            alert("Error al procesar: " + e.message);
        }
    }
}
