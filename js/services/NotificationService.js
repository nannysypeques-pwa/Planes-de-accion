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
        // Crear un pequeño banner o modal discreto para invitar a activar notificaciones
        const invite = document.createElement('div');
        invite.className = 'notif-invite-banner glass-effect animate-up';
        invite.innerHTML = `
            <div class="invite-content">
                <span class="invite-icon">🔔</span>
                <div class="invite-text">
                    <strong>¿Quieres recibir avisos?</strong>
                    <p>Activa las notificaciones para no perderte cambios en tus tareas.</p>
                </div>
                <div class="invite-actions">
                    <button id="notif-deny" class="text-btn">Ahora no</button>
                    <button id="notif-allow" class="primary-btn sm">Activar</button>
                </div>
            </div>
        `;
        document.body.appendChild(invite);

        document.getElementById('notif-deny').onclick = () => invite.remove();
        document.getElementById('notif-allow').onclick = async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.getTokenAndSave(app);
            }
            invite.remove();
        };
    }

    static async getTokenAndSave(app) {
        try {
            const messaging = firebase.messaging();
            const token = await messaging.getToken({
                vapidKey: 'BIlr6BYt8szEj6iNI8y5fjN83ygYYN1GiT9eHis-mZSzoyd6eHoaFqEMxukeFSpIDWZdp1GIVj1vLt8U2_Ths6Q'
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
