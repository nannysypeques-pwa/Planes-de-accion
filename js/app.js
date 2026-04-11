/**
 * INTERNAL EXECUTION SYSTEM - CORE LOGIC
 * Nanny Agency
 */

import { AuthView } from './views/AuthView.js';
import { DashboardView } from './views/DashboardView.js';
import { ActionPlansView } from './views/ActionPlansView.js';
import { ActionPlanCreateView } from './views/ActionPlanCreateView.js';
import { ActionPlanDetailView } from './views/ActionPlanDetailView.js';
import { NotificationsView } from './views/NotificationsView.js';
import { MembersView } from './views/MembersView.js';
import { TasksView } from './views/TasksView.js';
import { CronogramaView } from './views/CronogramaView.js';
import { VacacionesView } from './views/VacacionesView.js';

class App {
    constructor() {
        this.container = document.getElementById('view-container');
        this.header = document.getElementById('main-header');
        this.sideMenu = document.getElementById('side-menu');
        this.offlineOverlay = document.getElementById('offline-overlay');
        this.currentUser = null;
        this.notifUnsubscribe = null;
        
        this.routes = {
            'login': AuthView,
            'dashboard': DashboardView,
            'plans': ActionPlansView,
            'plans/new': ActionPlanCreateView,
            'plans/detail': ActionPlanDetailView,
            'tasks': TasksView,
            'cronograma': CronogramaView,
            'vacaciones': VacacionesView,
            'notifications': NotificationsView,
            'members': MembersView
        };

        this.init();
    }

    async init() {
        console.log("Initializing App...");
        this.handleAuthState();
        this.setupNavigation();
        this.setupConnectivity();
        
        window.addEventListener('popstate', () => this.router());
        this.router();
    }

    setupNavigation() {
        // Toggle Menú Hamburguesa
        const toggleBtn = document.getElementById('menu-toggle');
        const closeBtn = document.getElementById('close-menu');
        
        if (toggleBtn) {
            toggleBtn.onclick = () => this.sideMenu.classList.toggle('open');
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => this.sideMenu.classList.remove('open');
        }

        // Cerrar menú al hacer click en un link
        document.querySelectorAll('.side-link').forEach(link => {
            link.addEventListener('click', () => {
                this.sideMenu.classList.remove('open');
            });
        });

        // Logout Mobile
        const logoutMobile = document.getElementById('logout-btn-mobile');
        if (logoutMobile) {
            logoutMobile.onclick = () => this.logout();
        }

        // Logout Desktop (Existing)
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.logout();
        }

        // Click en la campana
        const bellBtn = document.getElementById('notif-bell');
        if (bellBtn) {
            bellBtn.onclick = () => this.navigateTo('notifications');
        }
    }

    setupConnectivity() {
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        this.updateOnlineStatus(); // Estado inicial
    }

    updateOnlineStatus() {
        if (navigator.onLine) {
            this.offlineOverlay.classList.add('hidden');
        } else {
            this.offlineOverlay.classList.remove('hidden');
        }
    }

    async logout() {
        try {
            await auth.signOut();
            localStorage.removeItem('user_session');
            this.currentUser = null;
            this.hideNavigation();
            this.sideMenu.classList.remove('open');
            this.navigateTo('login');
        } catch (e) {
            console.error("Error al cerrar sesión:", e);
        }
    }

    handleAuthState() {
        // Listener oficial de Firebase — verifica en servidor, no en localStorage
        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const { FirebaseService } = await import('./services/FirebaseService.js');
                    const profile = await FirebaseService.getCurrentUserProfile(firebaseUser.uid);
                    if (!profile) {
                        // Usuario autenticado en Firebase Auth pero sin perfil en Firestore
                        await auth.signOut();
                        this.navigateTo('login');
                        return;
                    }
                    this.currentUser = profile;
                    localStorage.setItem('user_session', JSON.stringify(profile));
                    this.showNavigation();
                    this.setupNotificationsListener();
                    this.checkTaskDeadlines();
                    
                    // Solo navegar si estamos en login o en blanco
                    const hash = window.location.hash.replace('#', '');
                    if (!hash || hash === 'login') {
                        this.navigateTo(profile.role === 'miembro' ? 'plans' : 'dashboard');
                    } else {
                        this.router();
                    }
                } catch (e) {
                    console.error('Error cargando perfil de usuario:', e);
                    this.navigateTo('login');
                }
            } else {
                // No hay sesión activa
                if (this.notifUnsubscribe) {
                    this.notifUnsubscribe();
                    this.notifUnsubscribe = null;
                }
                this.currentUser = null;
                localStorage.removeItem('user_session');
                this.hideNavigation();
                this.navigateTo('login');
            }
        });
    }

    setupNotificationsListener() {
        if (!this.currentUser) return;
        
        // Limpiar listener previo si existe
        if (this.notifUnsubscribe) this.notifUnsubscribe();

        const badge = document.getElementById('notif-badge');
        
        this.notifUnsubscribe = db.collection('notifications')
            .where('userId', '==', this.currentUser.uid)
            .where('read', '==', false)
            .onSnapshot(snapshot => {
                const count = snapshot.size;
                if (badge) {
                    badge.textContent = count > 99 ? '99+' : count;
                    if (count > 0) {
                        badge.classList.remove('hidden');
                        badge.classList.add('pulse');
                    } else {
                        badge.classList.add('hidden');
                        badge.classList.remove('pulse');
                    }
                }
            }, error => console.error("Error en listener notificaciones:", error));
    }

    async checkTaskDeadlines() {
        if (!this.currentUser) return;
        
        try {
            const { FirebaseService } = await import('./services/FirebaseService.js');
            const tasks = await FirebaseService.getTasksByUserId(this.currentUser.uid);
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1);
            
            for (const task of tasks) {
                if (task.status === 'completado' || !task.due_date) continue;
                
                const dueDate = new Date(task.due_date + 'T12:00:00');
                const diffTime = dueDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let type = '';
                let title = '';
                let body = '';

                if (diffDays < 0) {
                    type = 'overdue';
                    title = "⚠️ Tarea Vencida";
                    body = `La tarea "${task.title}" ya venció. Por favor actualiza su avance.`;
                } else if (diffDays <= 2) {
                    type = 'upcoming';
                    title = "📅 Próxima a vencer";
                    body = `La tarea "${task.title}" vence pronto (${task.due_date}).`;
                }

                if (type) {
                    // Verificar si ya notificamos sobre este evento para esta tarea
                    const notifId = `task_${task.id}_${type}`;
                    const alreadySent = await db.collection('notifications')
                        .where('userId', '==', this.currentUser.uid)
                        .where('eventId', '==', notifId)
                        .get();

                    if (alreadySent.empty) {
                        await db.collection('notifications').add({
                            userId: this.currentUser.uid,
                            eventId: notifId,
                            title,
                            body,
                            link: '#tasks',
                            read: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error chequeando plazos:", error);
        }
    }

    navigateTo(path) {
        window.history.pushState({}, path, `#${path}`);
        this.router();
    }

    async router() {
        const fullHash = window.location.hash.replace('#', '') || 'login';
        const [route, action, id] = fullHash.split('/');
        
        const path = action ? `${route}/${action}` : route;
        
        if (!this.currentUser && path !== 'login') {
            this.navigateTo('login');
            return;
        }

        // Protección de Rutas por Rol
        if (this.currentUser) {
            const role = this.currentUser.role;
            const isCoord = ['coordinador', 'coordinadora'].includes(role);
            if (role === 'miembro' && (path === 'dashboard' || path === 'members')) {
                this.navigateTo('plans');
                return;
            }
            if (isCoord && path === 'members') {
                this.navigateTo('dashboard');
                return;
            }
        }

        const ViewClass = this.routes[path] || (this.routes[route] ? this.routes[route] : AuthView);
        const view = new ViewClass(this, id);
        
        this.container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
        
        try {
            // Destruir la vista anterior para limpiar listeners en tiempo real
            if (this._activeView && typeof this._activeView.destroy === 'function') {
                this._activeView.destroy();
            }
            this._activeView = view;

            const content = await view.render();
            this.container.innerHTML = '';
            this.container.appendChild(content);
            if (view.afterRender) view.afterRender();
        } catch (error) {
            console.error("Routing error:", error);
            this.container.innerHTML = `<div class="error-msg">Error al cargar la vista: ${error.message}</div>`;
        }
    }

    showNavigation() {
        this.header.classList.remove('hidden');
        const role = this.currentUser.role;

        // IDs de navegación Desktop y Mobile
        const navIds = ['dashboard', 'plans', 'tasks', 'cronograma', 'vacaciones', 'members'];
        
        navIds.forEach(id => {
            const deskEl = document.getElementById(`nav-${id}`);
            const sideEl = document.getElementById(`side-nav-${id}`); // Solo para members que tiene ID
            
            // Ocultar por defecto si es miembro y es dashboard/members
            let shouldHide = (role === 'miembro' && (id === 'dashboard' || id === 'members'));
            // Ocultar members si no es gerente
            if (id === 'members' && role !== 'gerente') shouldHide = true;

            if (deskEl) {
                shouldHide ? deskEl.classList.add('hidden') : deskEl.classList.remove('hidden');
            }
            
            // Para el menú lateral, usamos selectores de atributo o clases si no hay ID único
            const sideLink = document.querySelector(`.side-link[href="#${id}"]`) || document.getElementById(`side-nav-${id}`);
            if (sideLink) {
                shouldHide ? sideLink.classList.add('hidden') : sideLink.classList.remove('hidden');
            }
        });
    }

    hideNavigation() {
        this.header.classList.add('hidden');
        this.sideMenu.classList.remove('open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
