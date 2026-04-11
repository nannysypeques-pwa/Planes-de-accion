import { View } from './View.js';
import { ToastService } from '../services/ToastService.js';

export class NotificationsView extends View {
    async render() {
        const container = this.createEl('div', 'notifications-view fade-in');
        
        container.innerHTML = `
            <div class="view-header">
                <h1>Notificaciones</h1>
                <button class="secondary-btn sm" id="mark-all-read">Marcar leídas</button>
            </div>

            <div class="notifications-list" id="notif-container">
                <div class="loading-inline">Cargando notificaciones...</div>
            </div>
        `;
        
        return container;
    }

    async afterRender() {
        this.app.showNavigation();
        this.loadNotifications();
    }

    async loadNotifications() {
        const container = document.getElementById('notif-container');
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', this.app.currentUser.uid)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (notifs.length === 0) {
                container.innerHTML = '<div class="empty-state">No tienes notificaciones nuevas.</div>';
                return;
            }

            container.innerHTML = notifs.map((n, i) => `
                <div class="notif-item glass-effect ${n.read ? '' : 'unread'} animate-up" data-id="${n.id}" style="animation-delay: ${i * 0.05}s; border-radius: var(--radius-md); border-left: 6px solid ${n.read ? 'var(--border)' : 'var(--rosa-med)'};">
                    <div class="notif-icon" style="font-size: 1.5rem;">${n.read ? '🔔' : '✨'}</div>
                    <div class="notif-body">
                        <h4 style="color: ${n.read ? 'var(--text-dim)' : 'var(--text-main)'};">${n.title}</h4>
                        <p style="margin: 0.3rem 0;">${n.body}</p>
                        <small style="color: var(--rosa-strong); font-weight: 700;">${n.createdAt?.toDate().toLocaleString() || 'Reciente'}</small>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.notif-item').forEach(item => {
                item.onclick = async () => {
                    const id = item.dataset.id;
                    const notif = notifs.find(x => x.id === id);
                    await db.collection('notifications').doc(id).update({ read: true });
                    if (notif.link) window.location.hash = notif.link;
                };
            });

        } catch (error) {
            container.innerHTML = 'Error al cargar notificaciones.';
        }
    }
}
