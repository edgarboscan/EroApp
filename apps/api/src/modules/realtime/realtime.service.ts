import { EventEmitter } from 'events';

export interface RealtimePayload {
  event: string;
  data: any;
  timestamp: string;
}

class RealtimeManager {
  private emitter = new EventEmitter();

  constructor() {
    // Permitir suficientes suscriptores simultáneos para múltiples conexiones SSE de usuarios
    this.emitter.setMaxListeners(2000);
  }

  /**
   * Emite un evento en tiempo real dirigido a un usuario específico
   */
  emitToUser(userId: string, event: string, data: any): void {
    const payload: RealtimePayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit(`user:${userId}`, payload);
  }

  /**
   * Emite un evento en tiempo real a todos los usuarios de una empresa
   */
  emitToCompany(companyId: string, event: string, data: any): void {
    const payload: RealtimePayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit(`company:${companyId}`, payload);
  }

  /**
   * Suscribe a los eventos dirigidos a un usuario
   */
  subscribeUser(userId: string, handler: (payload: RealtimePayload) => void): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }

  /**
   * Suscribe a los eventos globales de la empresa
   */
  subscribeCompany(companyId: string, handler: (payload: RealtimePayload) => void): () => void {
    const channel = `company:${companyId}`;
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }
}

export const RealtimeService = new RealtimeManager();

