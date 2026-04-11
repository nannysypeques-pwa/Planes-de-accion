export class ToastService {
    static init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);

            const style = document.createElement('style');
            style.textContent = `
                #toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    pointer-events: none;
                }

                .toast {
                    min-width: 300px;
                    max-width: 450px;
                    padding: 16px 20px;
                    border-radius: 18px;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                    color: #1e293b;
                    font-family: 'Inter', sans-serif;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    pointer-events: auto;
                    animation: toast-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    position: relative;
                    overflow: hidden;
                }

                .toast-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: var(--primary);
                    width: 100%;
                    transform-origin: left;
                    animation: toast-progress linear forwards;
                }

                @keyframes toast-in {
                    from { transform: translateX(100%) scale(0.9); opacity: 0; }
                    to { transform: translateX(0) scale(1); opacity: 1; }
                }

                @keyframes toast-out {
                    from { transform: translateX(0) scale(1); opacity: 1; }
                    to { transform: translateX(100%) scale(0.9); opacity: 0; }
                }

                @keyframes toast-progress {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }

                .toast.success { border-left: 6px solid #05AEE6; }
                .toast.error { border-left: 6px solid #D2328F; }
                .toast.warning { border-left: 6px solid #FFFF87; }

                .toast i { font-size: 1.2rem; }
            `;
            document.head.appendChild(style);
        }
    }

    static show(message, type = 'info', duration = 4000) {
        this.init();
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        
        toast.innerHTML = `
            <span>${icon}</span>
            <div style="flex: 1; font-weight: 500;">${message}</div>
            <div class="toast-progress" style="animation-duration: ${duration}ms; background: ${this.getColor(type)};"></div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toast-out 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 600);
        }, duration);
    }

    static getColor(type) {
        switch(type) {
            case 'success': return '#05AEE6';
            case 'error': return '#D2328F';
            case 'warning': return '#FFFF87';
            default: return '#1e293b';
        }
    }

    static success(msg) { this.show(msg, 'success'); }
    static error(msg) { this.show(msg, 'error'); }
    static warning(msg) { this.show(msg, 'warning'); }

    static async confirm(message, confirmText = "Aceptar", cancelText = "Cancelar", type = 'warning') {
        // Limpiar cualquier modal previo que haya quedado huérfano
        document.querySelectorAll('.confirm-overlay').forEach(el => el.remove());

        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.className = 'confirm-overlay';
            
            const icon = type === 'warning' ? '⚠️' : type === 'danger' ? '🗑️' : 'ℹ️';
            const btnColor = type === 'danger' ? '#ef4444' : 'var(--rosa-med)';

            container.innerHTML = `
                <div class="confirm-content glass-effect">
                    <div class="confirm-icon">${icon}</div>
                    <div class="confirm-msg">${message}</div>
                    <div class="confirm-actions">
                        <button class="secondary-btn" id="toast-cancel-btn">${cancelText}</button>
                        <button class="primary-btn" id="toast-ok-btn" style="background: ${btnColor}">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            
            const content = container.querySelector('.confirm-content');

            const close = (result) => {
                container.classList.add('fade-out');
                setTimeout(() => {
                    container.remove();
                    resolve(result);
                }, 300);
            };

            document.getElementById('toast-cancel-btn').onclick = () => close(false);
            document.getElementById('toast-ok-btn').onclick = () => close(true);
            
            // Cerrar al hacer clic fuera
            container.onclick = (e) => {
                if (e.target === container) close(false);
            };
        });
    }
}
