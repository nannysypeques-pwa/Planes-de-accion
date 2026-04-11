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
        this.mobileNav = document.getElementById('mobile-nav');
        this.currentUser = null;
        
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
        // Placeholder for Firebase Auth listener
        this.handleAuthState();
        
        window.addEventListener('popstate', () => this.router());
        this.router();
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
                this.currentUser = null;
                localStorage.removeItem('user_session');
                this.hideNavigation();
                this.navigateTo('login');
            }
        });
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

        // Reset visibility
        document.getElementById('nav-dashboard').classList.remove('hidden');
        document.getElementById('nav-plans').classList.remove('hidden');
        document.getElementById('nav-tasks').classList.remove('hidden');
        document.getElementById('nav-cronograma').classList.remove('hidden');
        document.getElementById('nav-vacaciones').classList.remove('hidden');
        document.getElementById('nav-members').classList.add('hidden');

        if (role === 'gerente') {
            document.getElementById('nav-members').classList.remove('hidden');
        } else if (role === 'coordinadora') {
            // Dashboard, Planes, Tareas (Ya configurado por default arriba)
        } else if (role === 'miembro') {
            document.getElementById('nav-dashboard').classList.add('hidden');
        }

        if (window.innerWidth <= 768) {
            this.mobileNav.classList.remove('hidden');
            // Opcional: Filtrar también en móvil si es necesario
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                auth.signOut().then(() => {
                    localStorage.removeItem('user_session');
                    this.currentUser = null;
                    this.hideNavigation();
                    this.navigateTo('login');
                });
            };
        }
    }

    hideNavigation() {
        this.header.classList.add('hidden');
        this.mobileNav.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
