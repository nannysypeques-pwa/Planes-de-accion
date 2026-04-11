import { View } from './View.js';
import { FirebaseService } from '../services/FirebaseService.js';
import { ToastService } from '../services/ToastService.js';

export class AuthView extends View {
    async render() {
        const container = this.createEl('div', 'auth-container');

        const card = this.createEl('div', 'auth-card glass-effect');
        card.innerHTML = `
            <div class="auth-brand">
                <div class="logo-large">TRABAJO EN <span>EQUIPO</span></div>
                <div class="brand-subtitle-auth">Nannys y Peques</div>
            </div>
            <h1>Bienvenido</h1>
            <p>Ingresa tus credenciales para continuar</p>
            
            <div class="input-group">
                <label>Email</label>
                <input type="email" id="email" placeholder="usuario@agencia.com" autocomplete="email">
            </div>
            
            <div class="input-group">
                <label>Contraseña</label>
                <input type="password" id="password" placeholder="••••••••" autocomplete="current-password">
            </div>
            
            <button class="primary-btn pulse" id="login-btn">Entrar al Sistema</button>
            <div id="auth-error" class="error-msg hidden"></div>
        `;

        container.appendChild(card);
        return container;
    }

    afterRender() {
        this.app.hideNavigation();
        const btn = document.getElementById('login-btn');
        const errEl = document.getElementById('auth-error');

        btn.onclick = async () => {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;

            if (!email || !pass) {
                ToastService.warning("Por favor completa todos los campos");
                return;
            }

            btn.disabled = true;
            btn.textContent = "Validando...";

            try {
                // Autenticación real con Firebase (global auth de index.html)
                const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                const user = userCredential.user;

                // Obtener perfil de Firestore
                let profile = await FirebaseService.getCurrentUserProfile(user.uid);

                // Si no existe perfil todavía (primer login), lo creamos con rol base
                if (!profile) {
                    profile = {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || email.split('@')[0],
                        role: 'miembro', // Rol por defecto
                        createdAt: new Date().toISOString()
                    };
                    await db.collection('users').doc(user.uid).set(profile);
                }

                localStorage.setItem('user_session', JSON.stringify(profile));
                this.app.currentUser = profile;
                ToastService.success(`¡Bienvenido de nuevo, ${profile.name}!`);
                this.app.showNavigation();
                this.app.navigateTo('dashboard');

            } catch (error) {
                console.error("Error de Auth:", error);
                ToastService.error(this.translateError(error.code));
                btn.disabled = false;
                btn.textContent = "Entrar al Sistema";
            }
        };
    }

    translateError(code) {
        switch (code) {
            case 'auth/user-not-found': return "Usuario no encontrado";
            case 'auth/wrong-password': return "Contraseña incorrecta";
            case 'auth/invalid-email': return "Email inválido";
            default: return "Credenciales inválidas o error de conexión";
        }
    }
}
