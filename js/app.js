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
