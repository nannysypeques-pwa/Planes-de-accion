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

    static startKeepReminderScheduler(app) {
        if (!app.currentUser) return;
        
        const db = firebase.firestore();
        let activeReminders = [];

        // 1. Listen in real-time to active reminders
        const unsubscribe = db.collection('keep_notes')
            .where('reminderFired', '==', false)
            .onSnapshot(snapshot => {
                activeReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }, error => {
                console.error("Error in global reminders listener:", error);
            });

        // 2. Poll every 5 seconds for absolute precision and real-time feel
        const interval = setInterval(async () => {
            if (!app.currentUser) {
                clearInterval(interval);
                unsubscribe();
                return;
            }

            const now = new Date();
            for (const note of activeReminders) {
                if (note.reminder) {
                    // Standardize string replacing space with 'T' for local timezone parsing
                    const dateStr = note.reminder.replace(' ', 'T');
                    const reminderDate = new Date(dateStr);

                    if (!isNaN(reminderDate.getTime()) && reminderDate <= now) {
                        // Prevent duplicate execution local
                        note.reminderFired = true;

                        // Mark as fired in Firestore
                        try {
                            await db.collection('keep_notes').doc(note.id).update({
                                reminderFired: true
                            });

                            // Check if current user is a recipient or if no recipients defined (creator fallback)
                            const recipients = note.reminderRecipients || [];
                            const isRecipient = recipients.includes(app.currentUser.uid) || recipients.length === 0;

                            if (isRecipient) {
                                this.fireReminderNotification(note);
                            }

                            // Send Firestore profile notification to all recipients
                            const title = `🔔 Ficha Keep: ${note.title || 'Nueva Ficha'}`;
                            const body = note.content || (note.checklist ? 'Tienes una tarea de Keep pendiente.' : 'Tienes una ficha asignada para revisar hoy.');
                            
                            for (const uid of recipients) {
                                try {
                                    await db.collection('notifications').add({
                                        userId: uid,
                                        title,
                                        body,
                                        link: '#keep',
                                        read: false,
                                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                                    });
                                } catch (e) {
                                    console.error("Error adding background notification:", e);
                                }
                            }
                        } catch (e) {
                            console.error("Error firing background reminder:", e);
                        }
                    }
                }
            }
        }, 5000);

        // Store references on app instance
        app.reminderUnsubscribe = unsubscribe;
        app.reminderInterval = interval;
    }

    static fireReminderNotification(note) {
        const title = `🔔 Recordatorio: ${note.title || 'Nota'}`;
        const body = note.content || (note.checklist ? 'Tienes elementos pendientes por revisar.' : 'Revisar notas');

        // 1. Toast Alert
        ToastService.info(body, title);

        // 2. Service Worker push
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, {
                        body: body,
                        icon: './logo-sin-fondo.png',
                        badge: './logo-sin-fondo.png',
                        vibrate: [200, 100, 200],
                        tag: `keep_reminder_${note.id}`,
                        renotify: true,
                        data: { noteId: note.id }
                    });
                });
            } catch (e) {
                new Notification(title, { body });
            }
        }
    }
}
