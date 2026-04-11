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

    static async confirm(message, confirmText = "Aceptar", cancelText = "Cancelar") {
        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.className = 'modal confirm-modal toast-confirm';
            container.innerHTML = `
                <div class="modal-content glass-effect" style="max-width: 400px; text-align: center; padding: 2.5rem 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <div style="color: var(--text-main); font-size: 1.1rem; font-weight: 600; line-height: 1.5; margin-bottom: 2rem;">
                        ${message}
                    </div>
                    <div class="modal-actions" style="justify-content: center; gap: 1rem; margin-top: 0;">
                        <button class="secondary-btn" id="toast-cancel-btn">${cancelText}</button>
                        <button class="primary-btn" id="toast-ok-btn" style="background: var(--rosa-med);">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            
            // Allow CSS to trigger transition if any is written, fallback styling
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.backgroundColor = 'rgba(0,0,0,0.5)';
            container.style.backdropFilter = 'blur(4px)';

            const content = container.querySelector('.modal-content');
            content.style.animation = 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';

            const close = (result) => {
                content.style.animation = 'toast-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                setTimeout(() => {
                    container.remove();
                    resolve(result);
                }, 300);
            };

            document.getElementById('toast-cancel-btn').onclick = () => close(false);
            document.getElementById('toast-ok-btn').onclick = () => close(true);
        });
    }
}
