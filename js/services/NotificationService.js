import { FirebaseService } from './FirebaseService.js';
import { ToastService } from './ToastService.js';

export class NotificationService {
    static async init(app) {
        if (!('Notification' in window)) {
            console.log("Este navegador no soporta notificaciones.");
            return;
        }

        const messaging = firebase.messaging();

        // Escuchar mensajes en primer plano
        messaging.onMessage((payload) => {
            console.log('Mensaje en primer plano:', payload);
            ToastService.info(payload.notification.body, payload.notification.title);
            
            // Actualizar badge si es necesario
            const badge = document.getElementById('notif-badge');
            if (badge) {
                const count = parseInt(badge.textContent) || 0;
                badge.textContent = count + 1;
                badge.classList.remove('hidden');
            }
        });

        // Intentar registrar el token si ya hay permiso
        if (Notification.permission === 'granted') {
            this.getTokenAndSave(app);
        } else if (Notification.permission !== 'denied') {
            this.showPermissionInvite(app);
        }
    }

    static async showPermissionInvite(app) {
        const overlay = document.createElement('div');
        overlay.className = 'notif-modal-overlay';
        overlay.innerHTML = `
            <div class="notif-modal-content">
                <div class="notif-modal-icon-container">🔔</div>
                <h2>¿Quieres recibir avisos?</h2>
                <p>Activa las notificaciones para estar siempre al tanto de tus tareas y planes de acción en tiempo real.</p>
                <div class="notif-modal-buttons">
                    <button id="notif-allow" class="notif-modal-btn-primary">¡Sí, activar ahora!</button>
                    <button id="notif-deny" class="notif-modal-btn-secondary">Quizás más tarde</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Forzar reflow para animación
        setTimeout(() => overlay.classList.add('active'), 10);

        document.getElementById('notif-deny').onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 400);
        };
        
        document.getElementById('notif-allow').onclick = async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.getTokenAndSave(app);
            }
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 400);
        };
    }

    static async getTokenAndSave(app) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const messaging = firebase.messaging();
            const token = await messaging.getToken({
                vapidKey: 'BIlr6BYt8szEj6iNI8y5fjN83ygYYN1GiT9eHis-mZSzoyd6eHoaFqEMxukeFSpIDWZdp1GIVj1vLt8U2_Ths6Q',
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('FCM Token:', token);
                await this.saveTokenToFirestore(app.currentUser.uid, token);
            }
        } catch (error) {
            console.error('Error al obtener token FCM:', error);
        }
    }

    static async saveTokenToFirestore(uid, token) {
        const db = firebase.firestore();
        await db.collection('users').doc(uid).set({
            fcm_tokens: firebase.firestore.FieldValue.arrayUnion(token),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
}
